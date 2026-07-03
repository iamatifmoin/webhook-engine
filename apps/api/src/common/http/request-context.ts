import type { Request } from 'express';
import type { TenantDocument } from '../../modules/tenants/tenants.schema';
import type { WebhookSourceDocument } from '../../modules/webhook-sources/webhook-sources.schema';

export interface RequestWithTenantContext extends Request {
  rawBody?: Buffer;
  source?: WebhookSourceDocument;
  tenant?: TenantDocument;
  tenantId?: string;
}
