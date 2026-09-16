import { Injectable } from '@nestjs/common';
import { DriverOnlineStatus, Prisma } from '@prisma/client';
import { AppErrors } from '../common/errors/app.error';
import { GeocodingService } from '../geocoding/geocoding.service';
import { PickupCoordinates } from '../geocoding/geocoding.types';
import { PrismaService } from '../prisma/prisma.service';
import { haversineMeters } from './haversine';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type OnlineDriverDistanceItem = {
  id: string;
  username: string;
  license_plate: string;
  online_status: 'ONLINE';
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
  distance_meters: number | null;
};

function decimalToNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  return value == null ? null : value.toNumber();
}

function coordsFromDriver(driver: {
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
}): LatLng | null {
  const latitude = decimalToNumber(driver.latitude);
  const longitude = decimalToNumber(driver.longitude);
  if (latitude == null || longitude == null) {
    return null;
  }
  return { latitude, longitude };
}

@Injectable()
export class DistanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocodingService: GeocodingService,
  ) {}

  /**
   * Straight-line meters, or null when either coordinate set is missing.
   * Does not call Google Routes / compute road distance / ETA.
   */
  straightLineMeters(
    driver: LatLng | null,
    pickup: PickupCoordinates | null,
  ): number | null {
    if (!driver || !pickup) {
      return null;
    }
    return haversineMeters(
      driver.latitude,
      driver.longitude,
      pickup.latitude,
      pickup.longitude,
    );
  }

  async metersForOrder(
    driverCoords: LatLng | null,
    orderId: string,
    pickupLocation: string,
  ): Promise<number | null> {
    if (!driverCoords) {
      return null;
    }
    const pickup = await this.geocodingService.getPickupCoordinates(
      orderId,
      pickupLocation,
    );
    return this.straightLineMeters(driverCoords, pickup);
  }

  /**
   * Admin: ONLINE Drivers ↔ Order Pickup straight-line distances.
   */
  async listOnlineDriverDistancesForOrder(
    orderId: string,
  ): Promise<OnlineDriverDistanceItem[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        pickupLocation: true,
      },
    });
    if (!order) {
      throw AppErrors.notFound('找不到訂單');
    }

    const pickup = await this.geocodingService.getPickupCoordinates(
      order.id,
      order.pickupLocation,
    );

    const drivers = await this.prisma.driver.findMany({
      where: {
        onlineStatus: DriverOnlineStatus.ONLINE,
      },
      select: {
        id: true,
        licensePlate: true,
        latitude: true,
        longitude: true,
        locationUpdatedAt: true,
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return drivers.map((driver) => {
      const driverCoords = coordsFromDriver(driver);
      return {
        id: driver.id,
        username: driver.user.username,
        license_plate: driver.licensePlate,
        online_status: 'ONLINE' as const,
        latitude: driverCoords?.latitude ?? null,
        longitude: driverCoords?.longitude ?? null,
        location_updated_at: driver.locationUpdatedAt
          ? driver.locationUpdatedAt.toISOString()
          : null,
        distance_meters: this.straightLineMeters(driverCoords, pickup),
      };
    });
  }

  coordsFromDecimals(
    latitude: Prisma.Decimal | null,
    longitude: Prisma.Decimal | null,
  ): LatLng | null {
    return coordsFromDriver({ latitude, longitude });
  }
}
