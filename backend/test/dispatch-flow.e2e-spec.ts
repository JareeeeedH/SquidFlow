import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SESSION_COOKIE_NAME } from '../src/common/cookie/cookie.config';
import { WebPushService } from '../src/notifications/web-push.service';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'DispatchFlowP@ss-never-log-this';

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

function asBody<T>(response: request.Response): T {
  return response.body as T;
}

describe('Dispatch end-to-end flow (e2e)', () => {
  let app: INestApplication<App>;
  const webPushSend = jest.fn();
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d14-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `d14-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D14A-${suffix}`,
    },
    offline: {
      id: randomUUID(),
      username: `d14-offline-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D14B-${suffix}`,
    },
    rival: {
      id: randomUUID(),
      username: `d14-rival-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D14C-${suffix}`,
    },
  };

  function orderPayload() {
    return {
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '小港機場',
      price: 1200,
      note: '2件行李',
    };
  }

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
    onlineStatus: 'ONLINE' | 'OFFLINE',
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
            onlineStatus,
          },
        },
      },
    });
  }

  async function subscribe(userId: string, label: string) {
    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: `https://push.example.test/${label}-${suffix}`,
        p256dh: 'p256dh-test',
        auth: 'auth-test',
      },
    });
  }

  async function createAndPublish(adminCookie: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', adminCookie)
      .send(orderPayload())
      .expect(200);
    const id = asBody<ApiSuccessBody<{ id: string }>>(created).data.id;
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${id}/publish`)
      .set('Cookie', adminCookie)
      .expect(200);
    return id;
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
    await createDriverUser(users.driver, 'ONLINE');
    await createDriverUser(users.offline, 'OFFLINE');
    await createDriverUser(users.rival, 'ONLINE');
    await subscribe(users.driver.id, 'driver');
    await subscribe(users.rival.id, 'rival');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WebPushService)
      .useValue({ send: webPushSend })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  beforeEach(() => {
    webPushSend.mockReset();
    webPushSend.mockResolvedValue({ ok: true });
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

  it('completes OPEN → ACCEPTED → IN_PROGRESS → COMPLETED after publish', async () => {
    const adminCookie = await loginAs(users.admin.username);
    const orderId = await createAndPublish(adminCookie);

    const published = await prisma.order.findUnique({ where: { id: orderId } });
    expect(published?.status).toBe('OPEN');
    expect(
      await prisma.notification.findFirst({
        where: { orderId, userId: users.driver.id },
      }),
    ).toMatchObject({ status: 'SENT' });
    expect(webPushSend).toHaveBeenCalled();

    const driverCookie = await loginAs(users.driver.username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/accept`)
      .set('Cookie', driverCookie)
      .expect(200);
    expect(
      (await prisma.order.findUnique({ where: { id: orderId } }))?.status,
    ).toBe('ACCEPTED');

    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/start`)
      .set('Cookie', driverCookie)
      .expect(200);
    expect(
      (await prisma.order.findUnique({ where: { id: orderId } }))?.status,
    ).toBe('IN_PROGRESS');

    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', driverCookie)
      .expect(200);

    const completed = await prisma.order.findUnique({ where: { id: orderId } });
    expect(completed?.status).toBe('COMPLETED');
    expect(completed?.driverId).toBe(users.driver.driverId);
    expect(
      await prisma.orderEvent.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
        select: { eventType: true },
      }),
    ).toEqual([
      { eventType: 'ORDER_CREATED' },
      { eventType: 'ORDER_PUBLISHED' },
      { eventType: 'ORDER_ACCEPTED' },
      { eventType: 'ORDER_STARTED' },
      { eventType: 'ORDER_COMPLETED' },
    ]);
  });

  it('rejects offline accept, busy accept, and lets only one concurrent claim win', async () => {
    const adminCookie = await loginAs(users.admin.username);
    const orderId = await createAndPublish(adminCookie);
    const offlineCookie = await loginAs(users.offline.username);
    const driverCookie = await loginAs(users.driver.username);
    const rivalCookie = await loginAs(users.rival.username);

    const offline = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/accept`)
      .set('Cookie', offlineCookie)
      .expect(409);
    expect(asBody<ApiErrorBody>(offline).error.code).toBe('DRIVER_OFFLINE');

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/accept`)
        .set('Cookie', driverCookie),
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/accept`)
        .set('Cookie', rivalCookie),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const failed = first.status === 409 ? first : second;
    expect(asBody<ApiErrorBody>(failed).error.code).toBe(
      'ORDER_ALREADY_ACCEPTED',
    );
    const winnerCookie = first.status === 200 ? driverCookie : rivalCookie;

    const otherOpen = await createAndPublish(adminCookie);
    const busy = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${otherOpen}/accept`)
      .set('Cookie', winnerCookie)
      .expect(409);
    expect(asBody<ApiErrorBody>(busy).error.code).toBe(
      'DRIVER_HAS_ACTIVE_ORDER',
    );
  });

  it('keeps Order OPEN when push fails, then Admin can still cancel', async () => {
    webPushSend.mockRejectedValue(new Error('push provider down'));
    const adminCookie = await loginAs(users.admin.username);
    const orderId = await createAndPublish(adminCookie);

    const afterPush = await prisma.order.findUnique({ where: { id: orderId } });
    expect(afterPush?.status).toBe('OPEN');
    expect(
      await prisma.notification.findFirst({
        where: { orderId, userId: users.driver.id },
      }),
    ).toMatchObject({ status: 'FAILED' });

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(
      (await prisma.order.findUnique({ where: { id: orderId } }))?.status,
    ).toBe('CANCELLED');
  });
});
