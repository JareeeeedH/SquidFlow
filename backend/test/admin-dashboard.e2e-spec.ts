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
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'DashboardP@ss-never-log-this';

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

type DashboardBoardOrder = {
  id: string;
  order_no: string;
  customer_name: string;
  pickup_location: string;
  destination: string;
  scheduled_at: string;
  price: number;
  status: OrderStatus;
  driver: { username: string } | null;
};

type AdminDashboard = {
  summary: {
    DRAFT: number;
    OPEN: number;
    ACCEPTED: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  board_orders: DashboardBoardOrder[];
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

describe('Admin Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d16a-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `d16a-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D16A-${suffix.slice(0, 4)}`,
    },
    driverB: {
      id: randomUUID(),
      username: `d16a-driverb-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D16B-${suffix.slice(0, 4)}`,
    },
  };

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

  async function seedOrder(input: {
    serial: string;
    status: OrderStatus;
    scheduledAt: string;
    driverId?: string;
    customerName?: string;
  }) {
    return prisma.order.create({
      data: {
        orderNo: `ORD-D16A-${suffix}-${input.serial}`,
        customerName: input.customerName ?? '王先生',
        pickupLocation: '左營高鐵站',
        destination: '高雄小港機場',
        scheduledAt: new Date(input.scheduledAt),
        vehicleType: '5人座',
        price: new Prisma.Decimal('1200.00'),
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
    await createDriverUser(users.driver);
    await createDriverUser(users.driverB);

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
      .get('/api/v1/admin/dashboard')
      .expect(401);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when a DRIVER calls the dashboard', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Cookie', cookie)
      .expect(403);

    expect(asBody<ApiErrorBody>(response)).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('returns summary counts and board_orders for Admin', async () => {
    const cookie = await loginAs(users.admin.username);
    const beforeResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Cookie', cookie)
      .expect(200);
    const before = asBody<ApiSuccessBody<AdminDashboard>>(beforeResponse).data;

    const open = await seedOrder({
      serial: 'OPEN',
      status: OrderStatus.OPEN,
      scheduledAt: '2026-09-15T06:00:00.000Z',
    });
    const accepted = await seedOrder({
      serial: 'ACCEPTED',
      status: OrderStatus.ACCEPTED,
      scheduledAt: '2026-09-15T08:00:00.000Z',
      driverId: users.driver.driverId,
    });
    const draftLate = await seedOrder({
      serial: 'DRAFT-LATE',
      status: OrderStatus.DRAFT,
      scheduledAt: '2026-09-15T10:00:00.000Z',
    });
    const draftEarly = await seedOrder({
      serial: 'DRAFT-EARLY',
      status: OrderStatus.DRAFT,
      scheduledAt: '2026-09-15T07:00:00.000Z',
    });
    const inProgress = await seedOrder({
      serial: 'IN-PROGRESS',
      status: OrderStatus.IN_PROGRESS,
      scheduledAt: '2026-09-15T09:00:00.000Z',
      driverId: users.driverB.driverId,
    });
    const completed = await seedOrder({
      serial: 'COMPLETED',
      status: OrderStatus.COMPLETED,
      scheduledAt: '2026-09-15T05:00:00.000Z',
    });
    const cancelled = await seedOrder({
      serial: 'CANCELLED',
      status: OrderStatus.CANCELLED,
      scheduledAt: '2026-09-15T04:00:00.000Z',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Cookie', cookie)
      .expect(200);

    const body = asBody<ApiSuccessBody<AdminDashboard>>(response);
    expect(body.success).toBe(true);
    expect(body.data.summary).toEqual({
      DRAFT: before.summary.DRAFT + 2,
      OPEN: before.summary.OPEN + 1,
      ACCEPTED: before.summary.ACCEPTED + 1,
      IN_PROGRESS: before.summary.IN_PROGRESS + 1,
      COMPLETED: before.summary.COMPLETED + 1,
      CANCELLED: before.summary.CANCELLED + 1,
    });
    expect(body.data).not.toHaveProperty('active_orders');
    assertNoSecrets(body);

    const ours = body.data.board_orders.filter((order) =>
      order.order_no.startsWith(`ORD-D16A-${suffix}-`),
    );
    expect(ours.map((order) => order.order_no)).toEqual([
      open.orderNo,
      draftEarly.orderNo,
      accepted.orderNo,
      inProgress.orderNo,
      draftLate.orderNo,
    ]);
    expect(ours.map((order) => order.status)).not.toContain(
      OrderStatus.COMPLETED,
    );
    expect(ours.map((order) => order.status)).not.toContain(
      OrderStatus.CANCELLED,
    );
    expect(
      body.data.board_orders.some((order) => order.id === completed.id),
    ).toBe(false);
    expect(
      body.data.board_orders.some((order) => order.id === cancelled.id),
    ).toBe(false);

    const unassigned = ours.find((order) => order.id === open.id);
    expect(unassigned).toMatchObject({
      id: open.id,
      order_no: open.orderNo,
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      scheduled_at: '2026-09-15T06:00:00.000Z',
      price: 1200,
      status: 'OPEN',
      driver: null,
    });

    const assigned = ours.find((order) => order.id === accepted.id);
    expect(assigned?.driver).toEqual({ username: users.driver.username });
    expect(Object.keys(assigned?.driver ?? {})).toEqual(['username']);
  });
});
