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
const password = 'P3ArriveE2EP@ss-never-log';

const pointA = { latitude: 22.6273, longitude: 120.3014 };
const pointB = { latitude: 22.63, longitude: 120.305 };
const pointC = { latitude: 22.633098, longitude: 120.302157 };

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

type ArriveData = {
  id: string;
  status: string;
  arrived_at: string;
  trip_distance_meters: number;
  calculated_fare: number | null;
  final_fare: number | null;
};

function asBody<T>(response: request.Response): T {
  return response.body as T;
}

describe('Driver order arrive P3 (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: { id: randomUUID(), username: `arr-admin-${suffix}` },
    owner: {
      id: randomUUID(),
      username: `arr-owner-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `AO-${suffix}`,
    },
    other: {
      id: randomUUID(),
      username: `arr-other-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `AR-${suffix}`,
    },
    race: {
      id: randomUUID(),
      username: `arr-race-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `AC-${suffix}`,
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

  async function seedOrder(input: {
    id: string;
    label: string;
    status: 'OPEN' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED';
    driverId?: string | null;
    price?: string;
    tripDistanceMeters?: number | null;
    tripLastLatitude?: number | null;
    tripLastLongitude?: number | null;
    arrivedAt?: Date | null;
    calculatedFare?: number | null;
  }) {
    await prisma.order.create({
      data: {
        id: input.id,
        orderNo: `ORD-ARR-${input.label}-${suffix}`,
        customerName: 'Customer',
        pickupLocation: 'Pickup',
        destination: 'Destination',
        price: new Prisma.Decimal(input.price ?? '1200.00'),
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
        arrivedAt: input.arrivedAt ?? null,
        calculatedFare:
          input.calculatedFare == null
            ? null
            : new Prisma.Decimal(input.calculatedFare),
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

  it('IN_PROGRESS owner can arrive; status stays IN_PROGRESS', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'ok',
      status: 'IN_PROGRESS',
      driverId: users.owner.driverId,
      tripDistanceMeters: 0,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
      price: '1200.00',
    });

    const cookie = await loginAs(users.owner.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointB)
      .expect(200);

    const body = asBody<ApiSuccessBody<ArriveData>>(response);
    const expectedMeters = Math.round(
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude,
      ),
    );
    expect(body.data.status).toBe('IN_PROGRESS');
    expect(body.data.trip_distance_meters).toBe(expectedMeters);
    expect(body.data.calculated_fare).toBe(calculateTripFare(expectedMeters));
    expect(body.data.final_fare).toBeNull();
    expect(body.data.arrived_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.status).toBe('IN_PROGRESS');
    expect(stored.arrivedAt).not.toBeNull();
    expect(stored.tripDistanceMeters).toBe(expectedMeters);
    expect(stored.calculatedFare?.toNumber()).toBe(
      calculateTripFare(expectedMeters),
    );
    expect(stored.finalFare).toBeNull();
    expect(stored.price?.toNumber()).toBe(1200);
    expect(stored.tripLastLatitude).toBeNull();
    expect(stored.tripLastLongitude).toBeNull();

    const events = await prisma.orderEvent.count({
      where: { orderId, eventType: 'ORDER_ARRIVED' },
    });
    expect(events).toBe(1);
  });

  it('rejects arrive from another driver', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'forbid',
      status: 'IN_PROGRESS',
      driverId: users.owner.driverId,
      tripDistanceMeters: 100,
    });

    const cookie = await loginAs(users.other.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointC)
      .expect(404);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('NOT_FOUND');
  });

  it('rejects arrive when order is not IN_PROGRESS', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'acc',
      status: 'ACCEPTED',
      driverId: users.owner.driverId,
    });

    const cookie = await loginAs(users.owner.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointC)
      .expect(409);

    expect(asBody<ApiErrorBody>(response).error.code).toBe(
      'INVALID_ORDER_STATUS',
    );
  });

  it('includes last GPS segment in mileage when previous billing point exists', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    const prior = 500;
    await seedOrder({
      id: orderId,
      label: 'seg',
      status: 'IN_PROGRESS',
      driverId: users.owner.driverId,
      tripDistanceMeters: prior,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
    });

    const cookie = await loginAs(users.owner.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointB)
      .expect(200);

    const segment = Math.round(
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude,
      ),
    );
    const expected = prior + segment;
    const body = asBody<ApiSuccessBody<ArriveData>>(response);
    expect(body.data.trip_distance_meters).toBe(expected);
    expect(body.data.calculated_fare).toBe(calculateTripFare(expected));
  });

  it('does not increase mileage when there is no previous billing point', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'first',
      status: 'IN_PROGRESS',
      driverId: users.owner.driverId,
      tripDistanceMeters: 0,
      tripLastLatitude: null,
      tripLastLongitude: null,
    });

    const cookie = await loginAs(users.owner.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointC)
      .expect(200);

    const body = asBody<ApiSuccessBody<ArriveData>>(response);
    expect(body.data.trip_distance_meters).toBe(0);
    expect(body.data.calculated_fare).toBe(100);
  });

  it('stops GPS mileage accumulation after arrive', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'lock',
      status: 'IN_PROGRESS',
      driverId: users.owner.driverId,
      tripDistanceMeters: 0,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
    });

    const cookie = await loginAs(users.owner.username);
    const arrive = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointB)
      .expect(200);

    const lockedMeters =
      asBody<ApiSuccessBody<ArriveData>>(arrive).data.trip_distance_meters;

    await request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send(pointC)
      .expect(200);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.tripDistanceMeters).toBe(lockedMeters);
    expect(stored.arrivedAt).not.toBeNull();
  });

  it('repeat arrive is idempotent and does not double-count', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'idem',
      status: 'IN_PROGRESS',
      driverId: users.owner.driverId,
      tripDistanceMeters: 0,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
    });

    const cookie = await loginAs(users.owner.username);
    const first = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointB)
      .expect(200);
    const firstBody = asBody<ApiSuccessBody<ArriveData>>(first);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send(pointC)
      .expect(200);
    const secondBody = asBody<ApiSuccessBody<ArriveData>>(second);

    expect(secondBody.data.trip_distance_meters).toBe(
      firstBody.data.trip_distance_meters,
    );
    expect(secondBody.data.calculated_fare).toBe(
      firstBody.data.calculated_fare,
    );
    expect(secondBody.data.arrived_at).toBe(firstBody.data.arrived_at);

    const events = await prisma.orderEvent.count({
      where: { orderId, eventType: 'ORDER_ARRIVED' },
    });
    expect(events).toBe(1);
  });

  it('rejects invalid latitude / longitude', async () => {
    await deleteDriverOrders(users.owner.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'bad',
      status: 'IN_PROGRESS',
      driverId: users.owner.driverId,
      tripDistanceMeters: 0,
    });

    const cookie = await loginAs(users.owner.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/arrive`)
      .set('Cookie', cookie)
      .send({ latitude: 91, longitude: 120 })
      .expect(400);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('VALIDATION_ERROR');
  });

  it('concurrent arrive does not double-count mileage', async () => {
    await deleteDriverOrders(users.race.driverId);
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'race',
      status: 'IN_PROGRESS',
      driverId: users.race.driverId,
      tripDistanceMeters: 0,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
    });

    const cookie = await loginAs(users.race.username);
    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/arrive`)
        .set('Cookie', cookie)
        .send(pointB),
      request(app.getHttpServer())
        .post(`/api/v1/driver/orders/${orderId}/arrive`)
        .set('Cookie', cookie)
        .send(pointB),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const expected = Math.round(
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude,
      ),
    );
    const bodyA = asBody<ApiSuccessBody<ArriveData>>(a);
    const bodyB = asBody<ApiSuccessBody<ArriveData>>(b);
    expect(bodyA.data.trip_distance_meters).toBe(expected);
    expect(bodyB.data.trip_distance_meters).toBe(expected);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(stored.tripDistanceMeters).toBe(expected);
    expect(stored.calculatedFare?.toNumber()).toBe(calculateTripFare(expected));

    const events = await prisma.orderEvent.count({
      where: { orderId, eventType: 'ORDER_ARRIVED' },
    });
    expect(events).toBe(1);
  });
});
