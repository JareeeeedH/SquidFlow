import type { INestApplication } from '@nestjs/common';
import {
  isCorsOriginAllowed,
  isTrustProxyEnabled,
  parseFrontendOrigins,
} from './security.config';

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

export function corsOptions(env: NodeJS.ProcessEnv = process.env) {
  const allowlist = parseFrontendOrigins(env);
  return {
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      callback(null, isCorsOriginAllowed(origin, allowlist));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  };
}

export function applyTrustProxy(
  app: INestApplication,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isTrustProxyEnabled(env)) {
    return;
  }
  const instance = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  instance.set?.('trust proxy', 1);
}
