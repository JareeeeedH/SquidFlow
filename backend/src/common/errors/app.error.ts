import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  readonly errorCode: string;

  constructor(errorCode: string, message: string, status: HttpStatus) {
    super(message, status);
    this.errorCode = errorCode;
  }
}

export const AppErrors = {
  unauthorized: () =>
    new AppError('UNAUTHORIZED', '未授權', HttpStatus.UNAUTHORIZED),
  invalidCredentials: () =>
    new AppError(
      'INVALID_CREDENTIALS',
      '帳號或密碼錯誤',
      HttpStatus.UNAUTHORIZED,
    ),
  accountSuspended: () =>
    new AppError('ACCOUNT_SUSPENDED', '帳號已停用', HttpStatus.FORBIDDEN),
  forbidden: () => new AppError('FORBIDDEN', '沒有權限', HttpStatus.FORBIDDEN),
  notFound: (message = '找不到資料') =>
    new AppError('NOT_FOUND', message, HttpStatus.NOT_FOUND),
  validation: (message = '請求資料不正確') =>
    new AppError('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST),
  usernameAlreadyExists: () =>
    new AppError('USERNAME_ALREADY_EXISTS', '帳號已存在', HttpStatus.CONFLICT),
  licensePlateAlreadyExists: () =>
    new AppError(
      'LICENSE_PLATE_ALREADY_EXISTS',
      '車牌已存在',
      HttpStatus.CONFLICT,
    ),
  invalidOrderStatus: () =>
    new AppError(
      'INVALID_ORDER_STATUS',
      '訂單狀態不允許此操作',
      HttpStatus.CONFLICT,
    ),
  orderAlreadyAccepted: () =>
    new AppError(
      'ORDER_ALREADY_ACCEPTED',
      '此訂單已被其他司機接單',
      HttpStatus.CONFLICT,
    ),
  driverOffline: () =>
    new AppError(
      'DRIVER_OFFLINE',
      '司機目前為離線，無法接單',
      HttpStatus.CONFLICT,
    ),
  driverHasActiveOrder: () =>
    new AppError(
      'DRIVER_HAS_ACTIVE_ORDER',
      '司機尚有未完成訂單，無法接單',
      HttpStatus.CONFLICT,
    ),
  tooManyRequests: () =>
    new AppError(
      'TOO_MANY_REQUESTS',
      '請求過於頻繁，請稍後再試',
      HttpStatus.TOO_MANY_REQUESTS,
    ),
};
