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
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_color: string;
  online_status: DriverOnlineStatus;
  status: UserStatus;
};

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
