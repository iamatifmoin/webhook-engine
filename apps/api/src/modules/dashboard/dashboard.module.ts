import { Module } from '@nestjs/common';
import { AutomationRulesModule } from '../automation-rules/automation-rules.module';
import { JobRecordsModule } from '../job-records/job-records.module';
import { QueueModule } from '../queue/queue.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WebhookEventsModule } from '../webhook-events/webhook-events.module';
import { WebhookSourcesModule } from '../webhook-sources/webhook-sources.module';
import { AdminController } from './admin.controller';
import { DashboardController } from './dashboard.controller';
import { DashboardGuard } from './dashboard.guard';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AutomationRulesModule,
    JobRecordsModule,
    QueueModule,
    TenantsModule,
    WebhookEventsModule,
    WebhookSourcesModule,
  ],
  controllers: [AdminController, DashboardController],
  providers: [DashboardGuard, DashboardService],
})
export class DashboardModule {}
