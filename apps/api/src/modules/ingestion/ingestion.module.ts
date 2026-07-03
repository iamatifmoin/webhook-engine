import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WebhookEventsModule } from '../webhook-events/webhook-events.module';
import { WebhookSourcesModule } from '../webhook-sources/webhook-sources.module';
import { IngestionController } from './ingestion.controller';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { WebhookSourceGuard } from './guards/webhook-source.guard';
import { IngestionService } from './ingestion.service';
import { WebhookPayloadPipe } from './pipes/webhook-payload.pipe';

@Module({
  imports: [TenantsModule, WebhookSourcesModule, WebhookEventsModule, QueueModule],
  controllers: [IngestionController],
  providers: [IngestionService, WebhookSourceGuard, WebhookSignatureGuard, WebhookPayloadPipe],
})
export class IngestionModule {}
