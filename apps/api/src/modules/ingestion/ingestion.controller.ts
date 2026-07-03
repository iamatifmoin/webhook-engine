import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { RequestWithTenantContext } from '../../common/http/request-context';
import { TenantDocument } from '../tenants/tenants.schema';
import { IngestionService } from './ingestion.service';
import { WebhookPayloadPipe } from './pipes/webhook-payload.pipe';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { WebhookSourceGuard } from './guards/webhook-source.guard';

@Controller('webhooks')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post(':sourceSlug')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookSourceGuard, WebhookSignatureGuard)
  ingestWebhook(
    @Tenant() tenant: TenantDocument,
    @Req() request: RequestWithTenantContext,
    @Body(WebhookPayloadPipe) body: Record<string, unknown>,
    @Headers('x-idempotency-key') idempotencyKeyHeader?: string,
    @Headers('x-event-type') eventTypeHeader?: string,
  ) {
    return this.ingestionService.ingest({
      tenant,
      source: request.source!,
      body,
      idempotencyKeyHeader,
      eventTypeHeader,
    });
  }
}
