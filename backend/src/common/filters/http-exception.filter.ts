import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { AppError } from '../errors/app.error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      response.status(exception.getStatus()).json({
        success: false,
        error: {
          code: exception.errorCode,
          message: exception.message,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        success: false,
        error: {
          code: status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR',
          message:
            typeof exception.message === 'string'
              ? exception.message
              : '請求失敗',
        },
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`Database request failed: ${exception.code}`);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '系統發生錯誤',
        },
      });
      return;
    }

    this.logger.error('Unhandled exception');
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '系統發生錯誤',
      },
    });
  }
}
