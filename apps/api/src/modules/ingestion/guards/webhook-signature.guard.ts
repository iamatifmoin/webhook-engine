import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RequestWithTenantContext } from '../../../common/http/request-context';
import { hmacSha256Base64, sha256Hex, timingSafeEqualString } from '../../../common/utils/crypto';
import { WebhookSourcePlatform } from '../../webhook-sources/webhook-sources.schema';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();
    const source = request.source;

    if (!source?.signingSecret) {
      return true;
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Invalid signature');
    }

    const signature =
      source.platform === WebhookSourcePlatform.Shopify
        ? request.header('x-shopify-hmac-sha256')?.trim()
        : request.header('x-webhook-signature')?.trim();

    if (!signature) {
      throw new BadRequestException('Invalid signature');
    }

    const expectedSignature =
      source.platform === WebhookSourcePlatform.Shopify
        ? hmacSha256Base64(rawBody, source.signingSecret)
        : sha256Hex(rawBody, source.signingSecret);

    if (!timingSafeEqualString(signature, expectedSignature)) {
      throw new BadRequestException('Invalid signature');
    }

    return true;
  }
}
