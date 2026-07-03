import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { evaluateConditions } from '../../../common/utils/conditions';
import { AutomationRulesService } from '../../automation-rules/automation-rules.service';
import { JobRecordsService } from '../../job-records/job-records.service';
import { WebhookEventsService } from '../../webhook-events/webhook-events.service';
import {
  DISPATCH_ACTIONS_JOB,
  DispatchActionsJobData,
  EVALUATE_RULES_JOB,
  EvaluateRulesJobData,
  WEBHOOK_ENGINE_QUEUE,
} from '../queue.constants';

@Injectable()
export class EvaluateProcessor {
  constructor(
    private readonly automationRulesService: AutomationRulesService,
    private readonly jobRecordsService: JobRecordsService,
    private readonly webhookEventsService: WebhookEventsService,
    @InjectQueue(WEBHOOK_ENGINE_QUEUE)
    private readonly webhookEngineQueue: Queue,
  ) {}

  async process(job: Job<EvaluateRulesJobData>): Promise<void> {
    if (job.name !== EVALUATE_RULES_JOB) {
      throw new Error(`Unsupported job name: ${job.name}`);
    }

    const webhookEvent = await this.webhookEventsService.findByIdForTenant(
      job.data.webhookEventId,
      job.data.tenantId,
    );
    if (!webhookEvent) {
      throw new Error(`Webhook event ${job.data.webhookEventId} not found for tenant`);
    }

    const rules = await this.automationRulesService.findEnabledForEvent(
      job.data.tenantId,
      job.data.sourceId,
      job.data.eventType,
    );

    for (const rule of rules) {
      if (!evaluateConditions(webhookEvent.payload, rule.conditions)) {
        continue;
      }

      const { created, jobRecord } = await this.jobRecordsService.createOrReusePendingJobRecord({
        tenantId: job.data.tenantId,
        webhookEventId: job.data.webhookEventId,
        ruleId: String(rule._id),
        ruleName: rule.name,
      });

      if (!created && jobRecord.bullJobId) {
        continue;
      }

      const dispatchJobData: DispatchActionsJobData = {
        tenantId: job.data.tenantId,
        jobRecordId: String(jobRecord._id),
        webhookEventId: job.data.webhookEventId,
        ruleId: String(rule._id),
      };

      const dispatchJob = await this.webhookEngineQueue.add(
        DISPATCH_ACTIONS_JOB,
        dispatchJobData,
        {
          jobId: String(jobRecord._id),
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

      await this.jobRecordsService.setBullJobId(
        String(jobRecord._id),
        job.data.tenantId,
        String(dispatchJob.id ?? jobRecord._id),
      );
    }

    await this.webhookEventsService.markProcessed(
      job.data.webhookEventId,
      job.data.tenantId,
    );
  }
}
