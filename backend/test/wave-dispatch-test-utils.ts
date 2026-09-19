import { Prisma } from '@prisma/client';
import { GeocodingService } from '../src/geocoding/geocoding.service';
import {
  DEFAULT_WAVE_DISPATCH_OPTIONS,
  WAVE_DISPATCH_OPTIONS,
} from '../src/dispatch/wave-dispatch.constants';

/** Fixed Pickup used when GeocodingService is overridden in e2e. */
export const WAVE_TEST_PICKUP = {
  latitude: 22.687_2,
  longitude: 120.307_4,
};

export function waveDispatchTestProviders(intervalMs = 30) {
  return [
    {
      provide: WAVE_DISPATCH_OPTIONS,
      useValue: {
        ...DEFAULT_WAVE_DISPATCH_OPTIONS,
        intervalMs,
      },
    },
  ] as const;
}

export function overrideGeocodingForWaveTests() {
  return {
    provide: GeocodingService,
    useValue: {
      scheduleGeocode: jest.fn(),
      invalidateOrder: jest.fn(),
      getPickupCoordinates: jest
        .fn()
        .mockResolvedValue({ ...WAVE_TEST_PICKUP }),
      ensureGeocoded: jest.fn().mockResolvedValue({
        ok: true,
        coordinates: { ...WAVE_TEST_PICKUP },
      }),
      peekCached: jest.fn(),
    },
  };
}

/** Place driver near pickup; offsetDegrees ~0.001 ≈ 100m+. */
export async function setDriverGps(
  prisma: {
    driver: {
      update: (args: {
        where: { id: string };
        data: {
          latitude: Prisma.Decimal;
          longitude: Prisma.Decimal;
          locationUpdatedAt: Date;
        };
      }) => Promise<unknown>;
    };
  },
  driverId: string,
  offsetDegrees = 0.001,
) {
  await prisma.driver.update({
    where: { id: driverId },
    data: {
      latitude: new Prisma.Decimal(WAVE_TEST_PICKUP.latitude + offsetDegrees),
      longitude: new Prisma.Decimal(WAVE_TEST_PICKUP.longitude),
      locationUpdatedAt: new Date(),
    },
  });
}
