import { Test, TestingModule } from '@nestjs/testing';
import {
  DriverOnlineStatus,
  NotificationStatus,
  OrderStatus,
} from '@prisma/client';
import { DistanceService } from '../distance/distance.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  WAVE_DISPATCH_OPTIONS,
  type WaveDispatchOptions,
} from './wave-dispatch.constants';
import { WaveDispatchService } from './wave-dispatch.service';

type CreateManyArgs = { data: unknown[] };

describe('WaveDispatchService', () => {
  let service: WaveDispatchService;
  const options: WaveDispatchOptions = { batchSize: 5, intervalMs: 10_000 };

  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
    driver: {
      findMany: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
  };

  function createManyCall(index: number): CreateManyArgs {
    const calls = prisma.notification.createMany.mock.calls as Array<
      [CreateManyArgs]
    >;
    const args = calls[index]?.[0];
    if (!args) {
      throw new Error(`createMany call ${index} missing`);
    }
    return args;
  }

  const geocodingService = {
    getPickupCoordinates: jest.fn(),
  };

  const distanceService = {
    coordsFromDecimals: jest.fn(
      (
        latitude: { toNumber: () => number } | null,
        longitude: { toNumber: () => number } | null,
      ) => {
        if (latitude == null || longitude == null) {
          return null;
        }
        return {
          latitude: latitude.toNumber(),
          longitude: longitude.toNumber(),
        };
      },
    ),
    straightLineMeters: jest.fn(
      (
        driver: { latitude: number; longitude: number } | null,
        pickup: { latitude: number; longitude: number } | null,
      ) => {
        if (!driver || !pickup) {
          return null;
        }
        // Deterministic stand-in: |Δlat| * 100_000 meters
        return Math.abs(driver.latitude - pickup.latitude) * 100_000;
      },
    ),
  };

  const notificationsService = {
    deliverPendingForOrder: jest.fn(),
  };

  function decimal(value: number) {
    return { toNumber: () => value };
  }

  function driverRow(userId: string, latitude: number) {
    return {
      userId,
      latitude: decimal(latitude),
      longitude: decimal(121),
    };
  }

  beforeEach(async () => {
    prisma.order.findUnique.mockReset();
    prisma.driver.findMany.mockReset();
    prisma.notification.createMany.mockReset();
    geocodingService.getPickupCoordinates.mockReset();
    distanceService.coordsFromDecimals.mockClear();
    distanceService.straightLineMeters.mockClear();
    notificationsService.deliverPendingForOrder.mockReset();
    notificationsService.deliverPendingForOrder.mockResolvedValue(undefined);
    prisma.notification.createMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaveDispatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: GeocodingService, useValue: geocodingService },
        { provide: DistanceService, useValue: distanceService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: WAVE_DISPATCH_OPTIONS, useValue: options },
      ],
    }).compile();

    service = module.get(WaveDispatchService);
  });

  it('notifies at most 5 drivers per wave ordered by distance', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.OPEN,
      pickupLocation: '左營',
    });
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.68,
      longitude: 120.3,
    });
    prisma.driver.findMany.mockResolvedValue([
      driverRow('u6', 22.74),
      driverRow('u1', 22.69),
      driverRow('u5', 22.73),
      driverRow('u2', 22.7),
      driverRow('u4', 22.72),
      driverRow('u3', 22.71),
    ]);

    await expect(service.runOneWave('order-1')).resolves.toBe('continue');

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'u1', orderId: 'order-1' }),
        expect.objectContaining({ userId: 'u2', orderId: 'order-1' }),
        expect.objectContaining({ userId: 'u3', orderId: 'order-1' }),
        expect.objectContaining({ userId: 'u4', orderId: 'order-1' }),
        expect.objectContaining({ userId: 'u5', orderId: 'order-1' }),
      ],
    });
    expect(createManyCall(0).data).toHaveLength(5);
    expect(notificationsService.deliverPendingForOrder).toHaveBeenCalledWith(
      'order-1',
    );
  });

  it('does not create duplicate notifications for already-notified drivers', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.OPEN,
      pickupLocation: '左營',
    });
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.68,
      longitude: 120.3,
    });
    // Query already excludes notified drivers via Prisma where; empty → stop
    prisma.driver.findMany.mockResolvedValue([]);

    await expect(service.runOneWave('order-1')).resolves.toBe('stop');
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(prisma.driver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({
            notifications: { none: { orderId: 'order-1' } },
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      }),
    );
  });

  it('stops when Order is no longer OPEN', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.ACCEPTED,
      pickupLocation: '左營',
    });

    await expect(service.runOneWave('order-1')).resolves.toBe('stop');
    expect(prisma.driver.findMany).not.toHaveBeenCalled();
  });

  it('stops when pickup coordinates are unavailable', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.OPEN,
      pickupLocation: '左營',
    });
    geocodingService.getPickupCoordinates.mockResolvedValue(null);

    await expect(service.runOneWave('order-1')).resolves.toBe('stop');
    expect(prisma.driver.findMany).not.toHaveBeenCalled();
  });

  it('stops after a partial wave (fewer than batch size remaining)', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.OPEN,
      pickupLocation: '左營',
    });
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.68,
      longitude: 120.3,
    });
    prisma.driver.findMany.mockResolvedValue([
      driverRow('u1', 22.69),
      driverRow('u2', 22.7),
    ]);

    await expect(service.runOneWave('order-1')).resolves.toBe('stop');
    expect(createManyCall(0).data).toHaveLength(2);
  });

  it('re-checks OPEN before creating notifications', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 'order-1',
        status: OrderStatus.OPEN,
        pickupLocation: '左營',
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        status: OrderStatus.CANCELLED,
        pickupLocation: '左營',
      });
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.68,
      longitude: 120.3,
    });
    prisma.driver.findMany.mockResolvedValue([driverRow('u1', 22.69)]);

    await expect(service.runOneWave('order-1')).resolves.toBe('stop');
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('filters candidates to ONLINE ACTIVE free drivers with GPS', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.OPEN,
      pickupLocation: '左營',
    });
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.68,
      longitude: 120.3,
    });
    prisma.driver.findMany.mockResolvedValue([]);

    await service.runOneWave('order-1');

    expect(prisma.driver.findMany).toHaveBeenCalledWith({
      where: {
        onlineStatus: DriverOnlineStatus.ONLINE,
        latitude: { not: null },
        longitude: { not: null },
        user: {
          role: 'DRIVER',
          status: 'ACTIVE',
          pushSubscription: { isNot: null },
          notifications: { none: { orderId: 'order-1' } },
        },
        orders: {
          none: {
            status: {
              in: [OrderStatus.ACCEPTED, OrderStatus.IN_PROGRESS],
            },
          },
        },
      },
      select: {
        userId: true,
        latitude: true,
        longitude: true,
      },
    });
  });

  it('startAfterPublish continues waves when a full batch is notified', async () => {
    const shortOptions: WaveDispatchOptions = {
      batchSize: 5,
      intervalMs: 20,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaveDispatchService,
        { provide: PrismaService, useValue: prisma },
        { provide: GeocodingService, useValue: geocodingService },
        { provide: DistanceService, useValue: distanceService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: WAVE_DISPATCH_OPTIONS, useValue: shortOptions },
      ],
    }).compile();
    const looping = module.get(WaveDispatchService);

    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.OPEN,
      pickupLocation: '左營',
    });
    geocodingService.getPickupCoordinates.mockResolvedValue({
      latitude: 22.68,
      longitude: 120.3,
    });
    prisma.driver.findMany
      .mockResolvedValueOnce([
        driverRow('u1', 22.69),
        driverRow('u2', 22.7),
        driverRow('u3', 22.71),
        driverRow('u4', 22.72),
        driverRow('u5', 22.73),
      ])
      .mockResolvedValueOnce([driverRow('u6', 22.74)])
      .mockResolvedValue([]);

    await looping.startAfterPublish('order-1');
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(prisma.notification.createMany).toHaveBeenCalledTimes(2);
    expect(createManyCall(0).data).toHaveLength(5);
    expect(createManyCall(1).data).toHaveLength(1);
    expect(createManyCall(0).data[0]).toEqual(
      expect.objectContaining({
        status: NotificationStatus.PENDING,
      }),
    );

    looping.onModuleDestroy();
  });
});
