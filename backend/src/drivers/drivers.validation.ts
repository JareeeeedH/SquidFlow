import { DriverOnlineStatus, UserStatus } from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';

export type CreateDriverInput = {
  username: string;
  password: string;
  licensePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
};

export type UpdateDriverInput = {
  username: string;
  password?: string;
  licensePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
};

function asRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw AppErrors.validation();
  }
  return body as Record<string, unknown>;
}

function requireString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw AppErrors.validation(`${field} 為必填`);
  }
  return value.trim();
}

function requirePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw AppErrors.validation('password 為必填');
  }
  return value;
}

export function parseCreateDriverBody(body: unknown): CreateDriverInput {
  const data = asRecord(body);
  return {
    username: requireString(data, 'username'),
    password: requirePassword(data.password),
    licensePlate: requireString(data, 'license_plate'),
    vehicleBrand: requireString(data, 'vehicle_brand'),
    vehicleModel: requireString(data, 'vehicle_model'),
    vehicleColor: requireString(data, 'vehicle_color'),
  };
}

export function parseUpdateDriverBody(body: unknown): UpdateDriverInput {
  const data = asRecord(body);
  const input: UpdateDriverInput = {
    username: requireString(data, 'username'),
    licensePlate: requireString(data, 'license_plate'),
    vehicleBrand: requireString(data, 'vehicle_brand'),
    vehicleModel: requireString(data, 'vehicle_model'),
    vehicleColor: requireString(data, 'vehicle_color'),
  };

  if (Object.prototype.hasOwnProperty.call(data, 'password')) {
    input.password = requirePassword(data.password);
  }

  return input;
}

export function parseUpdateDriverStatusBody(body: unknown): UserStatus {
  const data = asRecord(body);
  if (
    data.status === UserStatus.ACTIVE ||
    data.status === UserStatus.SUSPENDED
  ) {
    return data.status;
  }
  throw AppErrors.validation('status 必須為 ACTIVE 或 SUSPENDED');
}

export function parseUpdateOnlineStatusBody(body: unknown): DriverOnlineStatus {
  const data = asRecord(body);
  if (
    data.status === DriverOnlineStatus.ONLINE ||
    data.status === DriverOnlineStatus.OFFLINE
  ) {
    return data.status;
  }
  throw AppErrors.validation('status 必須為 ONLINE 或 OFFLINE');
}
