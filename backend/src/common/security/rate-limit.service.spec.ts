import { RateLimitService } from './rate-limit.service';

const RATE_LIMIT_ENV = [
  'LOGIN_RATE_LIMIT_MAX',
  'LOGIN_RATE_LIMIT_WINDOW_SECONDS',
  'LOGIN_MAX_FAILURES',
  'LOGIN_FAILURE_WINDOW_SECONDS',
  'HIGH_RISK_RATE_LIMIT_MAX',
  'HIGH_RISK_RATE_LIMIT_WINDOW_SECONDS',
] as const;

describe('RateLimitService', () => {
  const originalEnv: Partial<Record<(typeof RATE_LIMIT_ENV)[number], string>> =
    {};

  beforeAll(() => {
    for (const key of RATE_LIMIT_ENV) {
      originalEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of RATE_LIMIT_ENV) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('locks login after configured failures and clears on reset', () => {
    process.env.LOGIN_MAX_FAILURES = '2';
    process.env.LOGIN_FAILURE_WINDOW_SECONDS = '60';
    process.env.LOGIN_RATE_LIMIT_MAX = '20';
    const service = new RateLimitService();

    service.recordLoginFailure('127.0.0.1', 'admin');
    expect(() =>
      service.assertLoginNotLocked('127.0.0.1', 'admin'),
    ).not.toThrow();
    service.recordLoginFailure('127.0.0.1', 'admin');
    expect(() => service.assertLoginNotLocked('127.0.0.1', 'admin')).toThrow();

    service.clearLoginFailures('127.0.0.1', 'admin');
    expect(() =>
      service.assertLoginNotLocked('127.0.0.1', 'admin'),
    ).not.toThrow();
  });

  it('rate-limits login and high-risk buckets separately', () => {
    process.env.LOGIN_RATE_LIMIT_MAX = '2';
    process.env.HIGH_RISK_RATE_LIMIT_MAX = '1';
    const service = new RateLimitService();

    expect(() => service.consumeLogin('10.0.0.1')).not.toThrow();
    expect(() => service.consumeLogin('10.0.0.1')).not.toThrow();
    expect(() => service.consumeLogin('10.0.0.1')).toThrow();
    expect(() => service.consumeHighRisk('accept', '10.0.0.1')).not.toThrow();
    expect(() => service.consumeHighRisk('accept', '10.0.0.1')).toThrow();
    expect(() => service.consumeHighRisk('publish', '10.0.0.1')).not.toThrow();
  });
});
