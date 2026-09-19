import { Test, TestingModule } from '@nestjs/testing';
import {
  DriverOnlineStatus,
  OrderStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { DistanceService } from '../distance/distance.service';
import { WaveDispatchService } from '../dispatch/wave-dispatch.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService distance hooks (P2-03)', () => {
  let service: OrdersService;
  const prisma = {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    driver: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const waveDispatchService = {
    startAfterPublish: jest.fn().mockResolvedValue(undefined),
  };
  const geocodingService = {
    scheduleGeocode: jest.fn(),
    invalidateOrder: jest.fn(),
    getPickupCoordinates: jest.fn().mockResolvedValue(null),
  };
  const distanceService = {
    metersForOrder: jest.fn(),
    listOnlineDriverDistancesForOrder: jest.fn(),
    coordsFromDecimals: jest.fn(),
    straightLineMeters: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: WaveDispatchService, useValue: waveDispatchService },
        { provide: GeocodingService, useValue: geocodingService },
        { provide: DistanceService, useValue: distanceService },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  function driverUser(): AuthenticatedUser {
    return {
      id: 'user-1',
      username: 'driver-one',
      role: UserRole.DRIVER,
      status: UserStatus.ACTIVE,
    };
  }

  function driverRow(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      id: 'driver-1',
      onlineStatus: DriverOnlineStatus.ONLINE,
      latitude: new Prisma.Decimal('22.687'),
      longitude: new Prisma.Decimal('120.307'),
      orders: [],
      ...overrides,
    };
  }

  it('attaches distance_meters on open orders for the current driver only', async () => {
    prisma.driver.findUnique.mockResolvedValue(driverRow());
    distanceService.coordsFromDecimals.mockReturnValue({
      latitude: 22.687,
      longitude: 120.307,
    });
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        orderNo: 'SF-1',
        createdAt: new Date('2026-09-16T01:00:00.000Z'),
        pickupLocation: '左營高鐵站',
        destination: '小港',
        price: new Prisma.Decimal(100),
        note: null,
      },
    ]);
    distanceService.metersForOrder.mockResolvedValue(2450.5);

    const result = await service.listOpenForDriver(driverUser());

    expect(distanceService.metersForOrder).toHaveBeenCalledWith(
      { latitude: 22.687, longitude: 120.307 },
      'order-1',
      '左營高鐵站',
    );
    expect(result[0]).toMatchObject({
      id: 'order-1',
      distance_meters: 2450.5,
    });
  });

  it('returns null distance on my orders that are COMPLETED', async () => {
    prisma.driver.findUnique.mockResolvedValue(driverRow());
    distanceService.coordsFromDecimals.mockReturnValue({
      latitude: 22.687,
      longitude: 120.307,
    });
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order-done',
        orderNo: 'SF-2',
        createdAt: new Date('2026-09-16T01:00:00.000Z'),
        pickupLocation: '左營高鐵站',
        destination: null,
        price: null,
        status: OrderStatus.COMPLETED,
      },
    ]);

    const result = await service.listMine(driverUser(), {});

    expect(distanceService.metersForOrder).not.toHaveBeenCalled();
    expect(result[0].distance_meters).toBeNull();
  });

  it('hides other drivers orders without exposing their distance', async () => {
    prisma.driver.findUnique.mockResolvedValue(driverRow());
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-other',
      orderNo: 'SF-3',
      customerName: null,
      pickupLocation: '高雄車站',
      destination: null,
      createdAt: new Date('2026-09-16T01:00:00.000Z'),
      price: null,
      note: null,
      status: OrderStatus.ACCEPTED,
      driverId: 'driver-other',
    });

    await expect(
      service.getForDriver(driverUser(), 'order-other'),
    ).rejects.toMatchObject({ errorCode: 'NOT_FOUND' });
    expect(distanceService.metersForOrder).not.toHaveBeenCalled();
  });

  it('delegates admin online-driver-distances without mutating order state', async () => {
    distanceService.listOnlineDriverDistancesForOrder.mockResolvedValue([
      {
        id: 'driver-1',
        username: 'driver01',
        license_plate: 'ABC-1234',
        online_status: 'ONLINE',
        latitude: 22.687,
        longitude: 120.307,
        location_updated_at: '2026-09-16T01:00:00.000Z',
        distance_meters: 100,
      },
    ]);

    await expect(
      service.listOnlineDriverDistances('order-1'),
    ).resolves.toHaveLength(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(
      distanceService.listOnlineDriverDistancesForOrder,
    ).toHaveBeenCalledWith('order-1');
  });

  it('includes ephemeral pickup coordinates on driver order detail', async () => {
    prisma.driver.findUnique.mockResolvedValue(driverRow());
    distanceService.coordsFromDecimals.mockReturnValue({
      latitude: 22.687,
      longitude: 120.307,
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SF-1',
      customerName: null,
      pickupLocation: '左營高鐵站',
      destination: null,
      createdAt: new Date('2026-09-16T01:00:00.000Z'),
      price: null,
      note: null,
      status: OrderStatus.OPEN,
      driverId: null,
    });
    distanceService.metersForOrder.mockResolvedValue(100);
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.7,
      longitude: 120.3,
    });

    await expect(
      service.getForDriver(driverUser(), 'order-1'),
    ).resolves.toMatchObject({
      distance_meters: 100,
      pickup_latitude: 22.7,
      pickup_longitude: 120.3,
    });
    expect(geocodingService.getPickupCoordinates).toHaveBeenCalledWith(
      'order-1',
      '左營高鐵站',
    );
  });
});
