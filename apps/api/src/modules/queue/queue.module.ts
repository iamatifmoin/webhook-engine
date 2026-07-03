import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { ActionsModule } from '../actions/actions.module';
import { AutomationRulesModule } from '../automation-rules/automation-rules.module';
import { JobRecordsService } from '../job-records/job-records.service';
import { JobRecordsModule } from '../job-records/job-records.module';
import { WebhookEventsModule } from '../webhook-events/webhook-events.module';
import { DispatchProcessor } from './processors/dispatch.processor';
import { EvaluateProcessor } from './processors/evaluate.processor';
import { WEBHOOK_ENGINE_QUEUE } from './queue.constants';
import {
  DISPATCH_ACTIONS_JOB,
  DispatchActionsJobData,
  EVALUATE_RULES_JOB,
  EvaluateRulesJobData,
} from './queue.constants';
import { QueueDebugController } from './queue-debug.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: WEBHOOK_ENGINE_QUEUE,
    }),
    ActionsModule,
    AutomationRulesModule,
    JobRecordsModule,
    WebhookEventsModule,
  ],
  controllers: [QueueDebugController],
  providers: [EvaluateProcessor, DispatchProcessor],
  exports: [BullModule],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<DispatchActionsJobData | EvaluateRulesJobData>;

  constructor(
    private readonly dispatchProcessor: DispatchProcessor,
    private readonly evaluateProcessor: EvaluateProcessor,
    private readonly jobRecordsService: JobRecordsService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<DispatchActionsJobData | EvaluateRulesJobData>(
      WEBHOOK_ENGINE_QUEUE,
      async (job) => {
        if (job.name === EVALUATE_RULES_JOB) {
          await this.evaluateProcessor.process(job as Job<EvaluateRulesJobData>);
          return;
        }

        if (job.name === DISPATCH_ACTIONS_JOB) {
          await this.dispatchProcessor.process(job as Job<DispatchActionsJobData>);
          return;
        }

        throw new Error(`Unsupported queue job "${job.name}"`);
      },
      {
        connection: {
          host: process.env.REDIS_HOST ?? '127.0.0.1',
          port: Number(process.env.REDIS_PORT ?? 6379),
        },
        concurrency: 10,
        stalledInterval: 10000,
        maxStalledCount: 1,
      },
    );

    this.worker.on('failed', async (job, error) => {
      if (!job || job.name !== DISPATCH_ACTIONS_JOB) {
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade < maxAttempts) {
        return;
      }

      const jobData = job.data as DispatchActionsJobData;
      await this.jobRecordsService.markFailed(
        jobData.jobRecordId,
        jobData.tenantId,
        error?.message ?? 'Dispatch job failed',
      );
    });

    this.worker.on('completed', async (job) => {
      if (!job || job.name !== DISPATCH_ACTIONS_JOB) {
        return;
      }

      const jobData = job.data as DispatchActionsJobData;
      await this.jobRecordsService.markCompleted(jobData.jobRecordId, jobData.tenantId);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
