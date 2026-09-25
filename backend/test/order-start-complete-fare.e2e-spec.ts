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
import { calculateTripFare } from '../src/fare/trip-fare';
import { segmentDistanceMeters } from '../src/fare/segment-distance';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'P3EStartCompleteP@ss-never-log';

const pointA = { latitude: 22.6273, longitude: 120.3014 };
const pointB = { latitude: 22.63, longitude: 120.305 };

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
  completed_at: string;
  arrived_at: string;
  trip_distance_meters: number;
  calculated_fare: number | null;
  final_fare: number;
};

function asBody<T>(response: request.Response): T {
  return response.body as T;
}

describe('Start / Complete Phase 3 fare integration P3-E (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: { id: randomUUID(), username: `p3e-admin-${suffix}` },
    starter: {
      id: randomUUID(),
      username: `p3e-start-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `ES-${suffix}`,
    },
    other: {
      id: randomUUID(),
      username: `p3e-other-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `EO-${suffix}`,
    },
    fare: {
      id: randomUUID(),
      username: `p3e-fare-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `EF-${suffix}`,
    },
    raceLoc: {
      id: randomUUID(),
      username: `p3e-rloc-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `EL-${suffix}`,
    },
    raceComp: {
      id: randomUUID(),
      username: `p3e-rcmp-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `EC-${suffix}`,
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
            vehicleType: 'sedan',
            licensePlate: user.licensePlate,
            vehicleBrand: 'Toyota',
            vehicleModel: 'Camry',
            vehicleColor: 'black',
            vehicleYear: 2024,
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
    const ids = orders.map((order) => order.id);
    if (ids.length === 0) {
      return;
    }
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }

  async function seedOrder(input: {
    id: string;
    label: string;
    status: 'OPEN' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED';
    driverId?: string | null;
    price?: string;
    tripDistanceMeters?: number | null;
    tripLastLatitude?: number | null;
    tripLastLongitude?: number | null;
  }) {
    await prisma.order.create({
      data: {
        id: input.id,
        orderNo: `ORD-P3E-${input.label}-${suffix}`,
        customerName: 'Customer',
        pickupLocation: 'Pickup',
        destination: 'Destination',
        price: new Prisma.Decimal(input.price ?? '9999.00'),
        note: null,
        status: input.status,
        dispatchMode: 'OPEN',
        driverId: input.driverId ?? null,
        createdBy: users.admin.id,
        acceptedAt:
          input.status === 'ACCEPTED' ||
          input.status === 'IN_PROGRESS' ||
          input.status === 'COMPLETED'
            ? new Date('2026-09-15T07:00:00Z')
            : null,
        startedAt:
          input.status === 'IN_PROGRESS' || input.status === 'COMPLETED'
            ? new Date('2026-09-15T07:10:00Z')
            : null,
        completedAt:
          input.status === 'COMPLETED'
            ? new Date('2026-09-15T08:00:00Z')
            : null,
        tripDistanceMeters: input.tripDistanceMeters ?? null,
        tripLastLatitude:
          input.tripLastLatitude == null
            ? null
            : new Prisma.Decimal(input.tripLastLatitude),
        tripLastLongitude:
          input.tripLastLongitude == null
            ? null
            : new Prisma.Decimal(input.tripLastLongitude),
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
    await createDriverUser(users.starter);
    await createDriverUser(users.other);
    await createDriverUser(users.fare);
    await createDriverUser(users.raceLoc);
    await createDriverUser(users.raceComp);

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

  it('Start initializes tracking state from ACCEPTED', async () => {
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'init',
      status: 'ACCEPTED',
      driverId: users.starter.driverId,
      tripDistanceMeters: 777,
      tripLastLatitude: 25.0,
      tripLastLongitude: 121.5,
    });

    const cookie = await loginAs(users.starter.username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/start`)
      .set('Cookie', cookie)
      .expect(200);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.status).toBe('IN_PROGRESS');
    expect(stored.tripDistanceMeters).toBe(0);
    expect(stored.tripLastLatitude).toBeNull();
    expect(stored.tripLastLongitude).toBeNull();
  });

  it('Start rejects wrong driver without mutating tracking', async () => {
    await deleteDriverOrders(users.starter.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'own',
      status: 'ACCEPTED',
      driverId: users.starter.driverId,
      tripDistanceMeters: null,
      tripLastLatitude: 22.1,
      tripLastLongitude: 120.1,
    });

    const cookie = await loginAs(users.other.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/start`)
      .set('Cookie', cookie)
      .expect(404);
    expect(asBody<ApiErrorBody>(response).error.code).toBe('NOT_FOUND');

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.status).toBe('ACCEPTED');
    expect(stored.tripDistanceMeters).toBeNull();
    expect(stored.tripLastLatitude?.toNumber()).toBeCloseTo(22.1, 6);
  });

  it('Start rejects OPEN and COMPLETED', async () => {
    await deleteDriverOrders(users.starter.driverId);
    const openId = randomUUID();
    const completedId = randomUUID();
    await seedOrder({
      id: openId,
      label: 'open',
      status: 'OPEN',
      driverId: null,
    });
    await seedOrder({
      id: completedId,
      label: 'done',
      status: 'COMPLETED',
      driverId: users.starter.driverId,
      tripDistanceMeters: 100,
    });

    const cookie = await loginAs(users.starter.username);
    expect(
      asBody<ApiErrorBody>(
        await request(app.getHttpServer())
          .post(`/api/v1/driver/orders/${openId}/start`)
          .set('Cookie', cookie)
          .expect(404),
      ).error.code,
    ).toBe('NOT_FOUND');
    expect(
      asBody<ApiErrorBody>(
        await request(app.getHttpServer())
          .post(`/api/v1/driver/orders/${completedId}/start`)
          .set('Cookie', cookie)
          .expect(409),
      ).error.code,
    ).toBe('INVALID_ORDER_STATUS');
  });

  it.each([
    { meters: 0, fare: 100 },
    { meters: 1250, fare: 100 },
    { meters: 1251, fare: 100 },
    { meters: 1449, fare: 100 },
    { meters: 1450, fare: 105 },
    { meters: 1650, fare: 110 },
    { meters: 2050, fare: 120 },
  ])(
    'Arrive then Complete keeps calculateTripFare($meters) as calculated_fare $fare',
    async ({ meters, fare }) => {
      await deleteDriverOrders(users.fare.driverId);
      const orderId = randomUUID();
      await seedOrder({
        id: orderId,
        label: `fare-${meters}`,
        status: 'IN_PROGRESS',
        driverId: users.fare.driverId,
        price: '9999.00',
        tripDistanceMeters: meters,
        tripLastLatitude: null,
        tripLastLongitude: null,
      });

      expect(calculateTripFare(meters)).toBe(fare);

      const cookie = await loginAs(users.fare.username);
      // Arrive with no previous point — locks current meters without adding segment.
      await request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/arrive`)
        .set('Cookie', cookie)
        .send(pointA)
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/complete`)
        .set('Cookie', cookie)
        .send({ final_fare: fare })
        .expect(200);

      const body = asBody<ApiSuccessBody<CompleteData>>(response);
      expect(body.data.trip_distance_meters).toBe(meters);
      expect(body.data.calculated_fare).toBe(fare);
      expect(body.data.final_fare).toBe(fare);

      const stored = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(stored.price?.toNumber()).toBe(9999);
      expect(stored.calculatedFare?.toNumber()).toBe(fare);
      expect(stored.finalFare?.toNumber()).toBe(fare);
      expect(stored.tripDistanceMeters).toBe(meters);
      expect(stored.tripLastLatitude).toBeNull();
      expect(stored.tripLastLongitude).toBeNull();
    },
  );

  it('Complete after arrive treats locked 0 mileage as fare 100', async () => {
    await deleteDriverOrders(users.fare.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'null-m',
      status: 'IN_PROGRESS',
      driverId: users.fare.driverId,
      tripDistanceMeters: 0,
      tripLastLatitude: null,
      tripLastLongitude: null,
    });

    const cookie = await loginAs(users.fare.username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointA)
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 100 })
      .expect(200);

    expect(asBody<ApiSuccessBody<CompleteData>>(response).data).toMatchObject({
      trip_distance_meters: 0,
      calculated_fare: 100,
      final_fare: 100,
      status: 'COMPLETED',
    });
  });

  it('repeated Complete does not rewrite fare or events', async () => {
    await deleteDriverOrders(users.fare.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'twice',
      status: 'IN_PROGRESS',
      driverId: users.fare.driverId,
      tripDistanceMeters: 1450,
      tripLastLatitude: null,
      tripLastLongitude: null,
    });

    const cookie = await loginAs(users.fare.username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointA)
      .expect(200);

    const first = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 105 })
      .expect(200);
    const firstBody = asBody<ApiSuccessBody<CompleteData>>(first);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 999 })
      .expect(409);
    expect(asBody<ApiErrorBody>(second).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.price?.toNumber()).toBe(9999);
    expect(stored.calculatedFare?.toNumber()).toBe(105);
    expect(stored.finalFare?.toNumber()).toBe(105);
    expect(stored.completedAt?.toISOString()).toBe(firstBody.data.completed_at);
    expect(
      await prisma.orderEvent.count({
        where: { orderId, eventType: 'ORDER_COMPLETED' },
      }),
    ).toBe(1);
  });

  it('Location after Complete does not accumulate mileage', async () => {
    await deleteDriverOrders(users.fare.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'post-loc',
      status: 'IN_PROGRESS',
      driverId: users.fare.driverId,
      tripDistanceMeters: 8400,
      tripLastLatitude: null,
      tripLastLongitude: null,
    });

    const cookie = await loginAs(users.fare.username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointA)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: calculateTripFare(8400) })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send(pointB)
      .expect(200);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.tripDistanceMeters).toBe(8400);
    expect(stored.calculatedFare?.toNumber()).toBe(calculateTripFare(8400));
    expect(stored.price?.toNumber()).toBe(9999);
    expect(stored.tripLastLatitude).toBeNull();
  });

  it('Location-first race: Arrive+Complete uses latest committed mileage', async () => {
    await deleteDriverOrders(users.raceLoc.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'loc-first',
      status: 'IN_PROGRESS',
      driverId: users.raceLoc.driverId,
      tripDistanceMeters: 0,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
    });

    const cookie = await loginAs(users.raceLoc.username);
    await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send(pointB)
      .expect(200);

    const afterLoc = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const expectedDistance = Math.round(
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude,
      ),
    );
    expect(afterLoc.tripDistanceMeters).toBe(expectedDistance);

    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointB)
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: calculateTripFare(expectedDistance) })
      .expect(200);

    const body = asBody<ApiSuccessBody<CompleteData>>(response);
    expect(body.data.trip_distance_meters).toBe(expectedDistance);
    expect(body.data.calculated_fare).toBe(calculateTripFare(expectedDistance));
    expect(body.data.final_fare).toBe(calculateTripFare(expectedDistance));
  });

  it('Complete-first race: later Location does not accumulate', async () => {
    await deleteDriverOrders(users.raceComp.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'comp-first',
      status: 'IN_PROGRESS',
      driverId: users.raceComp.driverId,
      tripDistanceMeters: 500,
      tripLastLatitude: null,
      tripLastLongitude: null,
    });

    const cookie = await loginAs(users.raceComp.username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointA)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .send({ final_fare: 100 })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send(pointB)
      .expect(200);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.tripDistanceMeters).toBe(500);
    expect(stored.calculatedFare?.toNumber()).toBe(100);
    expect(stored.finalFare?.toNumber()).toBe(100);
    expect(stored.price?.toNumber()).toBe(9999);
  });
});
