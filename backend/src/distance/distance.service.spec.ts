import { DriverOnlineStatus, Prisma } from '@prisma/client';
import { GeocodingService } from '../geocoding/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';
import { DistanceService } from './distance.service';

describe('DistanceService', () => {
  let service: DistanceService;
  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
    driver: {
      findMany: jest.fn(),
    },
  };
  const geocodingService = {
    getPickupCoordinates: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DistanceService(
      prisma as unknown as PrismaService,
      geocodingService as unknown as GeocodingService,
    );
  });

  it('returns null when driver GPS is missing', () => {
    expect(
      service.straightLineMeters(null, {
        latitude: 22.687,
        longitude: 120.307,
      }),
    ).toBeNull();
  });

  it('returns null when pickup coordinates are missing', () => {
    expect(
      service.straightLineMeters(
        { latitude: 22.687, longitude: 120.307 },
        null,
      ),
    ).toBeNull();
  });

  it('returns zero when both points are identical', () => {
    const point = { latitude: 22.687, longitude: 120.307 };
    expect(service.straightLineMeters(point, point)).toBe(0);
  });

  it('metersForOrder returns null without calling geocoding when GPS missing', async () => {
    await expect(
      service.metersForOrder(null, 'order-1', '左營高鐵站'),
    ).resolves.toBeNull();
    expect(geocodingService.getPickupCoordinates).not.toHaveBeenCalled();
  });

  it('metersForOrder uses GeocodingService pickup coordinates', async () => {
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.687,
      longitude: 120.307,
    });

    const meters = await service.metersForOrder(
      { latitude: 22.687, longitude: 120.307 },
      'order-1',
      '左營高鐵站',
    );

    expect(geocodingService.getPickupCoordinates).toHaveBeenCalledWith(
      'order-1',
      '左營高鐵站',
    );
    expect(meters).toBe(0);
  });

  it('listOnlineDriverDistancesForOrder includes only ONLINE drivers', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      pickupLocation: '左營高鐵站',
    });
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.687,
      longitude: 120.307,
    });
    prisma.driver.findMany.mockResolvedValue([
      {
        id: 'driver-online',
        licensePlate: 'ABC-1234',
        latitude: new Prisma.Decimal('22.687'),
        longitude: new Prisma.Decimal('120.307'),
        locationUpdatedAt: new Date('2026-09-16T01:00:00.000Z'),
        user: { username: 'driver01' },
      },
      {
        id: 'driver-no-gps',
        licensePlate: 'XYZ-9999',
        latitude: null,
        longitude: null,
        locationUpdatedAt: null,
        user: { username: 'driver02' },
      },
    ]);

    const result = await service.listOnlineDriverDistancesForOrder('order-1');

    expect(prisma.driver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { onlineStatus: DriverOnlineStatus.ONLINE },
      }),
    );
    expect(result).toEqual([
      {
        id: 'driver-online',
        username: 'driver01',
        license_plate: 'ABC-1234',
        online_status: 'ONLINE',
        latitude: 22.687,
        longitude: 120.307,
        location_updated_at: '2026-09-16T01:00:00.000Z',
        distance_meters: 0,
      },
      {
        id: 'driver-no-gps',
        username: 'driver02',
        license_plate: 'XYZ-9999',
        online_status: 'ONLINE',
        latitude: null,
        longitude: null,
        location_updated_at: null,
        distance_meters: null,
      },
    ]);
  });

  it('listOnlineDriverDistancesForOrder throws when order is missing', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(
      service.listOnlineDriverDistancesForOrder('missing'),
    ).rejects.toMatchObject({ errorCode: 'NOT_FOUND' });
  });
});
