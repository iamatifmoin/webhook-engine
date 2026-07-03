import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function sha256Hex(...parts: Array<Buffer | string>): string {
  const hash = createHash('sha256');

  for (const part of parts) {
    hash.update(part);
  }

  return hash.digest('hex');
}

export function hmacSha256Base64(value: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64');
}

export function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
