import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WebhookEvent,
  WebhookEventDocument,
  WebhookEventStatus,
} from './webhook-events.schema';

@Injectable()
export class WebhookEventsService {
  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly webhookEventModel: Model<WebhookEventDocument>,
  ) {}

  async findByIdForTenant(
    webhookEventId: string,
    tenantId: string,
  ): Promise<WebhookEventDocument | null> {
    return this.webhookEventModel
      .findOne({
        _id: webhookEventId,
        tenantId,
      })
      .exec();
  }

  async markProcessed(webhookEventId: string, tenantId: string): Promise<void> {
    await this.webhookEventModel
      .updateOne(
        {
          _id: webhookEventId,
          tenantId,
        },
        {
          $set: {
            status: WebhookEventStatus.Processed,
          },
        },
      )
      .exec();
  }
}
