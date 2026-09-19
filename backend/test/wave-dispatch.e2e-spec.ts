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
import {
  DEFAULT_WAVE_DISPATCH_OPTIONS,
  WAVE_DISPATCH_OPTIONS,
} from '../src/dispatch/wave-dispatch.constants';
import { GeocodingService } from '../src/geocoding/geocoding.service';
import { WebPushService } from '../src/notifications/web-push.service';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';
import {
  overrideGeocodingForWaveTests,
  setDriverGps,
} from './wave-dispatch-test-utils';

config();

const prisma = new PrismaClient();
const password = 'WaveDispatchP@ss-never-log-this';

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

type ApiSuccessBody<T> = {
  success: true;
  data: T;
};

function asBody<T>(response: request.Response): T {
  return response.body as T;
}

describe('Wave Dispatch (e2e)', () => {
  let app: INestApplication<App>;
  const webPushSend = jest.fn();
  const suffix = randomUUID().slice(0, 8);
  const admin = {
    id: randomUUID(),
    username: `wave-admin-${suffix}`,
  };
  const drivers = Array.from({ length: 7 }, (_, index) => ({
    id: randomUUID(),
    username: `wave-d${index}-${suffix}`,
    driverId: randomUUID(),
    licensePlate: `WV${index}-${suffix}`.slice(0, 20),
  }));

  async function loginAs(username: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    return sessionCookie(response) as string;
  }

  async function createAndPublish(adminCookie: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', adminCookie)
      .send({
        customer_name: '王先生',
        pickup_location: '左營高鐵站',
        destination: '小港機場',
        price: 1200,
      })
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
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        id: admin.id,
        username: admin.username,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    for (let index = 0; index < drivers.length; index += 1) {
      const driver = drivers[index];
      await prisma.user.create({
        data: {
          id: driver.id,
          username: driver.username,
          passwordHash,
          role: 'DRIVER',
          status: 'ACTIVE',
          driver: {
            create: {
              id: driver.driverId,
              vehicleType: '5人座',
              licensePlate: driver.licensePlate,
              vehicleBrand: 'Toyota',
              vehicleModel: 'Camry',
              vehicleColor: '黑色',
              vehicleYear: 2024,
              onlineStatus: 'ONLINE',
            },
          },
          pushSubscription: {
            create: {
              endpoint: `https://push.example.test/wave-${index}-${suffix}`,
              p256dh: 'p256dh-test',
              auth: 'auth-test',
            },
          },
        },
      });
      // Larger index → farther from pickup
      await setDriverGps(prisma, driver.driverId, 0.001 * (index + 1));
    }

    // Isolate this suite from leftover ONLINE drivers in the shared DB.
    await prisma.driver.updateMany({
      where: {
        id: { notIn: drivers.map((driver) => driver.driverId) },
        onlineStatus: 'ONLINE',
      },
      data: { onlineStatus: 'OFFLINE' },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WebPushService)
      .useValue({ send: webPushSend })
      .overrideProvider(GeocodingService)
      .useValue(overrideGeocodingForWaveTests().useValue)
      .overrideProvider(WAVE_DISPATCH_OPTIONS)
      .useValue({ ...DEFAULT_WAVE_DISPATCH_OPTIONS, intervalMs: 250 })
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

  async function notificationsForOurDrivers(orderId: string) {
    return prisma.notification.findMany({
      where: {
        orderId,
        userId: { in: drivers.map((driver) => driver.id) },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  it('notifies at most 5 drivers in the first wave, nearest first', async () => {
    const adminCookie = await loginAs(admin.username);
    const orderId = await createAndPublish(adminCookie);

    const firstWave = await notificationsForOurDrivers(orderId);
    expect(firstWave).toHaveLength(5);
    expect(firstWave.map((item) => item.userId)).toEqual(
      drivers.slice(0, 5).map((driver) => driver.id),
    );

    // Cancel so later tests are not racing this order's next wave.
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Cookie', adminCookie)
      .expect(200);
  });

  it('notifies remaining drivers on the next wave without duplicates', async () => {
    const adminCookie = await loginAs(admin.username);
    const orderId = await createAndPublish(adminCookie);

    await new Promise((resolve) => setTimeout(resolve, 400));

    const all = await notificationsForOurDrivers(orderId);
    expect(all).toHaveLength(7);
    expect(new Set(all.map((item) => item.userId)).size).toBe(7);
    expect(all.slice(5).map((item) => item.userId)).toEqual(
      drivers.slice(5).map((driver) => driver.id),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Cookie', adminCookie)
      .expect(200);
  });

  it('stops further waves after Accept', async () => {
    const adminCookie = await loginAs(admin.username);
    const orderId = await createAndPublish(adminCookie);

    const driverCookie = await loginAs(drivers[0].username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/accept`)
      .set('Cookie', driverCookie)
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(await notificationsForOurDrivers(orderId)).toHaveLength(5);
  });

  it('stops further waves after Cancel', async () => {
    const adminCookie = await loginAs(admin.username);
    const orderId = await createAndPublish(adminCookie);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Cookie', adminCookie)
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(await notificationsForOurDrivers(orderId)).toHaveLength(5);
  });

  it('excludes a Driver who goes OFFLINE before the next wave', async () => {
    await prisma.order.updateMany({
      where: {
        driverId: { in: drivers.map((driver) => driver.driverId) },
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'OPEN'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        driverId: null,
      },
    });
    await prisma.driver.updateMany({
      where: { id: { in: drivers.map((driver) => driver.driverId) } },
      data: { onlineStatus: 'ONLINE' },
    });

    const adminCookie = await loginAs(admin.username);
    const orderId = await createAndPublish(adminCookie);

    // First wave already notified drivers[0..4]; take drivers[5] offline before wave 2.
    expect(
      (await notificationsForOurDrivers(orderId)).map((item) => item.userId),
    ).toEqual(drivers.slice(0, 5).map((driver) => driver.id));

    await prisma.driver.update({
      where: { id: drivers[5].driverId },
      data: { onlineStatus: 'OFFLINE' },
    });

    await new Promise((resolve) => setTimeout(resolve, 400));

    const notified = await notificationsForOurDrivers(orderId);
    const userIds = notified.map((item) => item.userId);
    expect(userIds).not.toContain(drivers[5].id);
    expect(userIds).toContain(drivers[6].id);

    await prisma.driver.update({
      where: { id: drivers[5].driverId },
      data: { onlineStatus: 'ONLINE' },
    });
  });

  it('allows only one winner under concurrent Accept', async () => {
    // Free the driver held by the earlier Accept test, if any.
    await prisma.order.updateMany({
      where: {
        driverId: drivers[0].driverId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
      },
      data: { status: 'CANCELLED', cancelledAt: new Date(), driverId: null },
    });

    const adminCookie = await loginAs(admin.username);
    const orderId = await createAndPublish(adminCookie);

    const cookies = await Promise.all(
      drivers.slice(0, 3).map((driver) => loginAs(driver.username)),
    );
    const responses = await Promise.all(
      cookies.map((cookie) =>
        request(app.getHttpServer())
          .post(`/api/v1/driver/orders/${orderId}/accept`)
          .set('Cookie', cookie),
      ),
    );

    const ok = responses.filter((response) => response.status === 200);
    const conflict = responses.filter((response) => response.status === 409);
    expect(ok).toHaveLength(1);
    expect(conflict).toHaveLength(2);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('ACCEPTED');
    expect(order?.driverId).not.toBeNull();
  });
});
