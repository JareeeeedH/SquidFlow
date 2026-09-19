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
import { segmentDistanceMeters } from '../src/fare/segment-distance';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'TripLocP@ss-never-log-this';

const pointA = { latitude: 22.6273, longitude: 120.3014 };
const pointB = { latitude: 22.63, longitude: 120.305 };
const pointC = { latitude: 22.635, longitude: 120.31 };

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

describe('Driver Location Trip Tracking P3-4 (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: { id: randomUUID(), username: `p34-admin-${suffix}` },
    idle: {
      id: randomUUID(),
      username: `p34-idle-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `PI-${suffix}`,
    },
    trip: {
      id: randomUUID(),
      username: `p34-trip-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `PT-${suffix}`,
    },
    accepted: {
      id: randomUUID(),
      username: `p34-acc-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `PA-${suffix}`,
    },
    done: {
      id: randomUUID(),
      username: `p34-done-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `PD-${suffix}`,
    },
    race: {
      id: randomUUID(),
      username: `p34-race-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `PR-${suffix}`,
    },
    completeRace: {
      id: randomUUID(),
      username: `p34-cr-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `PC-${suffix}`,
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
            onlineStatus: 'ONLINE',
          },
        },
      },
    });
  }

  async function seedOrder(input: {
    id: string;
    label: string;
    status: 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED';
    driverId: string;
    tripDistanceMeters?: number | null;
    tripLastLatitude?: number | null;
    tripLastLongitude?: number | null;
  }) {
    await prisma.order.create({
      data: {
        id: input.id,
        orderNo: `ORD-P34-${input.label}-${suffix}`,
        customerName: '王先生',
        pickupLocation: '左營高鐵站',
        destination: '高雄小港機場',
        price: new Prisma.Decimal('1200.00'),
        note: null,
        status: input.status,
        dispatchMode: 'OPEN',
        driverId: input.driverId,
        createdBy: users.admin.id,
        acceptedAt: new Date('2026-09-15T07:00:00Z'),
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

  async function patchLocation(
    cookie: string,
    coords: { latitude: number; longitude: number },
  ) {
    return request(app.getHttpServer())
      .patch('/api/v1/driver/location')
      .set('Cookie', cookie)
      .send(coords)
      .expect(200);
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

    await createDriverUser(users.idle);
    await createDriverUser(users.trip);
    await createDriverUser(users.accepted);
    await createDriverUser(users.done);
    await createDriverUser(users.race);
    await createDriverUser(users.completeRace);

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

  it('updates driver location without modifying orders when no IN_PROGRESS trip', async () => {
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'idle-acc',
      status: 'ACCEPTED',
      driverId: users.idle.driverId,
      tripDistanceMeters: null,
      tripLastLatitude: null,
      tripLastLongitude: null,
    });

    const cookie = await loginAs(users.idle.username);
    await patchLocation(cookie, pointA);

    const driver = await prisma.driver.findUniqueOrThrow({
      where: { id: users.idle.driverId },
    });
    expect(driver.latitude?.toNumber()).toBeCloseTo(pointA.latitude, 6);
    expect(driver.longitude?.toNumber()).toBeCloseTo(pointA.longitude, 6);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.tripDistanceMeters).toBeNull();
    expect(order.tripLastLatitude).toBeNull();
    expect(order.tripLastLongitude).toBeNull();
  });

  it('sets first GPS as last point with zero distance for IN_PROGRESS', async () => {
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'first',
      status: 'IN_PROGRESS',
      driverId: users.trip.driverId,
    });

    const cookie = await loginAs(users.trip.username);
    await patchLocation(cookie, pointA);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.tripDistanceMeters).toBe(0);
    expect(order.tripLastLatitude?.toNumber()).toBeCloseTo(pointA.latitude, 6);
    expect(order.tripLastLongitude?.toNumber()).toBeCloseTo(
      pointA.longitude,
      6,
    );
  });

  it('accumulates A→B then A→B→C by segments', async () => {
    await prisma.order.deleteMany({ where: { driverId: users.trip.driverId } });
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'seg',
      status: 'IN_PROGRESS',
      driverId: users.trip.driverId,
    });

    const cookie = await loginAs(users.trip.username);
    await patchLocation(cookie, pointA);
    await patchLocation(cookie, pointB);

    const afterB = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const ab = segmentDistanceMeters(
      pointA.latitude,
      pointA.longitude,
      pointB.latitude,
      pointB.longitude,
    );
    expect(afterB.tripDistanceMeters).toBe(Math.round(ab));
    expect(afterB.tripLastLatitude?.toNumber()).toBeCloseTo(pointB.latitude, 6);

    await patchLocation(cookie, pointC);
    const afterC = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const bc = segmentDistanceMeters(
      pointB.latitude,
      pointB.longitude,
      pointC.latitude,
      pointC.longitude,
    );
    expect(afterC.tripDistanceMeters).toBe(Math.round(ab + bc));
    expect(afterC.tripLastLatitude?.toNumber()).toBeCloseTo(pointC.latitude, 6);
    expect(afterC.tripDistanceMeters).not.toBe(
      Math.round(
        segmentDistanceMeters(
          pointA.latitude,
          pointA.longitude,
          pointC.latitude,
          pointC.longitude,
        ),
      ),
    );
  });

  it('preserves existing accumulated mileage when adding a segment', async () => {
    await prisma.order.deleteMany({ where: { driverId: users.trip.driverId } });
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'keep',
      status: 'IN_PROGRESS',
      driverId: users.trip.driverId,
      tripDistanceMeters: 5000,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
    });

    const cookie = await loginAs(users.trip.username);
    await patchLocation(cookie, pointB);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const ab = segmentDistanceMeters(
      pointA.latitude,
      pointA.longitude,
      pointB.latitude,
      pointB.longitude,
    );
    expect(order.tripDistanceMeters).toBe(Math.round(5000 + ab));
  });

  it('does not accumulate for ACCEPTED orders', async () => {
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'acc-only',
      status: 'ACCEPTED',
      driverId: users.accepted.driverId,
      tripDistanceMeters: null,
      tripLastLatitude: null,
      tripLastLongitude: null,
    });

    const cookie = await loginAs(users.accepted.username);
    await patchLocation(cookie, pointA);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.tripDistanceMeters).toBeNull();
    expect(order.tripLastLatitude).toBeNull();
    expect(order.tripLastLongitude).toBeNull();

    const driver = await prisma.driver.findUniqueOrThrow({
      where: { id: users.accepted.driverId },
    });
    expect(driver.latitude?.toNumber()).toBeCloseTo(pointA.latitude, 6);
  });

  it('does not accumulate for COMPLETED orders', async () => {
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'done-only',
      status: 'COMPLETED',
      driverId: users.done.driverId,
      tripDistanceMeters: 1200,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
    });

    const cookie = await loginAs(users.done.username);
    await patchLocation(cookie, pointB);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.tripDistanceMeters).toBe(1200);
    expect(order.tripLastLatitude?.toNumber()).toBeCloseTo(pointA.latitude, 6);
    expect(order.tripLastLongitude?.toNumber()).toBeCloseTo(pointA.longitude, 6);
  });

  it('serializes concurrent location updates so segments are not lost', async () => {
    await prisma.order.deleteMany({ where: { driverId: users.race.driverId } });
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
    await Promise.all([
      patchLocation(cookie, pointB),
      patchLocation(cookie, pointC),
    ]);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    const abThenBc = Math.round(
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude,
      ) +
        segmentDistanceMeters(
          pointB.latitude,
          pointB.longitude,
          pointC.latitude,
          pointC.longitude,
        ),
    );
    const acThenCb = Math.round(
      segmentDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointC.latitude,
        pointC.longitude,
      ) +
        segmentDistanceMeters(
          pointC.latitude,
          pointC.longitude,
          pointB.latitude,
          pointB.longitude,
        ),
    );

    expect([abThenBc, acThenCb]).toContain(order.tripDistanceMeters);
    expect(order.tripDistanceMeters).toBeGreaterThan(
      Math.round(
        Math.max(
          segmentDistanceMeters(
            pointA.latitude,
            pointA.longitude,
            pointB.latitude,
            pointB.longitude,
          ),
          segmentDistanceMeters(
            pointA.latitude,
            pointA.longitude,
            pointC.latitude,
            pointC.longitude,
          ),
        ),
      ),
    );
  });

  it('does not accumulate after Complete wins the race', async () => {
    await prisma.order.deleteMany({
      where: { driverId: users.completeRace.driverId },
    });
    const orderId = randomUUID();
    await seedOrder({
      id: orderId,
      label: 'cr',
      status: 'IN_PROGRESS',
      driverId: users.completeRace.driverId,
      tripDistanceMeters: 0,
      tripLastLatitude: pointA.latitude,
      tripLastLongitude: pointA.longitude,
    });

    const cookie = await loginAs(users.completeRace.username);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${orderId}/complete`)
      .set('Cookie', cookie)
      .expect(200);

    await patchLocation(cookie, pointB);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe('COMPLETED');
    expect(order.tripDistanceMeters).toBe(0);
    expect(order.tripLastLatitude?.toNumber()).toBeCloseTo(pointA.latitude, 6);
    expect(order.tripLastLongitude?.toNumber()).toBeCloseTo(
      pointA.longitude,
      6,
    );
  });
});
