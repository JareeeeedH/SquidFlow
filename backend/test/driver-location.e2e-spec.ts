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
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'DriverLocationP@ss-never-log-this';

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

type LocationBody = {
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
};

function asBody<T>(response: request.Response): T {
  return response.body as T;
}

describe('Driver Location P2-01 (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `loc-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `loc-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `LCA-${suffix}`,
    },
    otherDriver: {
      id: randomUUID(),
      username: `loc-other-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `LCB-${suffix}`,
    },
    offlineDriver: {
      id: randomUUID(),
      username: `loc-offline-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `LCC-${suffix}`,
    },
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
    onlineStatus: 'ONLINE' | 'OFFLINE' = 'OFFLINE',
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

    await createDriverUser(users.driver, 'ONLINE');
    await createDriverUser(users.otherDriver, 'ONLINE');
    await createDriverUser(users.offlineDriver, 'OFFLINE');

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
    );
    await app.close();
    await prisma.$disconnect();
  });

  it('returns 401 when unauthenticated location update', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .send({ latitude: 22.6, longitude: 120.3 })
      .expect(401);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when ADMIN updates driver location', async () => {
    const cookie = await loginAs(users.admin.username);
    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send({ latitude: 22.6, longitude: 120.3 })
      .expect(403);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('FORBIDDEN');
  });

  it('lets a DRIVER update and read their own location', async () => {
    const cookie = await loginAs(users.driver.username);

    const updateResponse = await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send({ latitude: 22.6870123, longitude: 120.3090456 })
      .expect(200);

    const updated = asBody<ApiSuccessBody<LocationBody>>(updateResponse);
    expect(updated.success).toBe(true);
    expect(updated.data.latitude).toBeCloseTo(22.6870123, 6);
    expect(updated.data.longitude).toBeCloseTo(120.3090456, 6);
    expect(updated.data.location_updated_at).toEqual(expect.any(String));

    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/driver/location')
      .set('Cookie', cookie)
      .expect(200);

    expect(asBody<ApiSuccessBody<LocationBody>>(getResponse).data).toEqual(
      updated.data,
    );
  });

  it('does not change online_status when updating location while OFFLINE', async () => {
    await prisma.driver.update({
      where: { id: users.driver.driverId },
      data: { onlineStatus: 'OFFLINE' },
    });
    const cookie = await loginAs(users.driver.username);

    await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send({ latitude: 23.1, longitude: 120.2 })
      .expect(200);

    const driver = await prisma.driver.findUnique({
      where: { id: users.driver.driverId },
    });
    expect(driver?.onlineStatus).toBe('OFFLINE');
    expect(driver?.latitude?.toNumber()).toBeCloseTo(23.1, 6);
    expect(driver?.longitude?.toNumber()).toBeCloseTo(120.2, 6);
  });

  it('keeps the last location when switching to OFFLINE', async () => {
    await prisma.driver.update({
      where: { id: users.driver.driverId },
      data: {
        onlineStatus: 'ONLINE',
        latitude: 24.5,
        longitude: 121.1,
        locationUpdatedAt: new Date('2026-09-16T01:00:00.000Z'),
      },
    });
    const cookie = await loginAs(users.driver.username);

    await request(app.getHttpServer())
      .patch('/api/v1/driver/status')
      .set('Cookie', cookie)
      .send({ status: 'OFFLINE' })
      .expect(200);

    const driver = await prisma.driver.findUnique({
      where: { id: users.driver.driverId },
    });
    expect(driver?.onlineStatus).toBe('OFFLINE');
    expect(driver?.latitude?.toNumber()).toBeCloseTo(24.5, 6);
    expect(driver?.longitude?.toNumber()).toBeCloseTo(121.1, 6);
  });

  it('ignores client-supplied driver_id and only updates the current driver', async () => {
    await prisma.driver.update({
      where: { id: users.otherDriver.driverId },
      data: {
        latitude: null,
        longitude: null,
        locationUpdatedAt: null,
      },
    });
    const cookie = await loginAs(users.driver.username);

    await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send({
        latitude: 25.0,
        longitude: 121.5,
        driver_id: users.otherDriver.driverId,
        user_id: users.otherDriver.id,
      })
      .expect(200);

    const current = await prisma.driver.findUnique({
      where: { id: users.driver.driverId },
    });
    const other = await prisma.driver.findUnique({
      where: { id: users.otherDriver.driverId },
    });
    expect(current?.latitude?.toNumber()).toBeCloseTo(25.0, 6);
    expect(other?.latitude).toBeNull();
  });

  it('returns VALIDATION_ERROR for out-of-range coordinates', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send({ latitude: 99, longitude: 120 })
      .expect(400);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('VALIDATION_ERROR');
  });

  it('lets ADMIN list ONLINE driver locations and excludes OFFLINE', async () => {
    await prisma.driver.update({
      where: { id: users.driver.driverId },
      data: {
        onlineStatus: 'ONLINE',
        latitude: 22.1,
        longitude: 120.1,
        locationUpdatedAt: new Date('2026-09-16T02:00:00.000Z'),
      },
    });
    await prisma.driver.update({
      where: { id: users.otherDriver.driverId },
      data: {
        onlineStatus: 'ONLINE',
        latitude: null,
        longitude: null,
        locationUpdatedAt: null,
      },
    });
    await prisma.driver.update({
      where: { id: users.offlineDriver.driverId },
      data: {
        onlineStatus: 'OFFLINE',
        latitude: 10,
        longitude: 10,
        locationUpdatedAt: new Date('2026-09-16T02:00:00.000Z'),
      },
    });

    const cookie = await loginAs(users.admin.username);
    const response = await request(app.getHttpServer())
      .get('/api/v1/drivers/online-locations')
      .set('Cookie', cookie)
      .expect(200);

    const body = asBody<
      ApiSuccessBody<
        Array<{
          id: string;
          username: string;
          license_plate: string;
          online_status: string;
          latitude: number | null;
          longitude: number | null;
          location_updated_at: string | null;
        }>
      >
    >(response);

    const ids = body.data.map((item) => item.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        users.driver.driverId,
        users.otherDriver.driverId,
      ]),
    );
    expect(ids).not.toContain(users.offlineDriver.driverId);
    expect(body.data.every((item) => item.online_status === 'ONLINE')).toBe(
      true,
    );

    const withLocation = body.data.find(
      (item) => item.id === users.driver.driverId,
    );
    expect(withLocation?.latitude).toBeCloseTo(22.1, 6);
    const withoutLocation = body.data.find(
      (item) => item.id === users.otherDriver.driverId,
    );
    expect(withoutLocation?.latitude).toBeNull();
  });

  it('returns 403 when DRIVER lists online locations', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .get('/api/v1/drivers/online-locations')
      .set('Cookie', cookie)
      .expect(403);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('FORBIDDEN');
  });
});
