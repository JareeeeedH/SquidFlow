export type RateLimitSettings = {
  loginMax: number;
  loginWindowMs: number;
  loginFailureMax: number;
  loginFailureWindowMs: number;
  highRiskMax: number;
  highRiskWindowMs: number;
};

export const JSON_BODY_LIMIT = '100kb';

export const DEV_FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

export function isTrustProxyEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = env.TRUST_PROXY?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

export function parseFrontendOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const raw = env.FRONTEND_ORIGIN?.trim() ?? '';
  if (raw.length > 0) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (isProductionEnv(env)) {
    return [];
  }
  return [...DEV_FRONTEND_ORIGINS];
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowlist: string[],
): boolean {
  if (!origin) {
    return true;
  }
  return allowlist.includes(origin);
}

export function loadRateLimitSettings(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitSettings {
  const production = isProductionEnv(env);
  return {
    loginMax: envInt(env, 'LOGIN_RATE_LIMIT_MAX', production ? 20 : 1000),
    loginWindowMs:
      envInt(env, 'LOGIN_RATE_LIMIT_WINDOW_SECONDS', production ? 900 : 60) *
      1000,
    loginFailureMax: envInt(env, 'LOGIN_MAX_FAILURES', production ? 5 : 1000),
    loginFailureWindowMs:
      envInt(env, 'LOGIN_FAILURE_WINDOW_SECONDS', production ? 900 : 900) *
      1000,
    highRiskMax: envInt(
      env,
      'HIGH_RISK_RATE_LIMIT_MAX',
      production ? 30 : 1000,
    ),
    highRiskWindowMs:
      envInt(env, 'HIGH_RISK_RATE_LIMIT_WINDOW_SECONDS', production ? 60 : 60) *
      1000,
  };
}

function envInt(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const parsed = Number(env[name]);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}
