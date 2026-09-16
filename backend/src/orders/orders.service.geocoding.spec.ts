import { Test, TestingModule } from '@nestjs/testing';
import {
  DispatchMode,
  OrderStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { DistanceService } from '../distance/distance.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService geocoding hooks (P2-02)', () => {
  let service: OrdersService;
  const prisma = {
    order: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    orderEvent: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    notification: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };
  const notificationsService = {
    deliverPendingForOrder: jest.fn(),
  };
  const geocodingService = {
    scheduleGeocode: jest.fn(),
    invalidateOrder: jest.fn(),
    getPickupCoordinates: jest.fn(),
  };
  const distanceService = {
    metersForOrder: jest.fn(),
    listOnlineDriverDistancesForOrder: jest.fn(),
    coordsFromDecimals: jest.fn().mockReturnValue(null),
    straightLineMeters: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    prisma.$executeRawUnsafe.mockResolvedValue(undefined);
    prisma.order.findMany.mockResolvedValue([]);
    distanceService.coordsFromDecimals.mockReturnValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: GeocodingService, useValue: geocodingService },
        { provide: DistanceService, useValue: distanceService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  function admin(): AuthenticatedUser {
    return {
      id: 'admin-1',
      username: 'admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    };
  }

  function draftOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 'order-1',
      orderNo: 'SF-20260916-0001',
      customerName: '王先生',
      pickupLocation: '左營高鐵站',
      destination: '小港機場',
      price: new Prisma.Decimal(1200),
      note: null,
      status: OrderStatus.DRAFT,
      dispatchMode: DispatchMode.OPEN,
      driverId: null,
      createdBy: 'admin-1',
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: new Date('2026-09-16T01:00:00.000Z'),
      updatedAt: new Date('2026-09-16T01:00:00.000Z'),
      driver: null,
      ...overrides,
    };
  }

  it('schedules geocode after create without awaiting Google', async () => {
    let resolveGeocode!: () => void;
    const geocodeDone = new Promise<void>((resolve) => {
      resolveGeocode = resolve;
    });
    geocodingService.scheduleGeocode.mockImplementation(() => {
      void geocodeDone;
    });

    prisma.order.create.mockResolvedValue(draftOrder());
    prisma.orderEvent.create.mockResolvedValue({});

    const result = await service.create(admin(), {
      customerName: '王先生',
      pickupLocation: '左營高鐵站',
      destination: '小港機場',
      price: new Prisma.Decimal(1200),
      note: null,
    });

    expect(result.id).toBe('order-1');
    expect(geocodingService.scheduleGeocode).toHaveBeenCalledWith(
      'order-1',
      '左營高鐵站',
    );
    // Create finished even though a slow geocode would still be pending.
    expect(resolveGeocode).toBeDefined();
    resolveGeocode();
    await geocodeDone;
  });

  it('create still succeeds when scheduleGeocode is a no-op failure path', async () => {
    geocodingService.scheduleGeocode.mockImplementation(() => {
      // scheduleGeocode itself must not throw; simulate internal async failure only.
    });
    prisma.order.create.mockResolvedValue(draftOrder());
    prisma.orderEvent.create.mockResolvedValue({});

    await expect(
      service.create(admin(), {
        customerName: '王先生',
        pickupLocation: '左營高鐵站',
        destination: null,
        price: null,
        note: null,
      }),
    ).resolves.toMatchObject({ id: 'order-1', status: OrderStatus.DRAFT });
  });

  it('does not write pickup lat/lng when creating an order', async () => {
    prisma.order.create.mockResolvedValue(draftOrder());
    prisma.orderEvent.create.mockResolvedValue({});

    await service.create(admin(), {
      customerName: '王先生',
      pickupLocation: '左營高鐵站',
      destination: null,
      price: null,
      note: null,
    });

    const createCall = prisma.order.create.mock.calls[0] as
      [{ data: Record<string, unknown> }] | undefined;
    const createData = createCall?.[0].data;
    expect(createData).toMatchObject({
      pickupLocation: '左營高鐵站',
    });
    expect(createData).not.toHaveProperty('latitude');
    expect(createData).not.toHaveProperty('longitude');
    expect(createData).not.toHaveProperty('pickupLatitude');
    expect(createData).not.toHaveProperty('pickupLongitude');
  });

  it('invalidates and re-schedules when pickup_location changes', async () => {
    prisma.order.findUnique.mockResolvedValue(draftOrder());
    prisma.order.update.mockResolvedValue(
      draftOrder({ pickupLocation: '高雄車站' }),
    );

    await service.update('order-1', {
      customerName: '王先生',
      pickupLocation: '高雄車站',
      destination: '小港機場',
      price: new Prisma.Decimal(1200),
      note: null,
    });

    expect(geocodingService.invalidateOrder).toHaveBeenCalledWith('order-1');
    expect(geocodingService.scheduleGeocode).toHaveBeenCalledWith(
      'order-1',
      '高雄車站',
    );

    const updateCall = prisma.order.update.mock.calls[0] as
      [{ data: Record<string, unknown> }] | undefined;
    const updateData = updateCall?.[0].data;
    expect(updateData).not.toHaveProperty('latitude');
    expect(updateData).not.toHaveProperty('longitude');
  });

  it('does not invalidate when pickup_location is unchanged', async () => {
    prisma.order.findUnique.mockResolvedValue(draftOrder());
    prisma.order.update.mockResolvedValue(draftOrder());

    await service.update('order-1', {
      customerName: '王先生',
      pickupLocation: '左營高鐵站',
      destination: '小港機場',
      price: new Prisma.Decimal(1300),
      note: null,
    });

    expect(geocodingService.invalidateOrder).not.toHaveBeenCalled();
    expect(geocodingService.scheduleGeocode).not.toHaveBeenCalled();
  });
});
