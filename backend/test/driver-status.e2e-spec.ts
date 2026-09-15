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
const password = 'DriverOnlineP@ss-never-log-this';

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

describe('Driver Online / Offline (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d5-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `d5-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D5A-${suffix}`,
    },
    otherDriver: {
      id: randomUUID(),
      username: `d5-other-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D5B-${suffix}`,
    },
    suspended: {
      id: randomUUID(),
      username: `d5-suspended-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D5C-${suffix}`,
    },
  };
  const orderId = randomUUID();

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
            onlineStatus: 'OFFLINE',
          },
        },
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
    await createDriverUser(users.otherDriver);
    await createDriverUser(users.suspended);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    const testUsers = await prisma.user.findMany({
      where: {
        username: {
          contains: suffix,
        },
      },
      select: { id: true },
    });
    await cleanupTestUsers(
      prisma,
      testUsers.map((user) => user.id),
      [orderId],
    );
    await app.close();
    await prisma.$disconnect();
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .send({ status: 'ONLINE' })
      .expect(401);

    expect(asBody<ApiErrorBody>(response)).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('returns 403 when an ADMIN calls the driver status API', async () => {
    const cookie = await loginAs(users.admin.username);
    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'ONLINE' })
      .expect(403);

    expect(asBody<ApiErrorBody>(response)).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '沒有權限',
      },
    });
  });

  it('lets a DRIVER switch OFFLINE to ONLINE', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'ONLINE' })
      .expect(200);

    expect(asBody<ApiSuccessBody<{ status: string }>>(response)).toEqual({
      success: true,
      data: {
        status: 'ONLINE',
      },
    });

    const driver = await prisma.driver.findUnique({
      where: { id: users.driver.driverId },
    });
    expect(driver?.onlineStatus).toBe('ONLINE');
  });

  it('lets a DRIVER switch ONLINE to OFFLINE', async () => {
    await prisma.driver.update({
      where: { id: users.driver.driverId },
      data: { onlineStatus: 'ONLINE' },
    });
    const cookie = await loginAs(users.driver.username);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'OFFLINE' })
      .expect(200);

    expect(
      asBody<ApiSuccessBody<{ status: string }>>(response).data.status,
    ).toBe('OFFLINE');
    const driver = await prisma.driver.findUnique({
      where: { id: users.driver.driverId },
    });
    expect(driver?.onlineStatus).toBe('OFFLINE');
  });

  it('treats ONLINE to ONLINE as success', async () => {
    await prisma.driver.update({
      where: { id: users.driver.driverId },
      data: { onlineStatus: 'ONLINE' },
    });
    const cookie = await loginAs(users.driver.username);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'ONLINE' })
      .expect(200);

    expect(asBody<ApiSuccessBody<{ status: string }>>(response)).toEqual({
      success: true,
      data: {
        status: 'ONLINE',
      },
    });
  });

  it('treats OFFLINE to OFFLINE as success', async () => {
    await prisma.driver.update({
      where: { id: users.driver.driverId },
      data: { onlineStatus: 'OFFLINE' },
    });
    const cookie = await loginAs(users.driver.username);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'OFFLINE' })
      .expect(200);

    expect(asBody<ApiSuccessBody<{ status: string }>>(response)).toEqual({
      success: true,
      data: {
        status: 'OFFLINE',
      },
    });
  });

  it('returns VALIDATION_ERROR for account status values', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' })
      .expect(400);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('VALIDATION_ERROR');
  });

  it('ignores client-supplied driver_id and user_id and only updates the current driver', async () => {
    await prisma.driver.update({
      where: { id: users.driver.driverId },
      data: { onlineStatus: 'OFFLINE' },
    });
    await prisma.driver.update({
      where: { id: users.otherDriver.driverId },
      data: { onlineStatus: 'OFFLINE' },
    });
    const cookie = await loginAs(users.driver.username);

    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({
        status: 'ONLINE',
        driver_id: users.otherDriver.driverId,
        user_id: users.otherDriver.id,
      })
      .expect(200);

    expect(
      asBody<ApiSuccessBody<{ status: string }>>(response).data.status,
    ).toBe('ONLINE');

    const current = await prisma.driver.findUnique({
      where: { id: users.driver.driverId },
    });
    const other = await prisma.driver.findUnique({
      where: { id: users.otherDriver.driverId },
    });
    expect(current?.onlineStatus).toBe('ONLINE');
    expect(other?.onlineStatus).toBe('OFFLINE');
  });

  it('does not let a SUSPENDED driver change online status', async () => {
    await prisma.driver.update({
      where: { id: users.suspended.driverId },
      data: { onlineStatus: 'OFFLINE' },
    });
    const cookie = await loginAs(users.suspended.username);
    await prisma.user.update({
      where: { id: users.suspended.id },
      data: { status: 'SUSPENDED' },
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'ONLINE' })
      .expect(403);

    expect(asBody<ApiErrorBody>(response)).toEqual({
      success: false,
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message: '帳號已停用',
      },
    });

    const driver = await prisma.driver.findUnique({
      where: { id: users.suspended.driverId },
    });
    expect(driver?.onlineStatus).toBe('OFFLINE');
  });

  it('does not change any Order fields when updating online status', async () => {
    const acceptedAt = new Date('2026-09-15T07:05:00Z');
    await prisma.order.create({
      data: {
        id: orderId,
        orderNo: `ORD-D5-${suffix}`,
        customerName: '王先生',
        pickupLocation: '左營高鐵站',
        destination: '高雄小港機場',
        price: new Prisma.Decimal('1200.00'),
        status: 'ACCEPTED',
        dispatchMode: 'OPEN',
        driverId: users.driver.driverId,
        createdBy: users.admin.id,
        acceptedAt,
      },
    });
    const before = await prisma.order.findUnique({ where: { id: orderId } });
    const cookie = await loginAs(users.driver.username);

    await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'OFFLINE' })
      .expect(200);

    const after = await prisma.order.findUnique({ where: { id: orderId } });
    expect(after).toEqual(before);
    expect(after?.status).toBe('ACCEPTED');
    expect(after?.driverId).toBe(users.driver.driverId);
    expect(after?.acceptedAt?.toISOString()).toBe(acceptedAt.toISOString());
    expect(after?.startedAt).toBeNull();
    expect(after?.completedAt).toBeNull();
    expect(after?.cancelledAt).toBeNull();
  });
});
