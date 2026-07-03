import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

@Injectable()
export class WebhookPayloadPipe implements PipeTransform {
  transform(value: unknown): Record<string, unknown> {
    if (!isPlainObject(value) || Object.keys(value).length === 0) {
      throw new BadRequestException('Malformed payload');
    }

    return value;
  }
}
