import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ActionsService } from '../../actions/actions.service';
import { JobRecordActionResult } from '../../job-records/job-records.schema';
import { JobRecordsService } from '../../job-records/job-records.service';
import { WebhookEventsService } from '../../webhook-events/webhook-events.service';
import { AutomationRulesService } from '../../automation-rules/automation-rules.service';
import {
  DEBUG_SLOW_JOB_KEY,
  DISPATCH_ACTIONS_JOB,
  DispatchActionsJobData,
  WEBHOOK_ENGINE_QUEUE,
} from '../queue.constants';

@Injectable()
export class DispatchProcessor {
  constructor(
    private readonly actionsService: ActionsService,
    private readonly automationRulesService: AutomationRulesService,
    private readonly jobRecordsService: JobRecordsService,
    private readonly webhookEventsService: WebhookEventsService,
    @InjectQueue(WEBHOOK_ENGINE_QUEUE)
    private readonly webhookEngineQueue: Queue,
  ) {}

  async process(job: Job<DispatchActionsJobData>): Promise<void> {
    if (job.name !== DISPATCH_ACTIONS_JOB) {
      throw new Error(`Unsupported job name: ${job.name}`);
    }

    const jobRecord = await this.jobRecordsService.findByIdForTenant(
      job.data.jobRecordId,
      job.data.tenantId,
    );
    if (!jobRecord) {
      throw new Error(`Job record ${job.data.jobRecordId} not found for tenant`);
    }

    if (
      String(jobRecord.webhookEventId) !== job.data.webhookEventId ||
      String(jobRecord.ruleId) !== job.data.ruleId
    ) {
      throw new Error(`Dispatch job ${job.id} references mismatched job record data`);
    }

    // Reload payload and rule state from MongoDB so replay and retries always use the current source of truth.
    const webhookEvent = await this.webhookEventsService.findByIdForTenant(
      String(jobRecord.webhookEventId),
      job.data.tenantId,
    );
    if (!webhookEvent) {
      throw new Error(`Webhook event ${job.data.webhookEventId} not found for tenant`);
    }

    const rule = await this.automationRulesService.findByIdForTenant(
      String(jobRecord.ruleId),
      job.data.tenantId,
    );
    if (!rule) {
      throw new Error(`Automation rule ${job.data.ruleId} not found for tenant`);
    }

    await this.jobRecordsService.markRunning(job.data.jobRecordId, job.data.tenantId);
    await this.maybeSleepForCrashDemo();

    const actionResults: JobRecordActionResult[] = [];
    const errors: string[] = [];

    for (const action of rule.actions) {
      const executedAt = new Date();

      try {
        const response = await this.actionsService.execute(action, webhookEvent.payload);
        actionResults.push({
          actionType: action.type,
          status: 'success',
          response,
          error: null,
          executedAt,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Action execution failed';

        actionResults.push({
          actionType: action.type,
          status: 'failed',
          response: null,
          error: message,
          executedAt,
        });
        errors.push(`${action.type}: ${message}`);
      }
    }

    await this.jobRecordsService.saveActionResults(
      job.data.jobRecordId,
      job.data.tenantId,
      actionResults,
    );

    if (errors.length > 0) {
      throw new Error(`One or more actions failed: ${errors.join(', ')}`);
    }

    await this.jobRecordsService.markCompleted(
      job.data.jobRecordId,
      job.data.tenantId,
      actionResults,
    );
  }

  private async maybeSleepForCrashDemo(): Promise<void> {
    const redisClient = await this.webhookEngineQueue.client;
    const slowNextJobFlag = await redisClient.get(DEBUG_SLOW_JOB_KEY);

    if (slowNextJobFlag !== '1') {
      return;
    }

    await redisClient.del(DEBUG_SLOW_JOB_KEY);
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
}
