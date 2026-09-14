import { Driver, UserStatus, DriverOnlineStatus } from '@prisma/client';

export type DriverWithUser = Driver & {
  user: {
    username: string;
    status: UserStatus;
  };
};

export type DriverResponse = {
  id: string;
  username: string;
  vehicle_type: string;
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_year: number;
  online_status: DriverOnlineStatus;
  status: UserStatus;
};

export function toDriverResponse(driver: DriverWithUser): DriverResponse {
  return {
    id: driver.id,
    username: driver.user.username,
    vehicle_type: driver.vehicleType,
    license_plate: driver.licensePlate,
    vehicle_brand: driver.vehicleBrand,
    vehicle_model: driver.vehicleModel,
    vehicle_color: driver.vehicleColor,
    vehicle_year: driver.vehicleYear,
    online_status: driver.onlineStatus,
    status: driver.user.status,
  };
}
