import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SESSION_COOKIE_NAME } from '../src/common/cookie/cookie.config';
import { WebPushService } from '../src/notifications/web-push.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'OrderPublishP@ss-never-log-this';

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

type CreateOrderData = {
  id: string;
  order_no: string;
  status: string;
};

type PublishData = {
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
}

describe('Admin Order Publish (e2e)', () => {
  let app: INestApplication<App>;
  const webPushSend = jest.fn();
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d7-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `d7-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D7A-${suffix}`,
    },
    online: {
      id: randomUUID(),
      username: `d7-online-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D7B-${suffix}`,
    },
    offline: {
      id: randomUUID(),
      username: `d7-offline-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D7C-${suffix}`,
    },
    suspended: {
      id: randomUUID(),
      username: `d7-suspended-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D7D-${suffix}`,
    },
    acceptedBusy: {
      id: randomUUID(),
      username: `d7-accepted-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D7E-${suffix}`,
    },
    inProgressBusy: {
      id: randomUUID(),
      username: `d7-inprogress-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D7F-${suffix}`,
    },
  };

  function orderPayload() {
    return {
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
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

  async function adminCookie() {
    return loginAs(users.admin.username);
  }

  async function createDraft(cookie: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send(orderPayload())
      .expect(200);
    return asBody<ApiSuccessBody<CreateOrderData>>(response).data;
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

  async function seedAssignedOrder(
    driverId: string,
    status: 'ACCEPTED' | 'IN_PROGRESS',
  ) {
    await prisma.order.create({
      data: {
        orderNo: `ORD-D7-${status}-${suffix}`,
        customerName: '測試乘客',
        pickupLocation: '左營高鐵站',
        destination: '高雄小港機場',
        price: new Prisma.Decimal('1200.00'),
        status,
        dispatchMode: 'OPEN',
        driverId,
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

    await createDriverUser(users.driver);
    await createDriverUser(users.online, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.offline, { onlineStatus: 'OFFLINE' });
    await createDriverUser(users.suspended, {
      accountStatus: 'SUSPENDED',
      onlineStatus: 'ONLINE',
    });
    await createDriverUser(users.acceptedBusy, { onlineStatus: 'ONLINE' });
    await createDriverUser(users.inProgressBusy, { onlineStatus: 'ONLINE' });
    await seedAssignedOrder(users.acceptedBusy.driverId, 'ACCEPTED');
    await seedAssignedOrder(users.inProgressBusy.driverId, 'IN_PROGRESS');
    await prisma.pushSubscription.create({
      data: {
        userId: users.online.id,
        endpoint: `https://push.example.test/d7-online-${suffix}`,
        p256dh: 'p256dh-test',
        auth: 'auth-test',
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

  it('returns 401 when unauthenticated', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${randomUUID()}/publish`)
      .expect(401);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when a DRIVER publishes', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${randomUUID()}/publish`)
      .set('Cookie', cookie)
      .expect(403);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('FORBIDDEN');
  });

  it('publishes a DRAFT order to OPEN and writes ORDER_PUBLISHED', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${created.id}/publish`)
      .set('Cookie', cookie)
      .expect(200);

    const body = asBody<ApiSuccessBody<PublishData>>(response);
    expect(body).toEqual({
      success: true,
      data: {
        id: created.id,
        status: 'OPEN',
      },
    });
    assertNoSecrets(body);

    const order = await prisma.order.findUnique({ where: { id: created.id } });
    expect(order?.status).toBe('OPEN');
    expect(order?.driverId).toBeNull();

    const event = await prisma.orderEvent.findFirst({
      where: {
        orderId: created.id,
        eventType: 'ORDER_PUBLISHED',
      },
    });
    expect(event?.actorUserId).toBe(users.admin.id);
  });

  it('rejects publish for non-DRAFT orders', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);
    const statuses: OrderStatus[] = [
      'OPEN',
      'ACCEPTED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ];

    for (const status of statuses) {
      await prisma.order.update({
        where: { id: created.id },
        data: { status, driverId: null },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${created.id}/publish`)
        .set('Cookie', cookie)
        .expect(409);

      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'INVALID_ORDER_STATUS',
      );
    }
  });

  it('returns 404 when the order does not exist', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${randomUUID()}/publish`)
      .set('Cookie', cookie)
      .expect(404);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('NOT_FOUND');
  });

  it('ignores client-supplied status, driver_id, and other state fields', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${created.id}/publish`)
      .set('Cookie', cookie)
      .send({
        status: 'ACCEPTED',
        driver_id: users.online.driverId,
        dispatch_mode: 'AUTO',
        accepted_at: '2026-09-15T07:05:00Z',
        started_at: '2026-09-15T07:30:00Z',
        completed_at: '2026-09-15T08:20:00Z',
        cancelled_at: '2026-09-15T08:00:00Z',
      })
      .expect(200);

    expect(asBody<ApiSuccessBody<PublishData>>(response).data.status).toBe(
      'OPEN',
    );

    const order = await prisma.order.findUnique({ where: { id: created.id } });
    expect(order?.status).toBe('OPEN');
    expect(order?.driverId).toBeNull();
    expect(order?.dispatchMode).toBe('OPEN');
    expect(order?.acceptedAt).toBeNull();
    expect(order?.startedAt).toBeNull();
    expect(order?.completedAt).toBeNull();
    expect(order?.cancelledAt).toBeNull();
  });

  it('creates SENT notifications only for ACTIVE ONLINE drivers with a PushSubscription', async () => {
    const cookie = await adminCookie();
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
    expect(userIds).not.toContain(users.offline.id);
    expect(userIds).not.toContain(users.suspended.id);
    expect(userIds).not.toContain(users.driver.id);
    expect(userIds).not.toContain(users.acceptedBusy.id);
    expect(userIds).not.toContain(users.inProgressBusy.id);

    const onlineNotification = notifications.find(
      (item) => item.userId === users.online.id,
    );
    expect(onlineNotification?.status).toBe('SENT');
    expect(onlineNotification?.sentAt).not.toBeNull();
    expect(webPushSend).toHaveBeenCalled();
  });

  it('notifies ACTIVE ONLINE drivers who already have ACCEPTED or IN_PROGRESS orders', async () => {
    await prisma.pushSubscription.createMany({
      data: [
        {
          userId: users.acceptedBusy.id,
          endpoint: `https://push.example.test/d7-accepted-${suffix}`,
          p256dh: 'p256dh-test',
          auth: 'auth-test',
        },
        {
          userId: users.inProgressBusy.id,
          endpoint: `https://push.example.test/d7-inprogress-${suffix}`,
          p256dh: 'p256dh-test',
          auth: 'auth-test',
        },
      ],
    });

    const cookie = await adminCookie();
    const created = await createDraft(cookie);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${created.id}/publish`)
      .set('Cookie', cookie)
      .expect(200);

    const notifications = await prisma.notification.findMany({
      where: {
        orderId: created.id,
        userId: {
          in: [users.online.id, users.acceptedBusy.id, users.inProgressBusy.id],
        },
      },
    });
    const userIds = notifications.map((item) => item.userId);

    expect(userIds).toContain(users.online.id);
    expect(userIds).toContain(users.acceptedBusy.id);
    expect(userIds).toContain(users.inProgressBusy.id);
    expect(notifications.every((item) => item.status === 'SENT')).toBe(true);

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: { in: [users.acceptedBusy.id, users.inProgressBusy.id] },
      },
    });
  });

  it('publishes successfully with zero notifications when no local driver is eligible', async () => {
    await prisma.driver.update({
      where: { id: users.online.driverId },
      data: { onlineStatus: 'OFFLINE' },
    });

    const cookie = await adminCookie();
    const created = await createDraft(cookie);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${created.id}/publish`)
      .set('Cookie', cookie)
      .expect(200);

    const localUserIds = [
      users.online.id,
      users.offline.id,
      users.suspended.id,
      users.driver.id,
      users.acceptedBusy.id,
      users.inProgressBusy.id,
    ];
    const localNotifications = await prisma.notification.count({
      where: {
        orderId: created.id,
        userId: { in: localUserIds },
      },
    });
    expect(localNotifications).toBe(0);

    const order = await prisma.order.findUnique({ where: { id: created.id } });
    expect(order?.status).toBe('OPEN');
    expect(
      await prisma.orderEvent.count({
        where: { orderId: created.id, eventType: 'ORDER_PUBLISHED' },
      }),
    ).toBe(1);

    await prisma.driver.update({
      where: { id: users.online.driverId },
      data: { onlineStatus: 'ONLINE' },
    });
  });

  it('rolls back order, event, and notifications if notification creation fails', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);
    const prismaService = app.get(PrismaService);
    type InteractiveTransaction = (
      fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => Promise<unknown>;
    const runTransaction = prismaService.$transaction.bind(
      prismaService,
    ) as InteractiveTransaction;
    const spy = jest
      .spyOn(prismaService, '$transaction')
      .mockImplementation(
        (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          runTransaction(async (tx) => {
            jest
              .spyOn(tx.notification, 'createMany')
              .mockRejectedValue(new Error('notification create failed'));
            return fn(tx);
          }),
      );

    try {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders/${created.id}/publish`)
        .set('Cookie', cookie)
        .expect(500);

      expect(asBody<ApiErrorBody>(response).error.code).toBe('INTERNAL_ERROR');

      const order = await prisma.order.findUnique({
        where: { id: created.id },
      });
      expect(order?.status).toBe('DRAFT');
      expect(
        await prisma.orderEvent.count({
          where: { orderId: created.id, eventType: 'ORDER_PUBLISHED' },
        }),
      ).toBe(0);
      expect(
        await prisma.notification.count({ where: { orderId: created.id } }),
      ).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('allows only one concurrent publish of the same DRAFT order', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);

    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(`/api/v1/orders/${created.id}/publish`)
          .set('Cookie', cookie),
      ),
    );

    const statuses = responses.map((response) => response.status);
    expect(statuses.sort()).toEqual([200, 409]);

    const failed = responses.find((response) => response.status === 409);
    expect(asBody<ApiErrorBody>(failed as request.Response).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );

    const order = await prisma.order.findUnique({ where: { id: created.id } });
    expect(order?.status).toBe('OPEN');
    expect(
      await prisma.orderEvent.count({
        where: { orderId: created.id, eventType: 'ORDER_PUBLISHED' },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { orderId: created.id, userId: users.online.id },
      }),
    ).toBe(1);
  });

  it('does not allow PUT after the order is OPEN', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${created.id}/publish`)
      .set('Cookie', cookie)
      .expect(200);

    const response = await request(app.getHttpServer())
      .put(`/api/v1/orders/${created.id}`)
      .set('Cookie', cookie)
      .send(orderPayload())
      .expect(409);

    expect(asBody<ApiErrorBody>(response).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );
  });
});
