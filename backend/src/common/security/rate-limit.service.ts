import { Injectable } from '@nestjs/common';
import { AppErrors } from '../errors/app.error';
import { InMemoryRateLimiter } from './in-memory-rate-limiter';
import {
  loadRateLimitSettings,
  type RateLimitSettings,
} from './security.config';

export type HighRiskBucket = 'accept' | 'publish' | 'cancel';

@Injectable()
export class RateLimitService {
  private readonly limiter = new InMemoryRateLimiter();
  private readonly settings: RateLimitSettings;

  constructor() {
    this.settings = loadRateLimitSettings();
  }

  consumeLogin(ip: string): void {
    const allowed = this.limiter.consume(
      loginRateKey(ip),
      this.settings.loginMax,
      this.settings.loginWindowMs,
    );
    if (!allowed) {
      throw AppErrors.tooManyRequests();
    }
  }

  assertLoginNotLocked(ip: string, username: string): void {
    if (
      this.limiter.isLimited(
        loginFailureKey(ip, username),
        this.settings.loginFailureMax,
      )
    ) {
      throw AppErrors.tooManyRequests();
    }
  }

  recordLoginFailure(ip: string, username: string): void {
    this.limiter.consume(
      loginFailureKey(ip, username),
      this.settings.loginFailureMax,
      this.settings.loginFailureWindowMs,
    );
  }

  clearLoginFailures(ip: string, username: string): void {
    this.limiter.reset(loginFailureKey(ip, username));
  }

  consumeHighRisk(bucket: HighRiskBucket, ip: string): void {
    const allowed = this.limiter.consume(
      highRiskKey(bucket, ip),
      this.settings.highRiskMax,
      this.settings.highRiskWindowMs,
    );
    if (!allowed) {
      throw AppErrors.tooManyRequests();
    }
  }

  resetAll(): void {
    this.limiter.clear();
  }
}

function loginRateKey(ip: string): string {
  return `login-rate:${ip}`;
}

function loginFailureKey(ip: string, username: string): string {
  return `login-fail:${ip}:${username}`;
}

function highRiskKey(bucket: HighRiskBucket, ip: string): string {
  return `high:${bucket}:${ip}`;
}
