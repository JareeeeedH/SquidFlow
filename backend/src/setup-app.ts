import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors();
}
