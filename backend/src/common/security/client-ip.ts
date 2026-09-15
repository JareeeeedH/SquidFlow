import type { Request } from 'express';

export function clientIp(request: Request): string {
  return request.ip || request.socket?.remoteAddress || 'unknown';
}
