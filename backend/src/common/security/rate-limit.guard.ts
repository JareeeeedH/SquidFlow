import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { clientIp } from './client-ip';
import {
  RATE_LIMIT_BUCKET_KEY,
  type RateLimitBucket,
} from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimits: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const bucket = this.reflector.getAllAndOverride<
      RateLimitBucket | undefined
    >(RATE_LIMIT_BUCKET_KEY, [context.getHandler(), context.getClass()]);
    if (!bucket) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = clientIp(request);
    if (bucket === 'login') {
      this.rateLimits.consumeLogin(ip);
      this.rateLimits.assertLoginNotLocked(ip, loginUsername(request));
      return true;
    }

    this.rateLimits.consumeHighRisk(bucket, ip);
    return true;
  }
}

function loginUsername(request: Request): string {
  const body = request.body as { username?: unknown };
  return typeof body?.username === 'string' ? body.username : '';
}
