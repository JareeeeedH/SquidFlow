import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'squidflow_session';

const DEFAULT_SESSION_TTL_SECONDS = 86400;

export function getSessionTtlSeconds(): number {
  const parsed = Number(process.env.SESSION_TTL_SECONDS);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_SESSION_TTL_SECONDS;
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}
