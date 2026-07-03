import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Connection, Model, Types } from 'mongoose';
import { AutomationRule, AutomationRuleDocument } from '../automation-rules/automation-rules.schema';
import { AutomationRulesService } from '../automation-rules/automation-rules.service';
import { JobRecord, JobRecordDocument, JobRecordStatus } from '../job-records/job-records.schema';
import { JobRecordsService } from '../job-records/job-records.service';
import { WebhookEvent, WebhookEventDocument } from '../webhook-events/webhook-events.schema';
import { WebhookEventsService } from '../webhook-events/webhook-events.service';
import { WebhookSource, WebhookSourceDocument } from '../webhook-sources/webhook-sources.schema';
import {
  DISPATCH_ACTIONS_JOB,
  DispatchActionsJobData,
  WEBHOOK_ENGINE_QUEUE,
} from '../queue/queue.constants';

interface DashboardEventsQuery {
  limit?: string;
  page?: string;
  status?: string;
}

interface DashboardJobsQuery {
  limit?: string;
  page?: string;
  status?: string;
  webhookEventId?: string;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

@Injectable()
export class DashboardService {
  constructor(
    @InjectConnection()
    private readonly mongoConnection: Connection,
    @InjectModel(AutomationRule.name)
    private readonly automationRuleModel: Model<AutomationRuleDocument>,
    @InjectModel(JobRecord.name)
    private readonly jobRecordModel: Model<JobRecordDocument>,
    @InjectModel(WebhookEvent.name)
    private readonly webhookEventModel: Model<WebhookEventDocument>,
    @InjectModel(WebhookSource.name)
    private readonly webhookSourceModel: Model<WebhookSourceDocument>,
    private readonly automationRulesService: AutomationRulesService,
    private readonly jobRecordsService: JobRecordsService,
    private readonly webhookEventsService: WebhookEventsService,
    @InjectQueue(WEBHOOK_ENGINE_QUEUE)
    private readonly webhookEngineQueue: Queue,
  ) {}

  async listEvents(tenantId: string, query: DashboardEventsQuery) {
    const page = parsePositiveInt(query.page, DEFAULT_PAGE);
    const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const tenantObjectId = new Types.ObjectId(tenantId);
    const match: Record<string, unknown> = { tenantId: tenantObjectId };

    if (query.status) {
      match.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.webhookEventModel
        .aggregate([
          { $match: match },
          { $sort: { receivedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: this.webhookSourceModel.collection.name,
              localField: 'sourceId',
              foreignField: '_id',
              as: 'source',
            },
          },
          {
            $addFields: {
              source: { $first: '$source' },
            },
          },
          {
            $project: {
              _id: 1,
              eventType: 1,
              idempotencyKey: 1,
              receivedAt: 1,
              sourceId: 1,
              sourceName: '$source.name',
              sourceSlug: '$source.slug',
              status: 1,
              tenantId: 1,
            },
          },
        ])
        .exec(),
      this.webhookEventModel.countDocuments(match).exec(),
    ]);

    return { data, total };
  }

  async listJobs(tenantId: string, query: DashboardJobsQuery) {
    const page = parsePositiveInt(query.page, DEFAULT_PAGE);
    const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const tenantObjectId = new Types.ObjectId(tenantId);
    const match: Record<string, unknown> = { tenantId: tenantObjectId };

    if (query.status) {
      match.status = query.status;
    }

    if (query.webhookEventId) {
      if (!Types.ObjectId.isValid(query.webhookEventId)) {
        throw new BadRequestException('Invalid webhookEventId');
      }

      match.webhookEventId = new Types.ObjectId(query.webhookEventId);
    }

    const [data, total] = await Promise.all([
      this.jobRecordModel
        .aggregate([
          { $match: match },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: this.webhookEventModel.collection.name,
              localField: 'webhookEventId',
              foreignField: '_id',
              as: 'webhookEvent',
            },
          },
          {
            $addFields: {
              webhookEvent: { $first: '$webhookEvent' },
            },
          },
          {
            $project: {
              _id: 1,
              actionResults: 1,
              attempts: 1,
              bullJobId: 1,
              completedAt: 1,
              createdAt: 1,
              eventType: '$webhookEvent.eventType',
              lastError: 1,
              ruleId: 1,
              ruleName: 1,
              status: 1,
              tenantId: 1,
              webhookEventId: 1,
            },
          },
        ])
        .exec(),
      this.jobRecordModel.countDocuments(match).exec(),
    ]);

    return { data, total };
  }

  async listRules(tenantId: string) {
    const data = await this.automationRuleModel
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return { data };
  }

  async replayJob(tenantId: string, jobRecordId: string) {
    if (!Types.ObjectId.isValid(jobRecordId)) {
      throw new NotFoundException('Job record not found');
    }

    const jobRecord = await this.jobRecordsService.findByIdForTenant(jobRecordId, tenantId);
    if (!jobRecord) {
      throw new NotFoundException('Job record not found');
    }

    if (jobRecord.status !== JobRecordStatus.Failed) {
      throw new BadRequestException('Only failed jobs can be replayed');
    }

    const webhookEvent = await this.webhookEventsService.findByIdForTenant(
      String(jobRecord.webhookEventId),
      tenantId,
    );
    if (!webhookEvent) {
      throw new NotFoundException('Webhook event not found');
    }

    // Replay intentionally reloads the live rule so a fixed action endpoint or template is used immediately.
    const rule = await this.automationRulesService.findByIdForTenant(
      String(jobRecord.ruleId),
      tenantId,
    );
    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    await this.jobRecordModel
      .updateOne(
        { _id: jobRecordId, tenantId },
        {
          $set: {
            actionResults: [],
            attempts: 0,
            bullJobId: null,
            completedAt: null,
            lastError: null,
            status: JobRecordStatus.Pending,
          },
        },
      )
      .exec();

    const replayJobData: DispatchActionsJobData = {
      tenantId,
      jobRecordId: String(jobRecord._id),
      webhookEventId: String(webhookEvent._id),
      ruleId: String(rule._id),
    };

    const replayJob = await this.webhookEngineQueue.add(
      DISPATCH_ACTIONS_JOB,
      replayJobData,
      {
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

    const newBullJobId = String(replayJob.id);
    await this.jobRecordsService.setBullJobId(jobRecordId, tenantId, newBullJobId);

    return {
      success: true,
      newBullJobId,
    };
  }

  async getHealth() {
    const redisClient = (await this.webhookEngineQueue.client) as unknown as {
      ping(): Promise<string>;
    };
    const [redisPing, queueDepth] = await Promise.all([
      redisClient.ping(),
      this.webhookEngineQueue.getJobCounts(),
    ]);

    return {
      api: 'ok',
      mongo: describeMongoState(this.mongoConnection.readyState),
      queueDepth,
      redis: redisPing === 'PONG' ? 'ok' : redisPing,
    };
  }
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  maxValue?: number,
): number {
  const parsedValue = Number.parseInt(value ?? '', 10);

  if (Number.isNaN(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  if (maxValue) {
    return Math.min(parsedValue, maxValue);
  }

  return parsedValue;
}

function describeMongoState(readyState: number): string {
  switch (readyState) {
    case 1:
      return 'ok';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
}
