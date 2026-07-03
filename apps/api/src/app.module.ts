import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { ActionsModule } from './modules/actions/actions.module';
import { AutomationRulesModule } from './modules/automation-rules/automation-rules.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { JobRecordsModule } from './modules/job-records/job-records.module';
import { QueueModule } from './modules/queue/queue.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { WebhookEventsModule } from './modules/webhook-events/webhook-events.module';
import { WebhookSourcesModule } from './modules/webhook-sources/webhook-sources.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/debales-webhook'),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    ActionsModule,
    TenantsModule,
    WebhookSourcesModule,
    AutomationRulesModule,
    WebhookEventsModule,
    JobRecordsModule,
    QueueModule,
    IngestionModule,
    DashboardModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
