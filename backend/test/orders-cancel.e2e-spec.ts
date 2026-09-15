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
const password = 'OrderCancelP@ss-never-log-this';

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

type CancelData = {
  id: string;
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

describe('Admin Order Cancel (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d11-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `d11-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `EA-${suffix}`,
    },
    busy: {
      id: randomUUID(),
      username: `d11-busy-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `EC-${suffix}`,
    },
    reclaimer: {
      id: randomUUID(),
      username: `d11-reclaim-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `EB-${suffix}`,
    },
  };
  const orders = {
    open: randomUUID(),
    accepted: randomUUID(),
    draft: randomUUID(),
    inProgress: randomUUID(),
    completed: randomUUID(),
    cancelled: randomUUID(),
    raceOpen: randomUUID(),
    reclaimAccepted: randomUUID(),
    reclaimOpen: randomUUID(),
  };
  const acceptedAt = new Date('2026-09-15T07:05:00.000Z');

  async function loginAs(username: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    return sessionCookie(response) as string;
  }

  async function createDriverUser(user: {
    id: string;
    username: string;
    driverId: string;
    licensePlate: string;
  }) {
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
            onlineStatus: 'ONLINE',
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
  }) {
    await prisma.order.create({
      data: {
        id: input.id,
        orderNo: `ORD-D11-${input.suffix}-${suffix}`,
        customerName: '王先生',
        pickupLocation: '左營高鐵站',
        destination: '高雄小港機場',
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
            ? acceptedAt
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
    await createDriverUser(users.driver);
    await createDriverUser(users.busy);
    await createDriverUser(users.reclaimer);

    await seedOrder({ id: orders.open, suffix: 'OPEN', status: 'OPEN' });
    await seedOrder({
      id: orders.accepted,
      suffix: 'ACPT',
      status: 'ACCEPTED',
      driverId: users.driver.driverId,
    });
    await seedOrder({ id: orders.draft, suffix: 'DRAFT', status: 'DRAFT' });
    await seedOrder({
      id: orders.inProgress,
      suffix: 'PROG',
      status: 'IN_PROGRESS',
      driverId: users.busy.driverId,
    });
    await seedOrder({
      id: orders.completed,
      suffix: 'DONE',
      status: 'COMPLETED',
      driverId: users.driver.driverId,
    });
    await seedOrder({
      id: orders.cancelled,
      suffix: 'CXL',
      status: 'CANCELLED',
    });
    await seedOrder({
      id: orders.raceOpen,
      suffix: 'RACE',
      status: 'OPEN',
    });
    await seedOrder({
      id: orders.reclaimAccepted,
      suffix: 'RECA',
      status: 'ACCEPTED',
      driverId: users.reclaimer.driverId,
    });
    await seedOrder({
      id: orders.reclaimOpen,
      suffix: 'RECO',
      status: 'OPEN',
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
    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orders.open}/cancel`)
      .expect(401);
    expect(asBody<ApiErrorBody>(response).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when a DRIVER cancels', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orders.open}/cancel`)
      .set('Cookie', cookie)
      .expect(403);
    expect(asBody<ApiErrorBody>(response).error.code).toBe('FORBIDDEN');
    expect(
      (await prisma.order.findUnique({ where: { id: orders.open } }))?.status,
    ).toBe('OPEN');
  });

  it('cancels an OPEN order and writes ORDER_CANCELLED with server time', async () => {
    const before = Date.now();
    const cookie = await loginAs(users.admin.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orders.open}/cancel`)
      .set('Cookie', cookie)
      .send({
        driver_id: users.driver.driverId,
        cancelled_at: '2000-01-01T00:00:00.000Z',
        status: 'COMPLETED',
      })
      .expect(200);
    const after = Date.now();

    const body = asBody<ApiSuccessBody<CancelData>>(response);
    expect(body).toEqual({
      success: true,
      data: {
        id: orders.open,
        status: 'CANCELLED',
      },
    });
    assertNoSecrets(body);

    const stored = await prisma.order.findUnique({
      where: { id: orders.open },
    });
    expect(stored?.status).toBe('CANCELLED');
    expect(stored?.driverId).toBeNull();
    expect(stored?.acceptedAt).toBeNull();
    expect(stored?.cancelledAt).not.toBeNull();
    const cancelledAt = stored!.cancelledAt!.getTime();
    expect(cancelledAt).toBeGreaterThanOrEqual(before - 1000);
    expect(cancelledAt).toBeLessThanOrEqual(after + 1000);
    expect(stored!.cancelledAt!.toISOString()).not.toBe(
      '2000-01-01T00:00:00.000Z',
    );

    const events = await prisma.orderEvent.findMany({
      where: { orderId: orders.open, eventType: 'ORDER_CANCELLED' },
    });
    expect(events).toHaveLength(1);
    expect(events[0].actorUserId).toBe(users.admin.id);
    expect(
      await prisma.notification.count({ where: { orderId: orders.open } }),
    ).toBe(0);
  });

  it('cancels an ACCEPTED order while keeping driver_id and accepted_at', async () => {
    const cookie = await loginAs(users.admin.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orders.accepted}/cancel`)
      .set('Cookie', cookie)
      .expect(200);

    expect(asBody<ApiSuccessBody<CancelData>>(response).data).toEqual({
      id: orders.accepted,
      status: 'CANCELLED',
    });

    const stored = await prisma.order.findUnique({
      where: { id: orders.accepted },
    });
    expect(stored?.status).toBe('CANCELLED');
    expect(stored?.driverId).toBe(users.driver.driverId);
    expect(stored?.acceptedAt?.toISOString()).toBe(acceptedAt.toISOString());
    expect(stored?.cancelledAt).not.toBeNull();
    expect(
      await prisma.orderEvent.count({
        where: { orderId: orders.accepted, eventType: 'ORDER_CANCELLED' },
      }),
    ).toBe(1);
  });

  it('rejects illegal transitions and missing ids without writing ORDER_CANCELLED', async () => {
    const cookie = await loginAs(users.admin.username);

    for (const id of [
      orders.draft,
      orders.inProgress,
      orders.completed,
      orders.cancelled,
    ]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${id}/cancel`)
        .set('Cookie', cookie)
        .expect(409);
      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'INVALID_ORDER_STATUS',
      );
    }

    const missing = await request(app.getHttpServer())
      .post(`/api/v1/orders/${randomUUID()}/cancel`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(missing).error.code).toBe('NOT_FOUND');

    const invalidId = await request(app.getHttpServer())
      .post('/api/v1/orders/not-a-uuid/cancel')
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(invalidId).error.code).toBe('NOT_FOUND');
    assertNoSecrets(invalidId.body);

    expect(
      await prisma.orderEvent.count({
        where: {
          orderId: {
            in: [
              orders.draft,
              orders.inProgress,
              orders.completed,
              orders.cancelled,
            ],
          },
          eventType: 'ORDER_CANCELLED',
        },
      }),
    ).toBe(0);
  });

  it('lets a Driver accept another OPEN order after ACCEPTED cancel', async () => {
    const admin = await loginAs(users.admin.username);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orders.reclaimAccepted}/cancel`)
      .set('Cookie', admin)
      .expect(200);

    const cancelled = await prisma.order.findUnique({
      where: { id: orders.reclaimAccepted },
    });
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.driverId).toBe(users.reclaimer.driverId);

    const driver = await loginAs(users.reclaimer.username);
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.reclaimOpen}/accept`)
      .set('Cookie', driver)
      .expect(200);
    const acceptedBody =
      asBody<ApiSuccessBody<{ status: string; driver_id: string }>>(accepted);
    expect(acceptedBody.data.status).toBe('ACCEPTED');
    expect(acceptedBody.data.driver_id).toBe(users.reclaimer.driverId);

    const next = await prisma.order.findUnique({
      where: { id: orders.reclaimOpen },
    });
    expect(next?.status).toBe('ACCEPTED');
    expect(next?.driverId).toBe(users.reclaimer.driverId);
  });

  it('allows only one concurrent Cancel to win on the same OPEN order', async () => {
    const cookie = await loginAs(users.admin.username);
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/orders/${orders.raceOpen}/cancel`)
        .set('Cookie', cookie),
      request(app.getHttpServer())
        .post(`/api/v1/orders/${orders.raceOpen}/cancel`)
        .set('Cookie', cookie),
      request(app.getHttpServer())
        .post(`/api/v1/orders/${orders.raceOpen}/cancel`)
        .set('Cookie', cookie),
    ]);

    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(2);

    const winner = responses.find((response) => response.status === 200);
    expect(asBody<ApiSuccessBody<CancelData>>(winner!).data).toEqual({
      id: orders.raceOpen,
      status: 'CANCELLED',
    });

    for (const response of responses.filter((item) => item.status === 409)) {
      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'INVALID_ORDER_STATUS',
      );
      assertNoSecrets(response.body);
    }

    const stored = await prisma.order.findUnique({
      where: { id: orders.raceOpen },
    });
    expect(stored?.status).toBe('CANCELLED');
    expect(stored?.cancelledAt).not.toBeNull();
    expect(
      await prisma.orderEvent.count({
        where: { orderId: orders.raceOpen, eventType: 'ORDER_CANCELLED' },
      }),
    ).toBe(1);
  });
});
