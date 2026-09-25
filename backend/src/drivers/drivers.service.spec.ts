import { Test, TestingModule } from '@nestjs/testing';
import { DriverOnlineStatus, Prisma, UserStatus } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { DriversService } from './drivers.service';

describe('DriversService', () => {
  let service: DriversService;
  const prisma = {
    driver: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    order: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  const sessionService = {
    revokeActiveSessions: jest.fn(),
  };

  beforeEach(async () => {
    prisma.driver.findUnique.mockReset();
    prisma.driver.findMany.mockReset();
    prisma.driver.update.mockReset();
    prisma.user.update.mockReset();
    prisma.order.updateMany.mockReset();
    prisma.$transaction.mockReset();
    prisma.$queryRaw.mockReset();
    sessionService.revokeActiveSessions.mockReset();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    prisma.$queryRaw.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: {} },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    service = module.get(DriversService);
  });

  function driverRecord(status: UserStatus) {
    return {
      id: 'driver-1',
      userId: 'user-1',
      user: {
        username: 'driver-one',
        status,
      },
    };
  }

  function activeDriverUser(): AuthenticatedUser {
    return {
      id: 'user-1',
      username: 'driver-one',
      role: 'DRIVER',
      status: UserStatus.ACTIVE,
    };
  }

  it('revokes active sessions when ACTIVE becomes SUSPENDED', async () => {
    prisma.driver.findUnique.mockResolvedValue(driverRecord(UserStatus.ACTIVE));

    await expect(
      service.updateStatus('driver-1', UserStatus.SUSPENDED),
    ).resolves.toEqual({
      id: 'driver-1',
      status: UserStatus.SUSPENDED,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: UserStatus.SUSPENDED },
    });
    expect(sessionService.revokeActiveSessions).toHaveBeenCalledWith(
      'user-1',
      prisma,
    );
  });

  it('does not create or revoke sessions when SUSPENDED becomes ACTIVE', async () => {
    prisma.driver.findUnique.mockResolvedValue(
      driverRecord(UserStatus.SUSPENDED),
    );

    await expect(
      service.updateStatus('driver-1', UserStatus.ACTIVE),
    ).resolves.toEqual({
      id: 'driver-1',
      status: UserStatus.ACTIVE,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: UserStatus.ACTIVE },
    });
    expect(sessionService.revokeActiveSessions).not.toHaveBeenCalled();
  });

  it('does not change sessions when the account status is unchanged', async () => {
    prisma.driver.findUnique.mockResolvedValue(driverRecord(UserStatus.ACTIVE));

    await expect(
      service.updateStatus('driver-1', UserStatus.ACTIVE),
    ).resolves.toEqual({
      id: 'driver-1',
      status: UserStatus.ACTIVE,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sessionService.revokeActiveSessions).not.toHaveBeenCalled();
  });

  it('updates only the authenticated driver location fields', async () => {
    const updatedAt = new Date('2026-09-16T00:30:00.000Z');
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
    prisma.driver.update.mockResolvedValue({
      latitude: new Prisma.Decimal('22.6870123'),
      longitude: new Prisma.Decimal('120.3090456'),
      locationUpdatedAt: updatedAt,
    });

    const result = await service.updateOwnLocation(activeDriverUser(), {
      latitude: 22.6870123,
      longitude: 120.3090456,
    });
    expect(result).toEqual({
      latitude: 22.6870123,
      longitude: 120.3090456,
      location_updated_at: updatedAt.toISOString(),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.driver.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { id: true },
    });
    expect(prisma.driver.update).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    const updateCall = prisma.driver.update.mock.calls[0] as unknown as [
      {
        where: { id: string };
        data: {
          latitude: Prisma.Decimal;
          longitude: Prisma.Decimal;
          locationUpdatedAt: Date;
          onlineStatus?: unknown;
        };
      },
    ];
    expect(updateCall[0].where).toEqual({ id: 'driver-1' });
    expect(updateCall[0].data.latitude).toBeInstanceOf(Prisma.Decimal);
    expect(updateCall[0].data.longitude).toBeInstanceOf(Prisma.Decimal);
    expect(updateCall[0].data.locationUpdatedAt).toBeInstanceOf(Date);
    expect(updateCall[0].data.onlineStatus).toBeUndefined();
  });

  it('accumulates trip mileage for an IN_PROGRESS order inside the location transaction', async () => {
    const updatedAt = new Date('2026-09-16T00:30:00.000Z');
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
    prisma.driver.update.mockResolvedValue({
      latitude: new Prisma.Decimal('22.63'),
      longitude: new Prisma.Decimal('120.305'),
      locationUpdatedAt: updatedAt,
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'order-1',
        trip_distance_meters: 0,
        trip_last_latitude: new Prisma.Decimal('22.6273'),
        trip_last_longitude: new Prisma.Decimal('120.3014'),
      },
    ]);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });

    await service.updateOwnLocation(activeDriverUser(), {
      latitude: 22.63,
      longitude: 120.305,
    });

    expect(prisma.order.updateMany).toHaveBeenCalledTimes(1);
    const updateManyCalls = prisma.order.updateMany.mock
      .calls as unknown as Array<
      [
        {
          where: { id: string; status: string };
          data: {
            tripDistanceMeters: number;
            tripLastLatitude: Prisma.Decimal;
            tripLastLongitude: Prisma.Decimal;
          };
        },
      ]
    >;
    const updateManyArg = updateManyCalls[0][0];
    expect(updateManyArg.where).toEqual({
      id: 'order-1',
      status: 'IN_PROGRESS',
    });
    expect(updateManyArg.data.tripDistanceMeters).toBeGreaterThan(0);
    expect(updateManyArg.data.tripLastLatitude.toNumber()).toBeCloseTo(
      22.63,
      6,
    );
    expect(updateManyArg.data.tripLastLongitude.toNumber()).toBeCloseTo(
      120.305,
      6,
    );
  });

  it('sets first GPS as last point with zero distance for IN_PROGRESS order', async () => {
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
    prisma.driver.update.mockResolvedValue({
      latitude: new Prisma.Decimal('22.6273'),
      longitude: new Prisma.Decimal('120.3014'),
      locationUpdatedAt: new Date(),
    });
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'order-1',
        trip_distance_meters: null,
        trip_last_latitude: null,
        trip_last_longitude: null,
      },
    ]);
    prisma.order.updateMany.mockResolvedValue({ count: 1 });

    await service.updateOwnLocation(activeDriverUser(), {
      latitude: 22.6273,
      longitude: 120.3014,
    });

    const firstGpsCalls = prisma.order.updateMany.mock
      .calls as unknown as Array<
      [
        {
          where: { id: string; status: string };
          data: {
            tripDistanceMeters: number;
            tripLastLatitude: Prisma.Decimal;
            tripLastLongitude: Prisma.Decimal;
          };
        },
      ]
    >;
    const firstGpsArg = firstGpsCalls[0][0];
    expect(firstGpsArg.where).toEqual({
      id: 'order-1',
      status: 'IN_PROGRESS',
    });
    expect(firstGpsArg.data.tripDistanceMeters).toBe(0);
    expect(firstGpsArg.data.tripLastLatitude).toBeInstanceOf(Prisma.Decimal);
    expect(firstGpsArg.data.tripLastLongitude).toBeInstanceOf(Prisma.Decimal);
  });

  it('skips trip mileage when no unlocked IN_PROGRESS order is returned', async () => {
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
    prisma.driver.update.mockResolvedValue({
      latitude: new Prisma.Decimal('22.63'),
      longitude: new Prisma.Decimal('120.305'),
      locationUpdatedAt: new Date(),
    });
    // Arrive locked the trip (arrived_at IS NULL filter yields empty).
    prisma.$queryRaw.mockResolvedValue([]);

    await service.updateOwnLocation(activeDriverUser(), {
      latitude: 22.63,
      longitude: 120.305,
    });

    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('returns null location when the driver has never reported GPS', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      latitude: null,
      longitude: null,
      locationUpdatedAt: null,
    });

    await expect(service.getOwnLocation(activeDriverUser())).resolves.toEqual({
      latitude: null,
      longitude: null,
      location_updated_at: null,
    });
  });

  it('lists only ONLINE drivers for admin online locations', async () => {
    prisma.driver.findMany.mockResolvedValue([
      {
        id: 'driver-1',
        licensePlate: 'ABC-1234',
        latitude: new Prisma.Decimal('22.6'),
        longitude: new Prisma.Decimal('120.3'),
        locationUpdatedAt: new Date('2026-09-16T00:30:00.000Z'),
        user: { username: 'driver-one' },
      },
    ]);

    await expect(service.listOnlineLocations()).resolves.toEqual([
      {
        id: 'driver-1',
        username: 'driver-one',
        license_plate: 'ABC-1234',
        online_status: 'ONLINE',
        latitude: 22.6,
        longitude: 120.3,
        location_updated_at: '2026-09-16T00:30:00.000Z',
      },
    ]);

    expect(prisma.driver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { onlineStatus: DriverOnlineStatus.ONLINE },
      }),
    );
  });

  it('rejects suspended drivers from updating location', async () => {
    await expect(
      service.updateOwnLocation(
        {
          id: 'user-1',
          username: 'driver-one',
          role: 'DRIVER',
          status: UserStatus.SUSPENDED,
        },
        { latitude: 1, longitude: 2 },
      ),
    ).rejects.toMatchObject({ errorCode: 'ACCOUNT_SUSPENDED' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.driver.update).not.toHaveBeenCalled();
  });
});
