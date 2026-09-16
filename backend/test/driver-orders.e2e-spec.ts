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
const password = 'DriverOrdersP@ss-never-log-this';

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

type OpenOrderItem = {
  id: string;
  order_no: string;
  created_at: string;
  pickup_location: string;
  destination: string | null;
  price: number | null;
  note: string | null;
  distance_meters: number | null;
};

type DriverOrderDetail = {
  id: string;
  order_no: string;
  customer_name: string | null;
  pickup_location: string;
  destination: string | null;
  created_at: string;
  price: number | null;
  note: string | null;
  status: string;
  distance_meters: number | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
};

function asBody<T>(response: request.Response): T {
  return response.body as T;
}

function assertNoSecrets(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toContain('password_hash');
  expect(text).not.toContain('passwordHash');
  expect(text).not.toMatch(/"password"\s*:/);
  expect(text).not.toContain('push_endpoint');
  expect(text).not.toContain('p256dh');
  expect(text).not.toMatch(/"session"\s*:/);
}

describe('Driver Open Orders / Order Detail (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d8-admin-${suffix}`,
    },
    viewer: {
      id: randomUUID(),
      username: `d8-viewer-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8A-${suffix}`,
    },
    offline: {
      id: randomUUID(),
      username: `d8-offline-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8B-${suffix}`,
    },
    suspended: {
      id: randomUUID(),
      username: `d8-suspended-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8C-${suffix}`,
    },
    acceptedBusy: {
      id: randomUUID(),
      username: `d8-accepted-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8D-${suffix}`,
    },
    inProgressBusy: {
      id: randomUUID(),
      username: `d8-progress-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8E-${suffix}`,
    },
    other: {
      id: randomUUID(),
      username: `d8-other-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8F-${suffix}`,
    },
    claimer: {
      id: randomUUID(),
      username: `d8-claimer-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8G-${suffix}`,
    },
    racerB: {
      id: randomUUID(),
      username: `d8-racerb-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8H-${suffix}`,
    },
    racerC: {
      id: randomUUID(),
      username: `d8-racerc-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8I-${suffix}`,
    },
    suspendTarget: {
      id: randomUUID(),
      username: `d8-suspend-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8J-${suffix}`,
    },
    dual: {
      id: randomUUID(),
      username: `d8-dual-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D8K-${suffix}`,
    },
  };
  const orders = {
    draft: randomUUID(),
    open: randomUUID(),
    accepted: randomUUID(),
    inProgress: randomUUID(),
    otherAccepted: randomUUID(),
    completed: randomUUID(),
    cancelled: randomUUID(),
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
    options: {
      accountStatus?: 'ACTIVE' | 'SUSPENDED';
      onlineStatus?: 'ONLINE' | 'OFFLINE';
    } = {},
  ) {
    await prisma.user.create({
      data: {
        id: user.id,
        username: user.username,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'DRIVER',
        status: options.accountStatus ?? 'ACTIVE',
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
  }) {
    await prisma.order.create({
      data: {
        id: input.id,
        orderNo: `ORD-D8-${input.suffix}-${suffix}`,
        customerName: '王先生',
        pickupLocation: '左營高鐵站',
        destination: '高雄小港機場',
        price: new Prisma.Decimal('1200.00'),
        note: '2件行李',
        status: input.status,
        dispatchMode: 'OPEN',
        driverId: input.driverId ?? null,
        createdBy: users.admin.id,
      },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        id: users.admin.id,
        username: users.admin.username,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    await createDriverUser(users.viewer, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.offline, { onlineStatus: 'OFFLINE' });
    await createDriverUser(users.suspended, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.acceptedBusy, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.inProgressBusy, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.other, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.claimer, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.racerB, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.racerC, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.suspendTarget, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.dual, { onlineStatus: 'ONLINE' });

    await seedOrder({ id: orders.draft, suffix: 'DRAFT', status: 'DRAFT' });
    await seedOrder({ id: orders.open, suffix: 'OPEN', status: 'OPEN' });
    await seedOrder({
      id: orders.accepted,
      suffix: 'ACCEPTED',
      status: 'ACCEPTED',
      driverId: users.acceptedBusy.driverId,
    });
    await seedOrder({
      id: orders.inProgress,
      suffix: 'PROGRESS',
      status: 'IN_PROGRESS',
      driverId: users.inProgressBusy.driverId,
    });
    await seedOrder({
      id: orders.otherAccepted,
      suffix: 'OTHER',
      status: 'ACCEPTED',
      driverId: users.other.driverId,
    });
    await seedOrder({
      id: orders.completed,
      suffix: 'DONE',
      status: 'COMPLETED',
      driverId: users.viewer.driverId,
    });
    await seedOrder({
      id: orders.cancelled,
      suffix: 'CANCEL',
      status: 'CANCELLED',
      driverId: users.viewer.driverId,
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
    const openResponse = await request(app.getHttpServer())
      .get('/api/v1/driver/orders/open')
      .expect(401);
    expect(asBody<ApiErrorBody>(openResponse).error.code).toBe('UNAUTHORIZED');

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.open}`)
      .expect(401);
    expect(asBody<ApiErrorBody>(detailResponse).error.code).toBe(
      'UNAUTHORIZED',
    );
  });

  it('returns 403 when an ADMIN accesses driver order APIs', async () => {
    const cookie = await loginAs(users.admin.username);

    const openResponse = await request(app.getHttpServer())
      .get('/api/v1/driver/orders/open')
      .set('Cookie', cookie)
      .expect(403);
    expect(asBody<ApiErrorBody>(openResponse).error.code).toBe('FORBIDDEN');

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.open}`)
      .set('Cookie', cookie)
      .expect(403);
    expect(asBody<ApiErrorBody>(detailResponse).error.code).toBe('FORBIDDEN');
  });

  it('lets an eligible DRIVER list OPEN orders with allowed fields only', async () => {
    const cookie = await loginAs(users.viewer.username);
    const response = await request(app.getHttpServer())
      .get('/api/v1/driver/orders/open')
      .set('Cookie', cookie)
      .expect(200);

    const body = asBody<ApiSuccessBody<OpenOrderItem[]>>(response);
    expect(body.success).toBe(true);
    assertNoSecrets(body);

    const openItem = body.data.find((item) => item.id === orders.open);
    expect(openItem).toEqual({
      id: orders.open,
      order_no: `ORD-D8-OPEN-${suffix}`,
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      price: 1200,
      note: '2件行李',
      created_at: openItem?.created_at,
      distance_meters: null,
    });
    expect(typeof openItem?.created_at).toBe('string');
    expect(Object.keys(openItem as OpenOrderItem).sort()).toEqual(
      [
        'created_at',
        'destination',
        'distance_meters',
        'id',
        'note',
        'order_no',
        'pickup_location',
        'price',
      ].sort(),
    );

    const ids = body.data.map((item) => item.id);
    expect(ids).not.toContain(orders.draft);
    expect(ids).not.toContain(orders.accepted);
    expect(ids).not.toContain(orders.inProgress);
    expect(ids).not.toContain(orders.completed);
    expect(ids).not.toContain(orders.cancelled);
    expect(ids).not.toContain(orders.otherAccepted);
    expect(JSON.stringify(openItem)).not.toContain(users.acceptedBusy.driverId);
    expect(JSON.stringify(openItem)).not.toContain(users.other.id);
  });

  it('returns no open orders for OFFLINE, SUSPENDED, ACCEPTED, and IN_PROGRESS drivers', async () => {
    const offlineCookie = await loginAs(users.offline.username);
    const offlineResponse = await request(app.getHttpServer())
      .get('/api/v1/driver/orders/open')
      .set('Cookie', offlineCookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<OpenOrderItem[]>>(offlineResponse).data,
    ).toEqual([]);

    const suspendedCookie = await loginAs(users.suspended.username);
    await prisma.user.update({
      where: { id: users.suspended.id },
      data: { status: 'SUSPENDED' },
    });
    const suspendedResponse = await request(app.getHttpServer())
      .get('/api/v1/driver/orders/open')
      .set('Cookie', suspendedCookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<OpenOrderItem[]>>(suspendedResponse).data,
    ).toEqual([]);

    const acceptedCookie = await loginAs(users.acceptedBusy.username);
    const acceptedResponse = await request(app.getHttpServer())
      .get('/api/v1/driver/orders/open')
      .set('Cookie', acceptedCookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<OpenOrderItem[]>>(acceptedResponse).data,
    ).toEqual([]);

    const inProgressCookie = await loginAs(users.inProgressBusy.username);
    const inProgressResponse = await request(app.getHttpServer())
      .get('/api/v1/driver/orders/open')
      .set('Cookie', inProgressCookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<OpenOrderItem[]>>(inProgressResponse).data,
    ).toEqual([]);
  });

  it('lets a DRIVER view OPEN order detail without exposing driver identity', async () => {
    const cookie = await loginAs(users.viewer.username);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.open}`)
      .set('Cookie', cookie)
      .expect(200);

    const body = asBody<ApiSuccessBody<DriverOrderDetail>>(response);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: orders.open,
      order_no: `ORD-D8-OPEN-${suffix}`,
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      price: 1200,
      note: '2件行李',
      status: 'OPEN',
      distance_meters: null,
    });
    expect(typeof body.data.created_at).toBe('string');
    expect(
      body.data.pickup_latitude === null ||
        typeof body.data.pickup_latitude === 'number',
    ).toBe(true);
    expect(
      body.data.pickup_longitude === null ||
        typeof body.data.pickup_longitude === 'number',
    ).toBe(true);
    assertNoSecrets(body);
    expect(Object.keys(body.data).sort()).toEqual(
      [
        'created_at',
        'customer_name',
        'destination',
        'distance_meters',
        'id',
        'note',
        'order_no',
        'pickup_latitude',
        'pickup_location',
        'pickup_longitude',
        'price',
        'status',
      ].sort(),
    );
    expect(JSON.stringify(body)).not.toContain('driver_id');
    expect(JSON.stringify(body)).not.toContain(users.other.id);
  });

  it('lets a DRIVER view own ACCEPTED, IN_PROGRESS, COMPLETED, and CANCELLED orders', async () => {
    const acceptedCookie = await loginAs(users.acceptedBusy.username);
    const acceptedResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.accepted}`)
      .set('Cookie', acceptedCookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<DriverOrderDetail>>(acceptedResponse).data.status,
    ).toBe('ACCEPTED');

    const inProgressCookie = await loginAs(users.inProgressBusy.username);
    const inProgressResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.inProgress}`)
      .set('Cookie', inProgressCookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<DriverOrderDetail>>(inProgressResponse).data.status,
    ).toBe('IN_PROGRESS');

    const viewerCookie = await loginAs(users.viewer.username);
    const completedResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.completed}`)
      .set('Cookie', viewerCookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<DriverOrderDetail>>(completedResponse).data.status,
    ).toBe('COMPLETED');

    const cancelledResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.cancelled}`)
      .set('Cookie', viewerCookie)
      .expect(200);
    expect(
      asBody<ApiSuccessBody<DriverOrderDetail>>(cancelledResponse).data.status,
    ).toBe('CANCELLED');
  });

  it('hides other drivers assigned orders and missing orders as NOT_FOUND', async () => {
    const cookie = await loginAs(users.viewer.username);

    const otherResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.otherAccepted}`)
      .set('Cookie', cookie)
      .expect(404);
    const otherBody = asBody<ApiErrorBody>(otherResponse);
    expect(otherBody.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(otherBody)).not.toContain(users.other.id);
    expect(JSON.stringify(otherBody)).not.toContain(users.other.driverId);
    expect(JSON.stringify(otherBody).toLowerCase()).not.toContain('driver');

    const draftResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.draft}`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(draftResponse).error.code).toBe('NOT_FOUND');

    const missingResponse = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${randomUUID()}`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(missingResponse).error.code).toBe('NOT_FOUND');
  });

  it('does not mutate Order, Driver, or create OrderEvents on GET', async () => {
    const cookie = await loginAs(users.viewer.username);
    const beforeOrder = await prisma.order.findUnique({
      where: { id: orders.open },
    });
    const beforeDriver = await prisma.driver.findUnique({
      where: { id: users.viewer.driverId },
    });
    const beforeEvents = await prisma.orderEvent.count({
      where: { orderId: orders.open },
    });

    await request(app.getHttpServer())
      .get('/api/v1/driver/orders/open')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orders.open}`)
      .set('Cookie', cookie)
      .expect(200);

    const afterOrder = await prisma.order.findUnique({
      where: { id: orders.open },
    });
    const afterDriver = await prisma.driver.findUnique({
      where: { id: users.viewer.driverId },
    });
    const afterEvents = await prisma.orderEvent.count({
      where: { orderId: orders.open },
    });

    expect(afterOrder).toEqual(beforeOrder);
    expect(afterDriver).toEqual(beforeDriver);
    expect(afterEvents).toBe(beforeEvents);
  });

  it('returns 401 when unauthenticated driver accepts', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.open}/accept`)
      .expect(401);
    expect(asBody<ApiErrorBody>(response).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when an ADMIN accepts', async () => {
    const cookie = await loginAs(users.admin.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.open}/accept`)
      .set('Cookie', cookie)
      .send({ driver_id: users.claimer.driverId, user_id: users.claimer.id })
      .expect(403);
    expect(asBody<ApiErrorBody>(response).error.code).toBe('FORBIDDEN');
  });

  it('lets an ONLINE DRIVER accept an OPEN order and writes ORDER_ACCEPTED', async () => {
    const orderId = randomUUID();
    await seedOrder({ id: orderId, suffix: 'ACC1', status: 'OPEN' });
    const cookie = await loginAs(users.claimer.username);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/accept`)
      .set('Cookie', cookie)
      .send({
        driver_id: users.racerB.driverId,
        user_id: users.racerB.id,
      })
      .expect(200);

    const body = asBody<
      ApiSuccessBody<{
        id: string;
        status: string;
        driver_id: string;
        accepted_at: string;
      }>
    >(response);
    expect(body).toEqual({
      success: true,
      data: {
        id: orderId,
        status: 'ACCEPTED',
        driver_id: users.claimer.driverId,
        accepted_at: body.data.accepted_at,
      },
    });
    expect(new Date(body.data.accepted_at).toISOString()).toBe(
      body.data.accepted_at,
    );
    expect(JSON.stringify(body)).not.toMatch(/prisma|p2002|sql/i);

    const stored = await prisma.order.findUnique({ where: { id: orderId } });
    expect(stored?.status).toBe('ACCEPTED');
    expect(stored?.driverId).toBe(users.claimer.driverId);
    expect(stored?.acceptedAt).not.toBeNull();

    const events = await prisma.orderEvent.findMany({
      where: { orderId, eventType: 'ORDER_ACCEPTED' },
    });
    expect(events).toHaveLength(1);
    expect(events[0].actorUserId).toBe(users.claimer.id);
  });

  it('rejects OFFLINE, SUSPENDED, and drivers who already have an unfinished order', async () => {
    const openForOffline = randomUUID();
    const openForBusy = randomUUID();
    const openForSuspended = randomUUID();
    await seedOrder({ id: openForOffline, suffix: 'OFFA', status: 'OPEN' });
    await seedOrder({ id: openForBusy, suffix: 'BUSY', status: 'OPEN' });
    await seedOrder({
      id: openForSuspended,
      suffix: 'SUSO',
      status: 'OPEN',
    });

    const offline = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${openForOffline}/accept`)
      .set('Cookie', await loginAs(users.offline.username))
      .expect(409);
    expect(asBody<ApiErrorBody>(offline).error.code).toBe('DRIVER_OFFLINE');
    expect(
      await prisma.orderEvent.count({
        where: { orderId: openForOffline, eventType: 'ORDER_ACCEPTED' },
      }),
    ).toBe(0);

    const acceptedBusy = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${openForBusy}/accept`)
      .set('Cookie', await loginAs(users.acceptedBusy.username))
      .expect(409);
    expect(asBody<ApiErrorBody>(acceptedBusy).error.code).toBe(
      'DRIVER_HAS_ACTIVE_ORDER',
    );

    const inProgressBusy = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${openForBusy}/accept`)
      .set('Cookie', await loginAs(users.inProgressBusy.username))
      .expect(409);
    expect(asBody<ApiErrorBody>(inProgressBusy).error.code).toBe(
      'DRIVER_HAS_ACTIVE_ORDER',
    );

    const suspendCookie = await loginAs(users.suspendTarget.username);
    await prisma.user.update({
      where: { id: users.suspendTarget.id },
      data: { status: 'SUSPENDED' },
    });
    const stillHasSession = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${openForSuspended}/accept`)
      .set('Cookie', suspendCookie)
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
      .post(`/api/v1/driver/orders/${openForSuspended}/accept`)
      .set('Cookie', activeCookie)
      .expect(401);
    expect(asBody<ApiErrorBody>(afterRevoke).error.code).toBe('UNAUTHORIZED');
    expect(
      await prisma.orderEvent.count({
        where: { orderId: openForSuspended, eventType: 'ORDER_ACCEPTED' },
      }),
    ).toBe(0);
  });

  it('rejects non-OPEN and missing orders with the mapped API error', async () => {
    const cookie = await loginAs(users.racerB.username);

    const draft = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.draft}/accept`)
      .set('Cookie', cookie)
      .expect(409);
    expect(asBody<ApiErrorBody>(draft).error.code).toBe('INVALID_ORDER_STATUS');

    const already = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orders.otherAccepted}/accept`)
      .set('Cookie', cookie)
      .expect(409);
    expect(asBody<ApiErrorBody>(already).error.code).toBe(
      'ORDER_ALREADY_ACCEPTED',
    );

    const missing = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${randomUUID()}/accept`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(missing).error.code).toBe('NOT_FOUND');

    const invalidId = await request(app.getHttpServer())
      .post('/api/v1/driver/orders/not-a-uuid/accept')
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(invalidId).error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(invalidId.body)).not.toMatch(/prisma|p2002|sql/i);
  });

  it('allows only one DRIVER to win when three accept the same OPEN order concurrently', async () => {
    const orderId = randomUUID();
    await seedOrder({ id: orderId, suffix: 'RACE', status: 'OPEN' });

    const cookies = await Promise.all([
      loginAs(users.racerB.username),
      loginAs(users.racerC.username),
      loginAs(users.viewer.username),
    ]);

    const responses = await Promise.all(
      cookies.map((cookie) =>
        request(app.getHttpServer())
          .post(`/api/v1/driver/orders/${orderId}/accept`)
          .set('Cookie', cookie),
      ),
    );

    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(2);

    const winner = responses.find((response) => response.status === 200);
    const winnerBody = asBody<
      ApiSuccessBody<{ driver_id: string; status: string }>
    >(winner!);
    expect(winnerBody.data.status).toBe('ACCEPTED');
    expect([
      users.racerB.driverId,
      users.racerC.driverId,
      users.viewer.driverId,
    ]).toContain(winnerBody.data.driver_id);

    for (const response of responses.filter((item) => item.status === 409)) {
      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'ORDER_ALREADY_ACCEPTED',
      );
      expect(JSON.stringify(response.body)).not.toMatch(/prisma|p2002|sql/i);
    }

    const stored = await prisma.order.findUnique({ where: { id: orderId } });
    expect(stored?.status).toBe('ACCEPTED');
    expect(stored?.driverId).toBe(winnerBody.data.driver_id);
    expect(
      await prisma.orderEvent.count({
        where: { orderId, eventType: 'ORDER_ACCEPTED' },
      }),
    ).toBe(1);
  });

  it('lets a DRIVER keep at most one unfinished order when accepting two OPEN orders concurrently', async () => {
    const first = randomUUID();
    const second = randomUUID();
    await seedOrder({ id: first, suffix: 'DUAL1', status: 'OPEN' });
    await seedOrder({ id: second, suffix: 'DUAL2', status: 'OPEN' });
    const cookie = await loginAs(users.dual.username);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${first}/accept`)
        .set('Cookie', cookie),
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${second}/accept`)
        .set('Cookie', cookie),
    ]);

    const successes = responses.filter((response) => response.status === 200);
    const failures = responses.filter((response) => response.status !== 200);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(asBody<ApiErrorBody>(failures[0]).error.code).toBe(
      'DRIVER_HAS_ACTIVE_ORDER',
    );
    expect(JSON.stringify(failures[0].body)).not.toMatch(/prisma|p2002|sql/i);

    const unfinished = await prisma.order.count({
      where: {
        driverId: users.dual.driverId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      },
    });
    expect(unfinished).toBe(1);

    const acceptedEvents = await prisma.orderEvent.count({
      where: {
        orderId: { in: [first, second] },
        eventType: 'ORDER_ACCEPTED',
      },
    });
    expect(acceptedEvents).toBe(1);
  });
});
