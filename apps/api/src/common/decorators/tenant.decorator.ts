import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithTenantContext } from '../http/request-context';

export const Tenant = createParamDecorator(
  (data: 'id' | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();

    if (data === 'id') {
      return request.tenantId ?? (request.tenant ? String(request.tenant._id) : undefined);
    }

    return request.tenant;
  },
);
