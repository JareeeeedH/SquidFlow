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
import { NotificationsService } from '../src/notifications/notifications.service';
import { WebPushService } from '../src/notifications/web-push.service';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'NotifyTestP@ss-never-log-this';

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

function assertNoSecrets(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toContain('password_hash');
  expect(text).not.toContain('passwordHash');
  expect(text).not.toMatch(/"password"\s*:/);
}

describe('Web Push Notifications (e2e)', () => {
  let app: INestApplication<App>;
  const webPushSend = jest.fn();
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d12-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `d12-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D12A-${suffix}`,
    },
    otherDriver: {
      id: randomUUID(),
      username: `d12-other-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D12B-${suffix}`,
    },
    online: {
      id: randomUUID(),
      username: `d12-online-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D12C-${suffix}`,
    },
    offline: {
      id: randomUUID(),
      username: `d12-offline-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D12D-${suffix}`,
    },
    suspended: {
      id: randomUUID(),
      username: `d12-suspended-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D12E-${suffix}`,
    },
    acceptedBusy: {
      id: randomUUID(),
      username: `d12-accepted-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D12F-${suffix}`,
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

  async function createDraft(cookie: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send(orderPayload())
      .expect(200);
    return asBody<ApiSuccessBody<{ id: string }>>(response).data;
  }

  function subscriptionBody(endpoint: string) {
    return {
      endpoint,
      p256dh: 'p256dh-test',
      auth: 'auth-test',
    };
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

    await createDriverUser(users.driver);
    await createDriverUser(users.otherDriver, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.online, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.offline, { onlineStatus: 'OFFLINE' });
    await createDriverUser(users.suspended, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.acceptedBusy, { onlineStatus: 'ONLINE' });
    await prisma.order.create({
      data: {
        orderNo: `ORD-D12-BUSY-${suffix}`,
        customerName: '測試乘客',
        pickupLocation: '左營高鐵站',
        destination: '小港機場',
        price: new Prisma.Decimal('1200.00'),
        status: 'ACCEPTED',
        dispatchMode: 'OPEN',
        driverId: users.acceptedBusy.driverId,
        createdBy: users.admin.id,
      },
    });

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

  describe('subscription create / replace / delete', () => {
    it('returns 401 when unauthenticated', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .send(subscriptionBody(`https://push.example.test/${randomUUID()}`))
        .expect(401);

      expect(asBody<ApiErrorBody>(response).error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when an Admin creates a subscription', async () => {
      const cookie = await loginAs(users.admin.username);
      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send(subscriptionBody(`https://push.example.test/${randomUUID()}`))
        .expect(403);

      expect(asBody<ApiErrorBody>(response).error.code).toBe('FORBIDDEN');
    });

    it('rejects a leftover session after the Driver is SUSPENDED', async () => {
      const cookie = await loginAs(users.suspended.username);
      await prisma.user.update({
        where: { id: users.suspended.id },
        data: { status: 'SUSPENDED' },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send(subscriptionBody(`https://push.example.test/${randomUUID()}`))
        .expect(403);

      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'ACCOUNT_SUSPENDED',
      );

      await prisma.user.update({
        where: { id: users.suspended.id },
        data: { status: 'ACTIVE' },
      });
    });

    it('creates a subscription and replaces the previous one for the same user', async () => {
      const cookie = await loginAs(users.driver.username);
      const firstEndpoint = `https://push.example.test/first-${suffix}`;
      const secondEndpoint = `https://push.example.test/second-${suffix}`;

      const first = await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send(subscriptionBody(firstEndpoint))
        .expect(200);

      const firstBody = asBody<ApiSuccessBody<{ id: string }>>(first);
      expect(firstBody.success).toBe(true);
      expect(firstBody.data.id).toEqual(expect.any(String));
      assertNoSecrets(firstBody);

      const second = await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send(subscriptionBody(secondEndpoint))
        .expect(200);

      const secondBody = asBody<ApiSuccessBody<{ id: string }>>(second);
      expect(secondBody.data.id).not.toBe(firstBody.data.id);

      const rows = await prisma.pushSubscription.findMany({
        where: { userId: users.driver.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].endpoint).toBe(secondEndpoint);
    });

    it('lets a later Driver take over an endpoint that already belongs to another user', async () => {
      const sharedEndpoint = `https://push.example.test/shared-${suffix}`;
      const firstCookie = await loginAs(users.otherDriver.username);
      await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', firstCookie)
        .send(subscriptionBody(sharedEndpoint))
        .expect(200);

      const secondCookie = await loginAs(users.driver.username);
      await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', secondCookie)
        .send(subscriptionBody(sharedEndpoint))
        .expect(200);

      expect(
        await prisma.pushSubscription.count({
          where: { endpoint: sharedEndpoint },
        }),
      ).toBe(1);
      expect(
        await prisma.pushSubscription.findUnique({
          where: { userId: users.driver.id },
        }),
      ).toMatchObject({ endpoint: sharedEndpoint });
      expect(
        await prisma.pushSubscription.findUnique({
          where: { userId: users.otherDriver.id },
        }),
      ).toBeNull();
    });

    it('deletes the current subscription by endpoint and is idempotent', async () => {
      const cookie = await loginAs(users.driver.username);
      const endpoint = `https://push.example.test/delete-${suffix}`;
      await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send(subscriptionBody(endpoint))
        .expect(200);

      const response = await request(app.getHttpServer())
        .delete('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send({ endpoint })
        .expect(200);

      expect(asBody<ApiSuccessBody<null>>(response)).toEqual({
        success: true,
        data: null,
      });
      expect(
        await prisma.pushSubscription.count({
          where: { userId: users.driver.id },
        }),
      ).toBe(0);

      await request(app.getHttpServer())
        .delete('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send({ endpoint })
        .expect(200);
    });

    it('does not delete another Driver subscription', async () => {
      const ownEndpoint = `https://push.example.test/own-${suffix}`;
      const otherEndpoint = `https://push.example.test/foreign-${suffix}`;
      const driverCookie = await loginAs(users.driver.username);
      const otherCookie = await loginAs(users.otherDriver.username);

      await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', driverCookie)
        .send(subscriptionBody(ownEndpoint))
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', otherCookie)
        .send(subscriptionBody(otherEndpoint))
        .expect(200);

      await request(app.getHttpServer())
        .delete('/api/v1/notifications/subscription')
        .set('Cookie', driverCookie)
        .send({ endpoint: otherEndpoint })
        .expect(200);

      expect(
        await prisma.pushSubscription.findUnique({
          where: { userId: users.otherDriver.id },
        }),
      ).toMatchObject({ endpoint: otherEndpoint });
    });

    it('removes the current subscription on logout', async () => {
      const cookie = await loginAs(users.driver.username);
      const endpoint = `https://push.example.test/logout-${suffix}`;
      await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send(subscriptionBody(endpoint))
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      expect(
        await prisma.pushSubscription.count({
          where: { userId: users.driver.id },
        }),
      ).toBe(0);
    });

    it('returns VALIDATION_ERROR when required fields are missing', async () => {
      const cookie = await loginAs(users.driver.username);
      const response = await request(app.getHttpServer())
        .post('/api/v1/notifications/subscription')
        .set('Cookie', cookie)
        .send({ endpoint: 'https://push.example.test/missing' })
        .expect(400);

      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'VALIDATION_ERROR',
      );
    });
  });

  describe('publish delivery', () => {
    async function subscribe(userId: string, label: string) {
      await prisma.pushSubscription.deleteMany({ where: { userId } });
      await prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: `https://push.example.test/${label}-${suffix}`,
          p256dh: 'p256dh-test',
          auth: 'auth-test',
        },
      });
    }

    it('creates PENDING then SENT for eligible Drivers, including a busy Driver', async () => {
      await subscribe(users.online.id, 'online');
      await subscribe(users.acceptedBusy.id, 'busy');
      await subscribe(users.offline.id, 'offline');

      const cookie = await loginAs(users.admin.username);
      const created = await createDraft(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${created.id}/publish`)
        .set('Cookie', cookie)
        .expect(200);

      const notifications = await prisma.notification.findMany({
        where: { orderId: created.id },
      });
      const userIds = notifications.map((item) => item.userId);

      expect(userIds).toContain(users.online.id);
      expect(userIds).toContain(users.acceptedBusy.id);
      expect(userIds).not.toContain(users.offline.id);
      expect(userIds).not.toContain(users.driver.id);
      expect(
        notifications.every((item) => item.status === 'SENT' && item.sentAt),
      ).toBe(true);
      expect(webPushSend.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('does not notify an ONLINE Driver without a PushSubscription', async () => {
      await prisma.pushSubscription.deleteMany({
        where: { userId: users.otherDriver.id },
      });

      const cookie = await loginAs(users.admin.username);
      const created = await createDraft(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${created.id}/publish`)
        .set('Cookie', cookie)
        .expect(200);

      expect(
        await prisma.notification.count({
          where: { orderId: created.id, userId: users.otherDriver.id },
        }),
      ).toBe(0);
    });

    it('does not send PENDING notifications after the Order is no longer OPEN', async () => {
      const orderId = randomUUID();
      const notificationId = randomUUID();
      await subscribe(users.online.id, 'skip-open');
      await prisma.order.create({
        data: {
          id: orderId,
          orderNo: `ORD-D12-SKIP-${suffix}`,
          customerName: '王先生',
          pickupLocation: '左營高鐵站',
          destination: '小港機場',
          price: new Prisma.Decimal('1200.00'),
          status: 'CANCELLED',
          dispatchMode: 'OPEN',
          createdBy: users.admin.id,
          notifications: {
            create: {
              id: notificationId,
              userId: users.online.id,
              status: 'PENDING',
            },
          },
        },
      });

      await app.get(NotificationsService).deliverPendingForOrder(orderId);

      expect(webPushSend).not.toHaveBeenCalled();
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });
      expect(notification?.status).toBe('PENDING');
      expect(notification?.sentAt).toBeNull();
    });

    it('removes an invalid subscription and marks the Notification FAILED', async () => {
      await subscribe(users.online.id, 'invalid');
      webPushSend.mockResolvedValue({ ok: false, invalid: true });

      const cookie = await loginAs(users.admin.username);
      const created = await createDraft(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${created.id}/publish`)
        .set('Cookie', cookie)
        .expect(200);

      const notification = await prisma.notification.findFirst({
        where: { orderId: created.id, userId: users.online.id },
      });
      expect(notification?.status).toBe('FAILED');
      expect(
        await prisma.pushSubscription.findUnique({
          where: { userId: users.online.id },
        }),
      ).toBeNull();
    });

    it('does not change Order state when Web Push fails', async () => {
      await subscribe(users.online.id, 'fail-keep');
      webPushSend.mockRejectedValue(new Error('push provider down'));

      const cookie = await loginAs(users.admin.username);
      const created = await createDraft(cookie);
      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${created.id}/publish`)
        .set('Cookie', cookie)
        .expect(200);

      expect(
        asBody<ApiSuccessBody<{ status: string }>>(response).data.status,
      ).toBe('OPEN');
      const order = await prisma.order.findUnique({
        where: { id: created.id },
      });
      expect(order?.status).toBe('OPEN');
      const notification = await prisma.notification.findFirst({
        where: { orderId: created.id, userId: users.online.id },
      });
      expect(notification?.status).toBe('FAILED');
      expect(
        await prisma.pushSubscription.findUnique({
          where: { userId: users.online.id },
        }),
      ).not.toBeNull();
    });

    it('creates only one Notification per eligible Driver for a single Publish', async () => {
      await subscribe(users.online.id, 'dup');

      const cookie = await loginAs(users.admin.username);
      const created = await createDraft(cookie);
      await request(app.getHttpServer())
        .post(`/api/v1/orders/${created.id}/publish`)
        .set('Cookie', cookie)
        .expect(200);

      expect(
        await prisma.notification.count({
          where: { orderId: created.id, userId: users.online.id },
        }),
      ).toBe(1);
    });
  });
});
