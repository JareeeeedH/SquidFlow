import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { applyTrustProxy, corsOptions } from './common/security/cors';
import { JSON_BODY_LIMIT } from './common/security/security.config';
import { securityHeadersMiddleware } from './common/security/security-headers';

type BodyParserApp = INestApplication & {
  useBodyParser?: (parser: 'json' | 'urlencoded', options: object) => void;
};

export function setupApp(app: INestApplication): void {
  applyTrustProxy(app);
  const nestApp = app as BodyParserApp;
  if (typeof nestApp.useBodyParser === 'function') {
    nestApp.useBodyParser('json', { limit: JSON_BODY_LIMIT });
    nestApp.useBodyParser('urlencoded', {
      limit: JSON_BODY_LIMIT,
      extended: true,
    });
  }
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.use(securityHeadersMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors(corsOptions());
}
