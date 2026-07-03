import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RequestWithTenantContext } from '../../../common/http/request-context';
import { sha256Hex } from '../../../common/utils/crypto';
import { Tenant, TenantDocument } from '../../tenants/tenants.schema';
import { WebhookSource, WebhookSourceDocument } from '../../webhook-sources/webhook-sources.schema';

@Injectable()
export class WebhookSourceGuard implements CanActivate {
  constructor(
    @InjectModel(WebhookSource.name)
    private readonly webhookSourceModel: Model<WebhookSourceDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();
    const sourceSlug = request.params.sourceSlug;
    const incomingApiKey = request.header('x-tenant-api-key')?.trim();

    // Resolve the source before any payload parsing so spoofed requests fail before work reaches the database.
    const source = await this.webhookSourceModel.findOne({ slug: sourceSlug }).exec();
    if (!source) {
      throw new NotFoundException('Webhook source not found');
    }

    const tenant = await this.tenantModel.findById(source.tenantId).exec();
    if (!tenant || !incomingApiKey || sha256Hex(incomingApiKey) !== tenant.apiKeyHash) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.source = source;
    request.tenant = tenant;
    request.tenantId = String(tenant._id);

    return true;
  }
}
