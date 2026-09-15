import type { NextFunction, Request, Response } from 'express';
import { isProductionEnv } from './security.config';

export const API_CONTENT_SECURITY_POLICY =
  "default-src 'none'; frame-ancestors 'none'";

export function buildSecurityHeaders(
  isProduction: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': API_CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  };
  if (isProduction) {
    headers['Strict-Transport-Security'] =
      'max-age=31536000; includeSubDomains';
  }
  return headers;
}

export function securityHeadersMiddleware(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  const headers = buildSecurityHeaders(isProductionEnv());
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
  next();
}
