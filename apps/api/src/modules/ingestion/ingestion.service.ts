import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { stableStringify } from '../../common/utils/stable-json';
import { sha256Hex } from '../../common/utils/crypto';
import { TenantDocument } from '../tenants/tenants.schema';
import { EVALUATE_RULES_JOB, WEBHOOK_ENGINE_QUEUE } from '../queue/queue.constants';
import { WebhookEvent, WebhookEventDocument, WebhookEventStatus } from '../webhook-events/webhook-events.schema';
import { WebhookSourceDocument } from '../webhook-sources/webhook-sources.schema';

interface IngestWebhookParams {
  body: Record<string, unknown>;
  eventTypeHeader?: string;
  idempotencyKeyHeader?: string;
  source: WebhookSourceDocument;
  tenant: TenantDocument;
}

@Injectable()
export class IngestionService {
  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly webhookEventModel: Model<WebhookEventDocument>,
    @InjectQueue(WEBHOOK_ENGINE_QUEUE)
    private readonly webhookEngineQueue: Queue,
  ) {}

  async ingest({
    body,
    eventTypeHeader,
    idempotencyKeyHeader,
    source,
    tenant,
  }: IngestWebhookParams): Promise<{ acknowledged: true; duplicate: boolean; eventId?: string }> {
    const eventType = this.resolveEventType(eventTypeHeader, body);
    const idempotencyKey =
      idempotencyKeyHeader?.trim() ||
      sha256Hex(String(tenant._id), String(source._id), eventType, stableStringify(body));

    const dedupFilter = {
      tenantId: tenant._id,
      idempotencyKey,
    };

    const upsertResult = await this.webhookEventModel
      .updateOne(
        dedupFilter,
        {
          $setOnInsert: {
            tenantId: tenant._id,
            sourceId: source._id,
            eventType,
            payload: body,
            idempotencyKey,
            status: WebhookEventStatus.Queued,
            receivedAt: new Date(),
          },
        },
        { upsert: true },
      )
      .exec();

    if ((upsertResult.upsertedCount ?? 0) === 0) {
      await this.webhookEventModel
        .updateOne(
          {
            ...dedupFilter,
            status: { $ne: WebhookEventStatus.Duplicate },
          },
          {
            $set: {
              status: WebhookEventStatus.Duplicate,
            },
          },
        )
        .exec();

      return {
        acknowledged: true,
        duplicate: true,
      };
    }

    const webhookEvent = await this.webhookEventModel.findOne(dedupFilter).exec();
    if (!webhookEvent) {
      throw new Error('Webhook event was not found after upsert');
    }

    try {
      await this.webhookEngineQueue.add(
        EVALUATE_RULES_JOB,
        {
          tenantId: String(tenant._id),
          webhookEventId: String(webhookEvent._id),
          sourceId: String(source._id),
          eventType,
        },
        {
          jobId: String(webhookEvent._id),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            count: 500,
          },
          removeOnFail: false,
        },
      );
    } catch (error) {
      await this.webhookEventModel
        .updateOne(
          { _id: webhookEvent._id, tenantId: tenant._id },
          {
            $set: {
              status: WebhookEventStatus.FailedIngestion,
            },
          },
        )
        .exec();

      throw error;
    }

    return {
      acknowledged: true,
      eventId: String(webhookEvent._id),
      duplicate: false,
    };
  }

  private resolveEventType(eventTypeHeader: string | undefined, body: Record<string, unknown>): string {
    if (eventTypeHeader?.trim()) {
      return eventTypeHeader.trim();
    }

    const bodyEventType = body._eventType ?? body.type;
    return typeof bodyEventType === 'string' && bodyEventType.trim() ? bodyEventType.trim() : 'unknown';
  }
}
