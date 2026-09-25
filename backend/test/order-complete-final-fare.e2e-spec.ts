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
const password = 'P3CompleteFinalFareP@ss-never-log';

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

type CompleteData = {
  id: string;
  status: string;
  arrived_at: string;
  trip_distance_meters: number;
  calculated_fare: number | null;
  final_fare: number;
  completed_at: string;
};

type DriverOrderDetail = {
  id: string;
  status: string;
  trip_distance_meters: number | null;
  arrived_at: string | null;
  calculated_fare: number | null;
  final_fare: number | null;
  price: number | null;
};

function asBody<T>(response: request.Response): T {
  return response.body as T;
}

describe('Driver order complete final fare P3 (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: { id: randomUUID(), username: `cf-admin-${suffix}` },
    owner: {
      id: randomUUID(),
      username: `cf-owner-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `CF-${suffix}`,
    },
    other: {
      id: randomUUID(),
      username: `cf-other-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `CO-${suffix}`,
    },
    race: {
      id: randomUUID(),
      username: `cf-race-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `CR-${suffix}`,
    },
  };

  async function loginAs(username: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password });
    const cookie = sessionCookie(response);
    expect(cookie).toBeDefined();
    return cookie!;
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
            licensePlate: user.licensePlate,
            vehicleBrand: 'Toyota',
            vehicleModel: 'Camry',
            vehicleColor: '黑色',
            onlineStatus: 'ONLINE',
          },
        },
      },
    });
  }

  async function deleteDriverOrders(driverId: string) {
    const orders = await prisma.order.findMany({
      where: { driverId },
      select: { id: true },
    });
    const ids = orders.map((o) => o.id);
    if (ids.length === 0) {
      return;
    }
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }

  async function seedArrivedOrder(input: {
    id: string;
    label: string;
    driverId: string;
    tripDistanceMeters?: number;
    calculatedFare?: number;
    price?: string;
    arrived?: boolean;
    status?: 'IN_PROGRESS' | 'COMPLETED' | 'ACCEPTED';
  }) {
    const status = input.status ?? 'IN_PROGRESS';
    const arrived = input.arrived ?? status !== 'ACCEPTED';
    await prisma.order.create({
      data: {
        id: input.id,
        orderNo: `ORD-CF-${input.label}-${suffix}`,
        customerName: 'Customer',
        pickupLocation: 'Pickup',
        destination: 'Destination',
        price: new Prisma.Decimal(input.price ?? '1200.00'),
        status,
        dispatchMode: 'OPEN',
        driverId: input.driverId,
        createdBy: users.admin.id,
        acceptedAt: new Date('2026-09-15T07:00:00Z'),
        startedAt:
          status === 'ACCEPTED' ? null : new Date('2026-09-15T07:10:00Z'),
        arrivedAt: arrived ? new Date('2026-09-15T08:00:00Z') : null,
        calculatedFare: arrived
          ? new Prisma.Decimal(input.calculatedFare ?? 275)
          : null,
        tripDistanceMeters: arrived ? (input.tripDistanceMeters ?? 8400) : null,
        finalFare: status === 'COMPLETED' ? new Prisma.Decimal(500) : null,
        completedAt:
          status === 'COMPLETED' ? new Date('2026-09-15T08:20:00Z') : null,
      },
    });
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
    await createDriverUser(users.owner);
    await createDriverUser(users.other);
    await createDriverUser(users.race);

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

  it('completes after arrive and preserves locked mileage / calculated_fare', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedArrivedOrder({
      id: orderId,
      label: 'ok',
      driverId: users.owner.driverId,
      tripDistanceMeters: 8400,
      calculatedFare: 275,
      price: '1200.00',
    });

    const cookie = await loginAs(users.owner.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 500 })
      .expect(200);

    const body = asBody<ApiSuccessBody<CompleteData>>(response);
    expect(body.data).toMatchObject({
      id: orderId,
      status: 'COMPLETED',
      trip_distance_meters: 8400,
      calculated_fare: 275,
      final_fare: 500,
    });
    expect(body.data.arrived_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.data.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.status).toBe('COMPLETED');
    expect(stored.finalFare?.toNumber()).toBe(500);
    expect(stored.calculatedFare?.toNumber()).toBe(275);
    expect(stored.tripDistanceMeters).toBe(8400);
    expect(stored.price?.toNumber()).toBe(1200);
    expect(stored.arrivedAt).not.toBeNull();
    expect(stored.completedAt).not.toBeNull();

    expect(
      await prisma.orderEvent.count({
        where: { orderId, eventType: 'ORDER_COMPLETED' },
      }),
    ).toBe(1);
  });

  it('GET driver order returns final_fare after complete', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedArrivedOrder({
      id: orderId,
      label: 'get',
      driverId: users.owner.driverId,
      tripDistanceMeters: 8400,
      calculatedFare: 275,
    });

    const cookie = await loginAs(users.owner.username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 500 })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/driver/orders/${orderId}`)
      .set('Cookie', cookie)
      .expect(200);

    const data = asBody<ApiSuccessBody<DriverOrderDetail>>(detail).data;
    expect(data.status).toBe('COMPLETED');
    expect(data.trip_distance_meters).toBe(8400);
    expect(data.calculated_fare).toBe(275);
    expect(data.final_fare).toBe(500);
    expect(data.arrived_at).not.toBeNull();
    expect(data.price).toBe(1200);
  });

  it('rejects complete before arrive', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedArrivedOrder({
      id: orderId,
      label: 'noarr',
      driverId: users.owner.driverId,
      arrived: false,
      status: 'IN_PROGRESS',
    });
    // Override: IN_PROGRESS without arrive fields
    await prisma.order.update({
      where: { id: orderId },
      data: {
        arrivedAt: null,
        calculatedFare: null,
        tripDistanceMeters: 100,
      },
    });

    const cookie = await loginAs(users.owner.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 500 })
      .expect(409);

    expect(asBody<ApiErrorBody>(response).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );
  });

  it('rejects complete from another driver', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedArrivedOrder({
      id: orderId,
      label: 'oth',
      driverId: users.owner.driverId,
    });

    const cookie = await loginAs(users.other.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 500 })
      .expect(404);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('NOT_FOUND');
  });

  it('rejects negative / NaN / Infinity / non-number final_fare', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedArrivedOrder({
      id: orderId,
      label: 'val',
      driverId: users.owner.driverId,
    });
    const cookie = await loginAs(users.owner.username);

    for (const payload of [
      { final_fare: -1 },
      { final_fare: Number.NaN },
      { final_fare: Number.POSITIVE_INFINITY },
      { final_fare: '500' },
      { final_fare: 12.5 },
      {},
    ]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/complete`)
        .set('Cookie', cookie)
        .send(payload)
        .expect(400);
      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'VALIDATION_ERROR',
      );
    }
  });

  it('rejects repeat complete', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedArrivedOrder({
      id: orderId,
      label: 'dup',
      driverId: users.owner.driverId,
    });
    const cookie = await loginAs(users.owner.username);

    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 500 })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 600 })
      .expect(409);

    expect(asBody<ApiErrorBody>(second).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.finalFare?.toNumber()).toBe(500);
  });

  it('concurrency: only one complete succeeds with one final_fare', async () => {
    await deleteDriverOrders(users.race.driverId);
    const orderId = randomUUID();
    await seedArrivedOrder({
      id: orderId,
      label: 'race',
      driverId: users.race.driverId,
      calculatedFare: 275,
    });
    const cookie = await loginAs(users.race.username);

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/complete`)
        .set('Cookie', cookie)
        .send({ final_fare: 500 }),
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/complete`)
        .set('Cookie', cookie)
        .send({ final_fare: 600 }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = a.status === 200 ? a : b;
    const winnerBody = asBody<ApiSuccessBody<CompleteData>>(winner);
    expect(winnerBody.data.status).toBe('COMPLETED');
    expect([500, 600]).toContain(winnerBody.data.final_fare);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.status).toBe('COMPLETED');
    expect(stored.finalFare?.toNumber()).toBe(winnerBody.data.final_fare);
    expect(stored.calculatedFare?.toNumber()).toBe(275);

    expect(
      await prisma.orderEvent.count({
        where: { orderId, eventType: 'ORDER_COMPLETED' },
      }),
    ).toBe(1);
  });
});
