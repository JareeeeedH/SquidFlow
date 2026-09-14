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

config();

const prisma = new PrismaClient();
const password = 'DriverMgmtP@ss-never-log-this';
const updatedPassword = 'DriverMgmtP@ss-updated-never-log';

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

type DriverBody = {
  id: string;
  username: string;
  vehicle_type: string;
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_year: number;
  online_status: string;
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

describe('Admin Driver Management (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d4-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `d4-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D4A-${suffix}`,
    },
    updateTarget: {
      id: randomUUID(),
      username: `d4-update-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D4B-${suffix}`,
    },
    statusTarget: {
      id: randomUUID(),
      username: `d4-status-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D4C-${suffix}`,
    },
  };

  function vehicleFields(licensePlate: string) {
    return {
      vehicle_type: '5人座',
      license_plate: licensePlate,
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
      vehicle_year: 2024,
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

    await prisma.user.create({
      data: {
        id: users.driver.id,
        username: users.driver.username,
        passwordHash,
        role: 'DRIVER',
        status: 'ACTIVE',
        driver: {
          create: {
            id: users.driver.driverId,
            vehicleType: '5人座',
            licensePlate: users.driver.licensePlate,
            vehicleBrand: 'Toyota',
            vehicleModel: 'Camry',
            vehicleColor: '黑色',
            vehicleYear: 2024,
            onlineStatus: 'OFFLINE',
          },
        },
      },
    });

    await prisma.user.create({
      data: {
        id: users.updateTarget.id,
        username: users.updateTarget.username,
        passwordHash,
        role: 'DRIVER',
        status: 'ACTIVE',
        driver: {
          create: {
            id: users.updateTarget.driverId,
            vehicleType: '5人座',
            licensePlate: users.updateTarget.licensePlate,
            vehicleBrand: 'Toyota',
            vehicleModel: 'Camry',
            vehicleColor: '黑色',
            vehicleYear: 2024,
            onlineStatus: 'OFFLINE',
          },
        },
      },
    });

    await prisma.user.create({
      data: {
        id: users.statusTarget.id,
        username: users.statusTarget.username,
        passwordHash,
        role: 'DRIVER',
        status: 'ACTIVE',
        driver: {
          create: {
            id: users.statusTarget.driverId,
            vehicleType: '5人座',
            licensePlate: users.statusTarget.licensePlate,
            vehicleBrand: 'Toyota',
            vehicleModel: 'Camry',
            vehicleColor: '黑色',
            vehicleYear: 2024,
            onlineStatus: 'OFFLINE',
          },
        },
      },
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
      where: {
        username: {
          contains: suffix,
        },
      },
      select: { id: true },
    });
    const userIds = testUsers.map((user) => user.id);

    await prisma.session.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.driver.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/drivers')
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('returns 403 when a DRIVER calls admin driver APIs', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .get('/api/v1/drivers')
      .set('Cookie', cookie)
      .expect(403);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '沒有權限',
      },
    });
  });

  it('allows ADMIN to call driver APIs', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .get('/api/v1/drivers')
      .set('Cookie', cookie)
      .expect(200);

    const body = asBody<ApiSuccessBody<DriverBody[]>>(response);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('creates a driver with DRIVER role, ACTIVE status, OFFLINE, and hashed password', async () => {
    const cookie = await adminCookie();
    const username = `d4-create-${suffix}`;
    const licensePlate = `D4N-${suffix}`;
    const payload = {
      username,
      password,
      ...vehicleFields(licensePlate),
      role: 'ADMIN',
      status: 'SUSPENDED',
      online_status: 'ONLINE',
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/drivers')
      .set('Cookie', cookie)
      .send(payload)
      .expect(200);

    const body = asBody<ApiSuccessBody<DriverBody>>(response);
    expect(body).toMatchObject({
      success: true,
      data: {
        username,
        ...vehicleFields(licensePlate),
        online_status: 'OFFLINE',
        status: 'ACTIVE',
      },
    });
    expect(typeof body.data.id).toBe('string');
    assertNoSecrets(body);

    const created = await prisma.driver.findUnique({
      where: { id: body.data.id },
      include: { user: true },
    });
    expect(created).not.toBeNull();
    expect(created?.user.role).toBe('DRIVER');
    expect(created?.user.status).toBe('ACTIVE');
    expect(created?.onlineStatus).toBe('OFFLINE');
    expect(created?.user.passwordHash).not.toBe(password);
    expect(created?.user.passwordHash.startsWith('$2')).toBe(true);
    await expect(
      bcrypt.compare(password, created?.user.passwordHash as string),
    ).resolves.toBe(true);
  });

  it('returns USERNAME_ALREADY_EXISTS for a duplicate username', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .post('/api/v1/drivers')
      .set('Cookie', cookie)
      .send({
        username: users.driver.username,
        password,
        ...vehicleFields(`D4U-${suffix}`),
      })
      .expect(409);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'USERNAME_ALREADY_EXISTS',
        message: '帳號已存在',
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|p2002|sql/i);
  });

  it('returns LICENSE_PLATE_ALREADY_EXISTS for a duplicate license plate', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .post('/api/v1/drivers')
      .set('Cookie', cookie)
      .send({
        username: `d4-dup-plate-${suffix}`,
        password,
        ...vehicleFields(users.driver.licensePlate),
      })
      .expect(409);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'LICENSE_PLATE_ALREADY_EXISTS',
        message: '車牌已存在',
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|p2002|sql/i);
  });

  it('lists drivers without leaking sensitive data', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .get('/api/v1/drivers')
      .set('Cookie', cookie)
      .expect(200);

    const body = asBody<ApiSuccessBody<DriverBody[]>>(response);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: users.driver.driverId,
          username: users.driver.username,
          license_plate: users.driver.licensePlate,
          online_status: 'OFFLINE',
          status: 'ACTIVE',
        }),
      ]),
    );
    assertNoSecrets(body);
    for (const item of body.data) {
      expect(item).not.toHaveProperty('password');
      expect(item).not.toHaveProperty('password_hash');
      expect(item).not.toHaveProperty('passwordHash');
      expect(item).not.toHaveProperty('sessions');
      expect(item).not.toHaveProperty('pushSubscriptions');
    }
  });

  it('returns a driver by id', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .get(`/api/v1/drivers/${users.driver.driverId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: users.driver.driverId,
        username: users.driver.username,
        ...vehicleFields(users.driver.licensePlate),
        online_status: 'OFFLINE',
        status: 'ACTIVE',
      },
    });
    assertNoSecrets(response.body);
  });

  it('returns 404 for a missing driver', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .get(`/api/v1/drivers/${randomUUID()}`)
      .set('Cookie', cookie)
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '找不到司機',
      },
    });
  });

  it('updates vehicle fields without changing the password when password is omitted', async () => {
    const cookie = await adminCookie();
    const before = await prisma.user.findUnique({
      where: { id: users.updateTarget.id },
    });

    const response = await request(app.getHttpServer())
      .put(`/api/v1/drivers/${users.updateTarget.driverId}`)
      .set('Cookie', cookie)
      .send({
        username: users.updateTarget.username,
        ...vehicleFields(users.updateTarget.licensePlate),
        vehicle_type: '7人座',
        vehicle_brand: 'Honda',
        vehicle_model: 'CR-V',
        vehicle_color: '白色',
        vehicle_year: 2025,
      })
      .expect(200);

    expect(asBody<ApiSuccessBody<DriverBody>>(response).data).toMatchObject({
      id: users.updateTarget.driverId,
      username: users.updateTarget.username,
      vehicle_type: '7人座',
      vehicle_brand: 'Honda',
      vehicle_model: 'CR-V',
      vehicle_color: '白色',
      vehicle_year: 2025,
    });

    const after = await prisma.user.findUnique({
      where: { id: users.updateTarget.id },
    });
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });

  it('updates the password hash when password is provided and the new password can log in', async () => {
    const cookie = await adminCookie();
    const before = await prisma.user.findUnique({
      where: { id: users.updateTarget.id },
    });

    const response = await request(app.getHttpServer())
      .put(`/api/v1/drivers/${users.updateTarget.driverId}`)
      .set('Cookie', cookie)
      .send({
        username: users.updateTarget.username,
        password: updatedPassword,
        vehicle_type: '7人座',
        license_plate: users.updateTarget.licensePlate,
        vehicle_brand: 'Honda',
        vehicle_model: 'CR-V',
        vehicle_color: '白色',
        vehicle_year: 2025,
      })
      .expect(200);

    assertNoSecrets(response.body);

    const after = await prisma.user.findUnique({
      where: { id: users.updateTarget.id },
    });
    expect(after?.passwordHash).not.toBe(before?.passwordHash);
    await expect(
      bcrypt.compare(updatedPassword, after?.passwordHash as string),
    ).resolves.toBe(true);
    await expect(
      bcrypt.compare(password, after?.passwordHash as string),
    ).resolves.toBe(false);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.updateTarget.username,
        password: updatedPassword,
      })
      .expect(200);
  });

  it('rejects an empty password on update instead of clearing the hash', async () => {
    const cookie = await adminCookie();
    const before = await prisma.user.findUnique({
      where: { id: users.updateTarget.id },
    });

    const response = await request(app.getHttpServer())
      .put(`/api/v1/drivers/${users.updateTarget.driverId}`)
      .set('Cookie', cookie)
      .send({
        username: users.updateTarget.username,
        password: '',
        vehicle_type: '7人座',
        license_plate: users.updateTarget.licensePlate,
        vehicle_brand: 'Honda',
        vehicle_model: 'CR-V',
        vehicle_color: '白色',
        vehicle_year: 2025,
      })
      .expect(400);

    expect(asBody<ApiErrorBody>(response)).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });

    const after = await prisma.user.findUnique({
      where: { id: users.updateTarget.id },
    });
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });

  it('does not change role, account status, or online status via PUT', async () => {
    const cookie = await adminCookie();
    await request(app.getHttpServer())
      .put(`/api/v1/drivers/${users.updateTarget.driverId}`)
      .set('Cookie', cookie)
      .send({
        username: users.updateTarget.username,
        vehicle_type: '7人座',
        license_plate: users.updateTarget.licensePlate,
        vehicle_brand: 'Honda',
        vehicle_model: 'CR-V',
        vehicle_color: '白色',
        vehicle_year: 2025,
        role: 'ADMIN',
        status: 'SUSPENDED',
        online_status: 'ONLINE',
        id: randomUUID(),
        user_id: users.admin.id,
      })
      .expect(200);

    const driver = await prisma.driver.findUnique({
      where: { id: users.updateTarget.driverId },
      include: { user: true },
    });
    expect(driver?.user.role).toBe('DRIVER');
    expect(driver?.user.status).toBe('ACTIVE');
    expect(driver?.onlineStatus).toBe('OFFLINE');
    expect(driver?.userId).toBe(users.updateTarget.id);
    expect(driver?.id).toBe(users.updateTarget.driverId);
  });

  it('returns USERNAME_ALREADY_EXISTS when updating to a taken username', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .put(`/api/v1/drivers/${users.updateTarget.driverId}`)
      .set('Cookie', cookie)
      .send({
        username: users.driver.username,
        vehicle_type: '7人座',
        license_plate: users.updateTarget.licensePlate,
        vehicle_brand: 'Honda',
        vehicle_model: 'CR-V',
        vehicle_color: '白色',
        vehicle_year: 2025,
      })
      .expect(409);

    expect(asBody<ApiErrorBody>(response).error.code).toBe(
      'USERNAME_ALREADY_EXISTS',
    );
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|p2002|sql/i);
  });

  it('returns LICENSE_PLATE_ALREADY_EXISTS when updating to a taken license plate', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .put(`/api/v1/drivers/${users.updateTarget.driverId}`)
      .set('Cookie', cookie)
      .send({
        username: users.updateTarget.username,
        vehicle_type: '7人座',
        license_plate: users.driver.licensePlate,
        vehicle_brand: 'Honda',
        vehicle_model: 'CR-V',
        vehicle_color: '白色',
        vehicle_year: 2025,
      })
      .expect(409);

    expect(asBody<ApiErrorBody>(response).error.code).toBe(
      'LICENSE_PLATE_ALREADY_EXISTS',
    );
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|p2002|sql/i);
  });

  it('changes account status from ACTIVE to SUSPENDED and back without touching online status', async () => {
    const cookie = await adminCookie();

    const suspended = await request(app.getHttpServer())
      .patch(`/api/v1/drivers/${users.statusTarget.driverId}/status`)
      .set('Cookie', cookie)
      .send({ status: 'SUSPENDED' })
      .expect(200);

    expect(suspended.body).toEqual({
      success: true,
      data: {
        id: users.statusTarget.driverId,
        status: 'SUSPENDED',
      },
    });

    const afterSuspend = await prisma.driver.findUnique({
      where: { id: users.statusTarget.driverId },
      include: { user: true },
    });
    expect(afterSuspend?.user.status).toBe('SUSPENDED');
    expect(afterSuspend?.onlineStatus).toBe('OFFLINE');

    const activated = await request(app.getHttpServer())
      .patch(`/api/v1/drivers/${users.statusTarget.driverId}/status`)
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' })
      .expect(200);

    expect(
      asBody<ApiSuccessBody<{ status: string }>>(activated).data.status,
    ).toBe('ACTIVE');
    const afterActivate = await prisma.user.findUnique({
      where: { id: users.statusTarget.id },
    });
    expect(afterActivate?.status).toBe('ACTIVE');
  });

  it('treats setting the same account status as success without changing online status', async () => {
    const cookie = await adminCookie();
    await prisma.driver.update({
      where: { id: users.statusTarget.driverId },
      data: { onlineStatus: 'ONLINE' },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/drivers/${users.statusTarget.driverId}/status`)
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: users.statusTarget.driverId,
        status: 'ACTIVE',
      },
    });

    const driver = await prisma.driver.findUnique({
      where: { id: users.statusTarget.driverId },
      include: { user: true },
    });
    expect(driver?.user.status).toBe('ACTIVE');
    expect(driver?.onlineStatus).toBe('ONLINE');
  });
});
