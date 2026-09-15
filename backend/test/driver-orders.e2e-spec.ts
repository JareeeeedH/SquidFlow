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
  scheduled_at: string;
  pickup_location: string;
  destination: string;
  vehicle_type: string;
  price: number;
  note: string | null;
};

type DriverOrderDetail = {
  id: string;
  order_no: string;
  customer_name: string;
  pickup_location: string;
  destination: string;
  scheduled_at: string;
  vehicle_type: string;
  price: number;
  note: string | null;
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
        scheduledAt: new Date('2026-09-15T07:30:00Z'),
        vehicleType: '5人座',
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
      scheduled_at: new Date('2026-09-15T07:30:00Z').toISOString(),
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      vehicle_type: '5人座',
      price: 1200,
      note: '2件行李',
    });
    expect(Object.keys(openItem as OpenOrderItem).sort()).toEqual(
      [
        'destination',
        'id',
        'note',
        'order_no',
        'pickup_location',
        'price',
        'scheduled_at',
        'vehicle_type',
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
    expect(body).toEqual({
      success: true,
      data: {
        id: orders.open,
        order_no: `ORD-D8-OPEN-${suffix}`,
        customer_name: '王先生',
        pickup_location: '左營高鐵站',
        destination: '高雄小港機場',
        scheduled_at: new Date('2026-09-15T07:30:00Z').toISOString(),
        vehicle_type: '5人座',
        price: 1200,
        note: '2件行李',
        status: 'OPEN',
      },
    });
    assertNoSecrets(body);
    expect(Object.keys(body.data).sort()).toEqual(
      [
        'customer_name',
        'destination',
        'id',
        'note',
        'order_no',
        'pickup_location',
        'price',
        'scheduled_at',
        'status',
        'vehicle_type',
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

  it('does not mutate Order, Driver, or create ORDER_VIEWED on GET', async () => {
    const cookie = await loginAs(users.viewer.username);
    const beforeOrder = await prisma.order.findUnique({
      where: { id: orders.open },
    });
    const beforeDriver = await prisma.driver.findUnique({
      where: { id: users.viewer.driverId },
    });
    const beforeEvents = await prisma.orderEvent.count({
      where: { orderId: orders.open, eventType: 'ORDER_VIEWED' },
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
      where: { orderId: orders.open, eventType: 'ORDER_VIEWED' },
    });

    expect(afterOrder).toEqual(beforeOrder);
    expect(afterDriver).toEqual(beforeDriver);
    expect(afterEvents).toBe(beforeEvents);
    expect(afterEvents).toBe(0);
  });
});
