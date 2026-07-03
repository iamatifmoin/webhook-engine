import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RequestWithTenantContext } from '../../common/http/request-context';
import { sha256Hex } from '../../common/utils/crypto';
import { Tenant, TenantDocument } from '../tenants/tenants.schema';

@Injectable()
export class DashboardGuard implements CanActivate {
  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();
    const incomingApiKey = request.header('x-tenant-api-key')?.trim();

    if (!incomingApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const tenant = await this.tenantModel
      .findOne({
        apiKeyHash: sha256Hex(incomingApiKey),
      })
      .exec();

    if (!tenant) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.tenant = tenant;
    request.tenantId = String(tenant._id);

    return true;
  }
}
