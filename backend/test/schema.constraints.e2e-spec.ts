import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();

describe('Database schema constraints', () => {
  const ids = {
    adminId: randomUUID(),
    driverUserId: randomUUID(),
    driverId: randomUUID(),
    orderAId: randomUUID(),
    orderBId: randomUUID(),
  };

  beforeAll(async () => {
    await prisma.$connect();

    await prisma.user.create({
      data: {
        id: ids.adminId,
        username: `admin-${ids.adminId.slice(0, 8)}`,
        passwordHash: 'hash',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    await prisma.user.create({
      data: {
        id: ids.driverUserId,
        username: `driver-${ids.driverUserId.slice(0, 8)}`,
        passwordHash: 'hash',
        role: 'DRIVER',
        status: 'ACTIVE',
        driver: {
          create: {
            id: ids.driverId,
            vehicleType: '5人座',
            licensePlate: `TEST-${ids.driverId.slice(0, 8)}`,
            vehicleBrand: 'Toyota',
            vehicleModel: 'Camry',
            vehicleColor: '黑色',
            vehicleYear: 2024,
            onlineStatus: 'ONLINE',
          },
        },
      },
    });
  });

  afterAll(async () => {
    await cleanupTestUsers(
      prisma,
      [ids.adminId, ids.driverUserId],
      [ids.orderAId, ids.orderBId],
    );
    await prisma.$disconnect();
  });

  it('creates the seven MVP tables', async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'users',
          'drivers',
          'orders',
          'order_events',
          'notifications',
          'push_subscriptions',
          'sessions'
        )
      ORDER BY tablename
    `;

    expect(tables.map((row) => row.tablename)).toEqual([
      'drivers',
      'notifications',
      'order_events',
      'orders',
      'push_subscriptions',
      'sessions',
      'users',
    ]);
  });

  it('creates the expected foreign keys', async () => {
    const constraints = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace
      ORDER BY conname
    `;

    expect(constraints.map((row) => row.conname)).toEqual([
      'drivers_user_id_fkey',
      'notifications_order_id_fkey',
      'notifications_user_id_fkey',
      'order_events_actor_user_id_fkey',
      'order_events_order_id_fkey',
      'orders_created_by_fkey',
      'orders_driver_id_fkey',
      'push_subscriptions_user_id_fkey',
      'sessions_user_id_fkey',
    ]);
  });

  it('creates the driver active-order partial unique index', async () => {
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_one_active_order_per_driver'
    `;

    expect(indexes).toHaveLength(1);
  });

  it('creates the active session partial unique index', async () => {
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_one_active_session_per_user'
    `;

    expect(indexes).toHaveLength(1);
  });

  it('rejects a second ACCEPTED or IN_PROGRESS order for the same driver', async () => {
    const baseOrder = {
      customerName: '王先生',
      pickupLocation: '左營高鐵站',
      destination: '高雄小港機場',
      scheduledAt: new Date('2026-09-15T07:30:00Z'),
      vehicleType: '5人座',
      price: new Prisma.Decimal('1200.00'),
      status: 'ACCEPTED' as const,
      dispatchMode: 'OPEN' as const,
      driverId: ids.driverId,
      createdBy: ids.adminId,
      acceptedAt: new Date(),
    };

    await prisma.order.create({
      data: {
        id: ids.orderAId,
        orderNo: `ORD-A-${ids.orderAId.slice(0, 8)}`,
        ...baseOrder,
      },
    });

    await expect(
      prisma.order.create({
        data: {
          id: ids.orderBId,
          orderNo: `ORD-B-${ids.orderBId.slice(0, 8)}`,
          ...baseOrder,
          status: 'IN_PROGRESS',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a second active session for the same user', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: ids.driverUserId,
        expiresAt,
      },
    });

    await expect(
      prisma.session.create({
        data: {
          userId: ids.driverUserId,
          expiresAt,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
