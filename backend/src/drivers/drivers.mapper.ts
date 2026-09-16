import { Driver, UserStatus, DriverOnlineStatus, Prisma } from '@prisma/client';

export type DriverWithUser = Driver & {
  user: {
    username: string;
    status: UserStatus;
  };
};

export type DriverResponse = {
  id: string;
  username: string;
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_color: string;
  online_status: DriverOnlineStatus;
  status: UserStatus;
};

export type DriverLocationResponse = {
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
};

export type OnlineDriverLocationResponse = {
  id: string;
  username: string;
  license_plate: string;
  online_status: 'ONLINE';
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
};

function decimalNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  return value == null ? null : value.toNumber();
}

function isoOrNull(value: Date | null | undefined): string | null {
  return value == null ? null : value.toISOString();
}

export function toDriverResponse(driver: DriverWithUser): DriverResponse {
  return {
    id: driver.id,
    username: driver.user.username,
    license_plate: driver.licensePlate,
    vehicle_brand: driver.vehicleBrand,
    vehicle_model: driver.vehicleModel,
    vehicle_color: driver.vehicleColor,
    online_status: driver.onlineStatus,
    status: driver.user.status,
  };
}

export function toDriverLocationResponse(driver: {
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  locationUpdatedAt: Date | null;
}): DriverLocationResponse {
  return {
    latitude: decimalNumber(driver.latitude),
    longitude: decimalNumber(driver.longitude),
    location_updated_at: isoOrNull(driver.locationUpdatedAt),
  };
}

export function toOnlineDriverLocationResponse(driver: {
  id: string;
  licensePlate: string;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  locationUpdatedAt: Date | null;
  user: { username: string };
}): OnlineDriverLocationResponse {
  return {
    id: driver.id,
    username: driver.user.username,
    license_plate: driver.licensePlate,
    online_status: 'ONLINE',
    latitude: decimalNumber(driver.latitude),
    longitude: decimalNumber(driver.longitude),
    location_updated_at: isoOrNull(driver.locationUpdatedAt),
  };
}
