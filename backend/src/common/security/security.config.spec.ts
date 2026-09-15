import {
  DEV_FRONTEND_ORIGINS,
  isCorsOriginAllowed,
  isProductionEnv,
  isTrustProxyEnabled,
  loadRateLimitSettings,
  parseFrontendOrigins,
} from './security.config';

describe('security.config', () => {
  it('treats only NODE_ENV=production as production', () => {
    expect(isProductionEnv({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionEnv({ NODE_ENV: 'test' })).toBe(false);
    expect(isProductionEnv({ NODE_ENV: 'development' })).toBe(false);
  });

  it('enables trust proxy only for explicit 1/true', () => {
    expect(isTrustProxyEnabled({ TRUST_PROXY: '1' })).toBe(true);
    expect(isTrustProxyEnabled({ TRUST_PROXY: 'true' })).toBe(true);
    expect(isTrustProxyEnabled({ TRUST_PROXY: 'TRUE' })).toBe(true);
    expect(isTrustProxyEnabled({ TRUST_PROXY: '0' })).toBe(false);
    expect(isTrustProxyEnabled({})).toBe(false);
  });

  it('parses FRONTEND_ORIGIN allowlist and fails closed in production', () => {
    expect(
      parseFrontendOrigins({
        FRONTEND_ORIGIN: 'https://app.example.com, https://admin.example.com',
      }),
    ).toEqual(['https://app.example.com', 'https://admin.example.com']);
    expect(parseFrontendOrigins({ NODE_ENV: 'production' })).toEqual([]);
    expect(parseFrontendOrigins({ NODE_ENV: 'test' })).toEqual([
      ...DEV_FRONTEND_ORIGINS,
    ]);
  });

  it('allows requests without Origin and rejects unknown origins', () => {
    const allowlist = ['https://app.example.com'];
    expect(isCorsOriginAllowed(undefined, allowlist)).toBe(true);
    expect(isCorsOriginAllowed('https://app.example.com', allowlist)).toBe(
      true,
    );
    expect(isCorsOriginAllowed('https://evil.example', allowlist)).toBe(false);
  });

  it('uses tighter production rate-limit defaults than development', () => {
    const production = loadRateLimitSettings({ NODE_ENV: 'production' });
    const development = loadRateLimitSettings({ NODE_ENV: 'development' });

    expect(production.loginMax).toBeLessThan(development.loginMax);
    expect(production.loginFailureMax).toBeLessThan(
      development.loginFailureMax,
    );
    expect(production.highRiskMax).toBeLessThan(development.highRiskMax);
  });

  it('reads rate-limit overrides from env', () => {
    const settings = loadRateLimitSettings({
      NODE_ENV: 'production',
      LOGIN_RATE_LIMIT_MAX: '7',
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: '30',
      LOGIN_MAX_FAILURES: '3',
      LOGIN_FAILURE_WINDOW_SECONDS: '60',
      HIGH_RISK_RATE_LIMIT_MAX: '4',
      HIGH_RISK_RATE_LIMIT_WINDOW_SECONDS: '15',
    });

    expect(settings).toEqual({
      loginMax: 7,
      loginWindowMs: 30_000,
      loginFailureMax: 3,
      loginFailureWindowMs: 60_000,
      highRiskMax: 4,
      highRiskWindowMs: 15_000,
    });
  });
});
