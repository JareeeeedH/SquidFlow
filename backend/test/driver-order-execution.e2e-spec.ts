import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SESSION_COOKIE_NAME } from '../src/common/cookie/cookie.config';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'DriverExecP@ss-never-log-this';

function cookieHeader(response: request.Response): string[] {
  const raw = response.headers['set-cookie'];
  if (!raw) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

function sessionCookie(response: request.Response): string | undefined {
  return cookieHeader(response).find((value) =>
    value.startsWith(`${SESSION_COOKIE_NAME}=`),
  );
}

type ApiErrorBody = {
  success: false;
  error: { code: string; message: string };
};

type ApiSuccessBody<T> = {
  success: true;
  data: T;
};

type MyOrderItem = {
  id: string;
  order_no: string;
  scheduled_at: string;
  pickup_location: string;
  destination: string;
  vehicle_type: string;
  price: number;
  status: string;
};

function asBody<T>(response: request.Response): T {
  return response.body as T;
}

function assertNoSecrets(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toContain('password_hash');
  expect(text).not.toContain('passwordHash');
  expect(text).not.toMatch(/"password"\s*:/);
  expect(text).not.toMatch(/prisma|p2002|sql/i);
}

describe('Driver My Orders / Start / Complete (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d10-admin-${suffix}`,
    },
    mine: {
      id: randomUUID(),
      username: `d10-mine-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DA-${suffix}`,
    },
    starter: {
      id: randomUUID(),
      username: `d10-start-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DB-${suffix}`,
    },
    completer: {
      id: randomUUID(),
      username: `d10-done-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DC-${suffix}`,
    },
    offlineStarter: {
      id: randomUUID(),
      username: `d10-off-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DD-${suffix}`,
    },
    other: {
      id: randomUUID(),
      username: `d10-other-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DE-${suffix}`,
    },
    empty: {
      id: randomUUID(),
      username: `d10-empty-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DF-${suffix}`,
    },
    suspendTarget: {
      id: randomUUID(),
      username: `d10-susp-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DG-${suffix}`,
    },
    raceStart: {
      id: randomUUID(),
      username: `d10-rs-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DH-${suffix}`,
    },
    raceComplete: {
      id: randomUUID(),
      username: `d10-rc-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `DI-${suffix}`,
    },
  };
  const orders = {
    draft: randomUUID(),
    open: randomUUID(),
    mineCompleted: randomUUID(),
    mineCancelled: randomUUID(),
    startAccepted: randomUUID(),
    completeProgress: randomUUID(),
    offlineAccepted: randomUUID(),
    otherAccepted: randomUUID(),
    suspendAccepted: randomUUID(),
    raceStartAccepted: randomUUID(),
    raceCompleteProgress: randomUUID(),
  };

  async function loginAs(username: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    return sessionCookie(response) as string;
  }

  async function createDriverUser(
    user: {
      id: string;
      username: string;
      driverId: string;
      licensePlate: string;
    },
    options: { onlineStatus?: 'ONLINE' | 'OFFLINE' } = {},
  ) {
    await prisma.user.create({
      data: {
        id: user.id,
        username: user.username,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'DRIVER',
        status: 'ACTIVE',
        driver: {
          create: {
            id: user.driverId,
            vehicleType: '5人座',
            licensePlate: user.licensePlate,
            vehicleBrand: 'Toyota',
            vehicleModel: 'Camry',
            vehicleColor: '黑色',
            vehicleYear: 2024,
            onlineStatus: options.onlineStatus ?? 'OFFLINE',
          },
        },
      },
    });
  }

  async function seedOrder(input: {
    id: string;
    suffix: string;
    status:
      'DRAFT' | 'OPEN' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    driverId?: string;
    scheduledAt?: Date;
  }) {
    await prisma.order.create({
      data: {
        id: input.id,
        orderNo: `ORD-D10-${input.suffix}-${suffix}`,
        customerName: '王先生',
        pickupLocation: '左營高鐵站',
        destination: '高雄小港機場',
        scheduledAt: input.scheduledAt ?? new Date('2026-09-15T07:30:00Z'),
        vehicleType: '5人座',
        price: new Prisma.Decimal('1200.00'),
        note: '2件行李',
        status: input.status,
        dispatchMode: 'OPEN',
        driverId: input.driverId ?? null,
        createdBy: users.admin.id,
        acceptedAt:
          input.status === 'ACCEPTED' ||
          input.status === 'IN_PROGRESS' ||
          input.status === 'COMPLETED'
            ? new Date('2026-09-15T07:00:00Z')
            : null,
        startedAt:
          input.status === 'IN_PROGRESS' || input.status === 'COMPLETED'
            ? new Date('2026-09-15T07:10:00Z')
            : null,
        completedAt:
          input.status === 'COMPLETED'
            ? new Date('2026-09-15T08:00:00Z')
            : null,
        cancelledAt:
          input.status === 'CANCELLED'
            ? new Date('2026-09-15T08:30:00Z')
            : null,
      },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: users.admin.id,
        username: users.admin.username,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    await createDriverUser(users.mine, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.starter, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.completer, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.offlineStarter, { onlineStatus: 'OFFLINE' });
    await createDriverUser(users.other, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.empty, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.suspendTarget, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.raceStart, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.raceComplete, { onlineStatus: 'OFFLINE' });

    await seedOrder({ id: orders.draft, suffix: 'DRAFT', status: 'DRAFT' });
    await seedOrder({ id: orders.open, suffix: 'OPEN', status: 'OPEN' });
    await seedOrder({
      id: orders.mineCompleted,
      suffix: 'MINEC',
      status: 'COMPLETED',
      driverId: users.mine.driverId,
      scheduledAt: new Date('2026-09-14T07:30:00Z'),
    });
    await seedOrder({
      id: orders.mineCancelled,
      suffix: 'MINEK',
      status: 'CANCELLED',
      driverId: users.mine.driverId,
      scheduledAt: new Date('2026-09-16T07:30:00Z'),
    });
    await seedOrder({
      id: orders.startAccepted,
      suffix: 'START',
      status: 'ACCEPTED',
      driverId: users.starter.driverId,
    });
    await seedOrder({
      id: orders.completeProgress,
      suffix: 'COMP',
      status: 'IN_PROGRESS',
      driverId: users.completer.driverId,
    });
    await seedOrder({
      id: orders.offlineAccepted,
      suffix: 'OFFA',
      status: 'ACCEPTED',
      driverId: users.offlineStarter.driverId,
    });
    await seedOrder({
      id: orders.otherAccepted,
      suffix: 'OTHA',
      status: 'ACCEPTED',
      driverId: users.other.driverId,
    });
    await seedOrder({
      id: orders.suspendAccepted,
      suffix: 'SUSA',
      status: 'ACCEPTED',
      driverId: users.suspendTarget.driverId,
    });
    await seedOrder({
      id: orders.raceStartAccepted,
      suffix: 'RACE',
      status: 'ACCEPTED',
      driverId: users.raceStart.driverId,
    });
    await seedOrder({
      id: orders.raceCompleteProgress,
      suffix: 'RACC',
      status: 'IN_PROGRESS',
      driverId: users.raceComplete.driverId,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    const testUsers = await prisma.user.findMany({
      where: { username: { contains: suffix } },
      select: { id: true },
    });
    await cleanupTestUsers(
      prisma,
      testUsers.map((user) => user.id),
    );
    await app.close();
    await prisma.$disconnect();
  });

  it('returns 401 when unauthenticated', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .expect(401);
    expect(asBody<ApiErrorBody>(list).error.code).toBe('UNAUTHORIZED');

    const start = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.startAccepted}/start`)
      .expect(401);
    expect(asBody<ApiErrorBody>(start).error.code).toBe('UNAUTHORIZED');

    const complete = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.completeProgress}/complete`)
      .expect(401);
    expect(asBody<ApiErrorBody>(complete).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when an ADMIN lists or executes driver orders', async () => {
    const cookie = await loginAs(users.admin.username);

    const list = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .set('Cookie', cookie)
      .expect(403);
    expect(asBody<ApiErrorBody>(list).error.code).toBe('FORBIDDEN');

    const start = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.startAccepted}/start`)
      .set('Cookie', cookie)
      .send({ driver_id: users.starter.driverId })
      .expect(403);
    expect(asBody<ApiErrorBody>(start).error.code).toBe('FORBIDDEN');

    const complete = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.completeProgress}/complete`)
      .set('Cookie', cookie)
      .send({ user_id: users.completer.id })
      .expect(403);
    expect(asBody<ApiErrorBody>(complete).error.code).toBe('FORBIDDEN');
  });

  it('lists only the current Driver own orders and never DRAFT', async () => {
    const cookie = await loginAs(users.mine.username);
    const response = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .set('Cookie', cookie)
      .expect(200);

    const body = asBody<ApiSuccessBody<MyOrderItem[]>>(response);
    expect(body.data.map((item) => item.id)).toEqual([
      orders.mineCancelled,
      orders.mineCompleted,
    ]);
    expect(body.data.map((item) => item.status)).toEqual([
      'CANCELLED',
      'COMPLETED',
    ]);
    expect(body.data[0]).toEqual({
      id: orders.mineCancelled,
      order_no: `ORD-D10-MINEK-${suffix}`,
      scheduled_at: '2026-09-16T07:30:00.000Z',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      vehicle_type: '5人座',
      price: 1200,
      status: 'CANCELLED',
    });
    expect(JSON.stringify(body)).not.toMatch(/customer_name|driver_id|"note"/);
    assertNoSecrets(body);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .set('Cookie', await loginAs(users.empty.username))
      .expect(200);
    expect(asBody<ApiSuccessBody<MyOrderItem[]>>(empty).data).toEqual([]);
  });

  it('filters My Orders by status and rejects invalid status', async () => {
    const cookie = await loginAs(users.mine.username);

    const completed = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .query({ status: 'COMPLETED' })
      .set('Cookie', cookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<MyOrderItem[]>>(completed).data.map(
        (item) => item.id,
      ),
    ).toEqual([orders.mineCompleted]);

    const draft = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .query({ status: 'DRAFT' })
      .set('Cookie', cookie)
      .expect(200);
    expect(asBody<ApiSuccessBody<MyOrderItem[]>>(draft).data).toEqual([]);

    const open = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .query({ status: 'OPEN' })
      .set('Cookie', cookie)
      .expect(200);
    expect(asBody<ApiSuccessBody<MyOrderItem[]>>(open).data).toEqual([]);

    const otherAccepted = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .query({ status: 'ACCEPTED' })
      .set('Cookie', cookie)
      .expect(200);
    expect(asBody<ApiSuccessBody<MyOrderItem[]>>(otherAccepted).data).toEqual(
      [],
    );

    const invalid = await request(app.getHttpServer())
      .get('/api/v1/driver/orders')
      .query({ status: 'NOT_A_STATUS' })
      .set('Cookie', cookie)
      .expect(400);
    expect(asBody<ApiErrorBody>(invalid).error.code).toBe('VALIDATION_ERROR');
  });

  it('starts an ACCEPTED own order and writes ORDER_STARTED with server time', async () => {
    const before = Date.now();
    const cookie = await loginAs(users.starter.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.startAccepted}/start`)
      .set('Cookie', cookie)
      .send({
        driver_id: users.other.driverId,
        user_id: users.other.id,
        started_at: '2000-01-01T00:00:00.000Z',
      })
      .expect(200);

    const after = Date.now();
    const body =
      asBody<
        ApiSuccessBody<{ id: string; status: string; started_at: string }>
      >(response);
    expect(body).toEqual({
      success: true,
      data: {
        id: orders.startAccepted,
        status: 'IN_PROGRESS',
        started_at: body.data.started_at,
      },
    });
    const startedAt = new Date(body.data.started_at).getTime();
    expect(startedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(startedAt).toBeLessThanOrEqual(after + 1000);
    expect(body.data.started_at).not.toBe('2000-01-01T00:00:00.000Z');
    assertNoSecrets(body);

    const stored = await prisma.order.findUnique({
      where: { id: orders.startAccepted },
    });
    expect(stored?.status).toBe('IN_PROGRESS');
    expect(stored?.driverId).toBe(users.starter.driverId);
    expect(stored?.startedAt?.toISOString()).toBe(body.data.started_at);

    const events = await prisma.orderEvent.findMany({
      where: { orderId: orders.startAccepted, eventType: 'ORDER_STARTED' },
    });
    expect(events).toHaveLength(1);
    expect(events[0].actorUserId).toBe(users.starter.id);

    const again = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.startAccepted}/start`)
      .set('Cookie', cookie)
      .expect(409);
    expect(asBody<ApiErrorBody>(again).error.code).toBe('INVALID_ORDER_STATUS');
    expect(
      await prisma.orderEvent.count({
        where: { orderId: orders.startAccepted, eventType: 'ORDER_STARTED' },
      }),
    ).toBe(1);
  });

  it('lets an OFFLINE Driver start and complete an already accepted order', async () => {
    const cookie = await loginAs(users.offlineStarter.username);
    const started = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.offlineAccepted}/start`)
      .set('Cookie', cookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<{ status: string }>>(started).data.status,
    ).toBe('IN_PROGRESS');

    const completed = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.offlineAccepted}/complete`)
      .set('Cookie', cookie)
      .expect(200);
    expect(
      asBody<
        ApiSuccessBody<{ id: string; status: string; completed_at: string }>
      >(completed).data.status,
    ).toBe('COMPLETED');
    expect(
      asBody<
        ApiSuccessBody<{ id: string; status: string; completed_at: string }>
      >(completed).data.id,
    ).toBe(orders.offlineAccepted);

    const stored = await prisma.order.findUnique({
      where: { id: orders.offlineAccepted },
    });
    expect(stored?.status).toBe('COMPLETED');
    expect(stored?.completedAt).not.toBeNull();
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: orders.offlineAccepted,
          eventType: { in: ['ORDER_STARTED', 'ORDER_COMPLETED'] },
        },
      }),
    ).toBe(2);
  });

  it('completes an IN_PROGRESS own order and writes ORDER_COMPLETED', async () => {
    const before = Date.now();
    const cookie = await loginAs(users.completer.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.completeProgress}/complete`)
      .set('Cookie', cookie)
      .send({ completed_at: '2000-01-01T00:00:00.000Z' })
      .expect(200);
    const after = Date.now();

    const body =
      asBody<
        ApiSuccessBody<{ id: string; status: string; completed_at: string }>
      >(response);
    expect(body.data).toEqual({
      id: orders.completeProgress,
      status: 'COMPLETED',
      completed_at: body.data.completed_at,
    });
    const completedAt = new Date(body.data.completed_at).getTime();
    expect(completedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(completedAt).toBeLessThanOrEqual(after + 1000);
    expect(body.data.completed_at).not.toBe('2000-01-01T00:00:00.000Z');

    const stored = await prisma.order.findUnique({
      where: { id: orders.completeProgress },
    });
    expect(stored?.status).toBe('COMPLETED');
    expect(stored?.completedAt?.toISOString()).toBe(body.data.completed_at);
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: orders.completeProgress,
          eventType: 'ORDER_COMPLETED',
        },
      }),
    ).toBe(1);
  });

  it('rejects illegal transitions and does not write events', async () => {
    const cookie = await loginAs(users.mine.username);

    const startCompleted = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.mineCompleted}/start`)
      .set('Cookie', cookie)
      .expect(409);
    expect(asBody<ApiErrorBody>(startCompleted).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );

    const completeCancelled = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.mineCancelled}/complete`)
      .set('Cookie', cookie)
      .expect(409);
    expect(asBody<ApiErrorBody>(completeCancelled).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );

    const startOpen = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.open}/start`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(startOpen).error.code).toBe('NOT_FOUND');

    const completeAccepted = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.otherAccepted}/complete`)
      .set('Cookie', await loginAs(users.other.username))
      .expect(409);
    expect(asBody<ApiErrorBody>(completeAccepted).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );

    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: {
            in: [
              orders.mineCompleted,
              orders.mineCancelled,
              orders.open,
              orders.otherAccepted,
            ],
          },
          eventType: { in: ['ORDER_STARTED', 'ORDER_COMPLETED'] },
        },
      }),
    ).toBe(0);
  });

  it('hides other Driver orders as NOT_FOUND for Start / Complete', async () => {
    const cookie = await loginAs(users.mine.username);

    const startOther = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.otherAccepted}/start`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(startOther).error.code).toBe('NOT_FOUND');

    const completeOther = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.otherAccepted}/complete`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(completeOther).error.code).toBe('NOT_FOUND');

    const missing = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${randomUUID()}/start`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(missing).error.code).toBe('NOT_FOUND');

    const invalidId = await request(app.getHttpServer())
      .post('/api/v1/driver/orders/not-a-uuid/complete')
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(invalidId).error.code).toBe('NOT_FOUND');
    assertNoSecrets(invalidId.body);

    const stored = await prisma.order.findUnique({
      where: { id: orders.otherAccepted },
    });
    expect(stored?.status).toBe('ACCEPTED');
    expect(stored?.driverId).toBe(users.other.driverId);
  });

  it('follows SUSPENDED session rules for Start', async () => {
    const leftover = await loginAs(users.suspendTarget.username);
    await prisma.user.update({
      where: { id: users.suspendTarget.id },
      data: { status: 'SUSPENDED' },
    });
    const stillHasSession = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.suspendAccepted}/start`)
      .set('Cookie', leftover)
      .expect(403);
    expect(asBody<ApiErrorBody>(stillHasSession).error.code).toBe(
      'ACCOUNT_SUSPENDED',
    );

    await prisma.user.update({
      where: { id: users.suspendTarget.id },
      data: { status: 'ACTIVE' },
    });
    const activeCookie = await loginAs(users.suspendTarget.username);
    const admin = await loginAs(users.admin.username);
    await request(app.getHttpServer())
      .patch(`/api/v1/drivers/${users.suspendTarget.driverId}/status`)
      .set('Cookie', admin)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    const afterRevoke = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.suspendAccepted}/start`)
      .set('Cookie', activeCookie)
      .expect(401);
    expect(asBody<ApiErrorBody>(afterRevoke).error.code).toBe('UNAUTHORIZED');
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: orders.suspendAccepted,
          eventType: 'ORDER_STARTED',
        },
      }),
    ).toBe(0);
  });

  it('allows only one concurrent Start to win on the same ACCEPTED order', async () => {
    const cookie = await loginAs(users.raceStart.username);
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orders.raceStartAccepted}/start`)
        .set('Cookie', cookie),
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orders.raceStartAccepted}/start`)
        .set('Cookie', cookie),
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orders.raceStartAccepted}/start`)
        .set('Cookie', cookie),
    ]);

    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(2);

    const winner = responses.find((response) => response.status === 200);
    expect(
      asBody<ApiSuccessBody<{ status: string }>>(winner!).data.status,
    ).toBe('IN_PROGRESS');

    for (const response of responses.filter((item) => item.status === 409)) {
      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'INVALID_ORDER_STATUS',
      );
      assertNoSecrets(response.body);
    }

    const stored = await prisma.order.findUnique({
      where: { id: orders.raceStartAccepted },
    });
    expect(stored?.status).toBe('IN_PROGRESS');
    expect(stored?.startedAt).not.toBeNull();
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: orders.raceStartAccepted,
          eventType: 'ORDER_STARTED',
        },
      }),
    ).toBe(1);
  });

  it('allows only one concurrent Complete to win on the same IN_PROGRESS order', async () => {
    const cookie = await loginAs(users.raceComplete.username);
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orders.raceCompleteProgress}/complete`)
        .set('Cookie', cookie),
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orders.raceCompleteProgress}/complete`)
        .set('Cookie', cookie),
    ]);

    const successes = responses.filter((response) => response.status === 200);
    const failures = responses.filter((response) => response.status !== 200);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(asBody<ApiErrorBody>(failures[0]).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );
    expect(
      asBody<ApiSuccessBody<{ status: string }>>(successes[0]).data.status,
    ).toBe('COMPLETED');
    assertNoSecrets(failures[0].body);

    const stored = await prisma.order.findUnique({
      where: { id: orders.raceCompleteProgress },
    });
    expect(stored?.status).toBe('COMPLETED');
    expect(stored?.completedAt).not.toBeNull();
    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: orders.raceCompleteProgress,
          eventType: 'ORDER_COMPLETED',
        },
      }),
    ).toBe(1);
  });
});
