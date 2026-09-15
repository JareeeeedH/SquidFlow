import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SESSION_COOKIE_NAME } from '../src/common/cookie/cookie.config';
import {
  orderNoPrefix,
  parseOrderNoSerial,
  taipeiDateStamp,
} from '../src/orders/order-number';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const prisma = new PrismaClient();
const password = 'OrderDraftP@ss-never-log-this';

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
  dispatch_mode: string;
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

describe('Admin Order CRUD / DRAFT (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `d6-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `d6-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `D6A-${suffix}`,
    },
  };

  function orderPayload(overrides: Record<string, unknown> = {}) {
    return {
      customer_name: '王先生',
      pickup_location: '左營高鐵站',
      destination: '高雄小港機場',
      price: 1200,
      note: '2件行李',
      ...overrides,
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

  async function createDraft(
    cookie: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send(orderPayload(overrides))
      .expect(200);
    return asBody<ApiSuccessBody<CreateOrderData>>(response).data;
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
      .get('/api/v1/orders')
      .expect(401);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when a DRIVER calls admin order APIs', async () => {
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Cookie', cookie)
      .expect(403);

    expect(asBody<ApiErrorBody>(response)).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it('lets an ADMIN create a DRAFT order with backend defaults', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        ...orderPayload(),
        status: 'OPEN',
        dispatch_mode: 'DIRECT',
        driver_id: users.driver.driverId,
        created_by: users.driver.id,
        accepted_at: '2026-09-15T07:05:00Z',
        started_at: '2026-09-15T07:30:00Z',
        completed_at: '2026-09-15T08:20:00Z',
        cancelled_at: '2026-09-15T08:00:00Z',
        order_no: 'ORD-19990101-999',
      })
      .expect(200);

    const body = asBody<ApiSuccessBody<CreateOrderData>>(response);
    expect(body).toMatchObject({
      success: true,
      data: {
        status: 'DRAFT',
        dispatch_mode: 'OPEN',
      },
    });
    expect(body.data.order_no).toMatch(/^ORD-\d{8}-\d{3,}$/);
    expect(body.data.order_no).not.toBe('ORD-19990101-999');
    assertNoSecrets(body);

    const created = await prisma.order.findUnique({
      where: { id: body.data.id },
      include: { events: true },
    });
    expect(created?.status).toBe('DRAFT');
    expect(created?.dispatchMode).toBe('OPEN');
    expect(created?.driverId).toBeNull();
    expect(created?.createdBy).toBe(users.admin.id);
    expect(created?.acceptedAt).toBeNull();
    expect(created?.startedAt).toBeNull();
    expect(created?.completedAt).toBeNull();
    expect(created?.cancelledAt).toBeNull();
    expect(created?.price?.toNumber()).toBe(1200);
    expect(created).not.toHaveProperty('scheduledAt');
    expect(created).not.toHaveProperty('vehicleType');
    expect(created?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'ORDER_CREATED',
          actorUserId: users.admin.id,
        }),
      ]),
    );
  });

  it('increments same-day order numbers without duplicates', async () => {
    const cookie = await adminCookie();
    const first = await createDraft(cookie);
    const second = await createDraft(cookie);
    const today = taipeiDateStamp();

    expect(first.order_no.startsWith(orderNoPrefix(today))).toBe(true);
    expect(second.order_no.startsWith(orderNoPrefix(today))).toBe(true);
    expect(second.order_no).not.toBe(first.order_no);
    expect(parseOrderNoSerial(second.order_no)).toBe(
      (parseOrderNoSerial(first.order_no) as number) + 1,
    );
  });

  it('starts a new date segment independently of another date prefix', async () => {
    await prisma.order.create({
      data: {
        orderNo: 'ORD-19990101-099',
        customerName: '舊單',
        pickupLocation: '左營高鐵站',
        destination: '小港機場',
        price: 100,
        status: 'DRAFT',
        dispatchMode: 'OPEN',
        createdBy: users.admin.id,
      },
    });
    const cookie = await adminCookie();
    const created = await createDraft(cookie);

    expect(created.order_no.startsWith('ORD-19990101-')).toBe(false);
    expect(created.order_no).not.toBe('ORD-19990101-100');
    expect(created.order_no.startsWith(orderNoPrefix(taipeiDateStamp()))).toBe(
      true,
    );
  });

  it('does not duplicate order_no under concurrent creates', async () => {
    const cookie = await adminCookie();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', cookie)
          .send(orderPayload())
          .expect(200),
      ),
    );

    const orderNos = responses.map(
      (response) =>
        asBody<ApiSuccessBody<CreateOrderData>>(response).data.order_no,
    );
    expect(new Set(orderNos).size).toBe(orderNos.length);
  });

  it('lists orders and returns a single order without secrets', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);

    const list = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Cookie', cookie)
      .expect(200);
    const listBody =
      asBody<ApiSuccessBody<Array<{ id: string; order_no: string }>>>(list);
    expect(listBody.success).toBe(true);
    expect(listBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          order_no: created.order_no,
          customer_name: '王先生',
          status: 'DRAFT',
          driver_id: null,
          price: 1200,
        }),
      ]),
    );
    assertNoSecrets(listBody);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${created.id}`)
      .set('Cookie', cookie)
      .expect(200);
    const detailBody = asBody<
      ApiSuccessBody<{
        id: string;
        created_by: string;
        dispatch_mode: string;
      }>
    >(detail);
    expect(detailBody.data).toMatchObject({
      id: created.id,
      created_by: users.admin.id,
      dispatch_mode: 'OPEN',
      driver_id: null,
      driver: null,
    });
    expect(detailBody.data).not.toHaveProperty('scheduled_at');
    expect(detailBody.data).not.toHaveProperty('vehicle_type');
    assertNoSecrets(detailBody);
  });

  it('returns assigned driver vehicle fields on order detail without extra driver payload', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);
    await prisma.order.update({
      where: { id: created.id },
      data: {
        status: 'ACCEPTED',
        driverId: users.driver.driverId,
        acceptedAt: new Date('2026-09-15T07:05:00Z'),
      },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${created.id}`)
      .set('Cookie', cookie)
      .expect(200);
    const detailBody = asBody<
      ApiSuccessBody<{
        driver_id: string;
        driver: {
          username: string;
          license_plate: string;
          vehicle_brand: string;
          vehicle_model: string;
          vehicle_color: string;
        };
      }>
    >(detail);

    expect(detailBody.data.driver_id).toBe(users.driver.driverId);
    expect(detailBody.data.driver).toEqual({
      username: users.driver.username,
      license_plate: users.driver.licensePlate,
      vehicle_brand: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_color: '黑色',
    });
    expect(Object.keys(detailBody.data.driver).sort()).toEqual([
      'license_plate',
      'username',
      'vehicle_brand',
      'vehicle_color',
      'vehicle_model',
    ]);
    expect(detailBody.data.driver).not.toHaveProperty('vehicle_type');
    expect(JSON.stringify(detailBody.data.driver)).not.toContain(
      'vehicle_year',
    );
    expect(JSON.stringify(detailBody.data.driver)).not.toContain(
      'online_status',
    );
    assertNoSecrets(detailBody);
  });

  it('filters orders by status', async () => {
    const cookie = await adminCookie();
    const draft = await createDraft(cookie);
    const open = await createDraft(cookie, { customer_name: 'status-open' });
    await prisma.order.update({
      where: { id: open.id },
      data: { status: 'OPEN' },
    });

    const openList = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ status: 'OPEN' })
      .set('Cookie', cookie)
      .expect(200);
    const openIds = asBody<ApiSuccessBody<Array<{ id: string }>>>(
      openList,
    ).data.map((order) => order.id);
    expect(openIds).toContain(open.id);
    expect(openIds).not.toContain(draft.id);

    const draftList = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ status: 'DRAFT' })
      .set('Cookie', cookie)
      .expect(200);
    const draftIds = asBody<ApiSuccessBody<Array<{ id: string }>>>(
      draftList,
    ).data.map((order) => order.id);
    expect(draftIds).toContain(draft.id);
    expect(draftIds).not.toContain(open.id);
  });

  it('filters orders by Taipei created_at date', async () => {
    const cookie = await adminCookie();
    const sept15 = await createDraft(cookie, {
      customer_name: 'date-15',
    });
    const sept16 = await createDraft(cookie, {
      customer_name: 'date-16',
    });
    await prisma.order.update({
      where: { id: sept15.id },
      data: { createdAt: new Date('2026-09-15T07:00:00.000Z') },
    });
    await prisma.order.update({
      where: { id: sept16.id },
      data: { createdAt: new Date('2026-09-16T07:00:00.000Z') },
    });

    const listed = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ date: '2026-09-15' })
      .set('Cookie', cookie)
      .expect(200);
    const ids = asBody<ApiSuccessBody<Array<{ id: string }>>>(listed).data.map(
      (order) => order.id,
    );
    expect(ids).toContain(sept15.id);
    expect(ids).not.toContain(sept16.id);
  });

  it('searches orders by order_no and customer_name', async () => {
    const cookie = await adminCookie();
    const byName = await createDraft(cookie, {
      customer_name: `搜尋姓名-${suffix}`,
    });
    const byNumber = await createDraft(cookie, {
      customer_name: '另一位客人',
    });

    const nameSearch = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ search: `搜尋姓名-${suffix}` })
      .set('Cookie', cookie)
      .expect(200);
    const nameIds = asBody<ApiSuccessBody<Array<{ id: string }>>>(
      nameSearch,
    ).data.map((order) => order.id);
    expect(nameIds).toContain(byName.id);
    expect(nameIds).not.toContain(byNumber.id);

    const noSearch = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ search: byNumber.order_no })
      .set('Cookie', cookie)
      .expect(200);
    const noIds = asBody<ApiSuccessBody<Array<{ id: string }>>>(
      noSearch,
    ).data.map((order) => order.id);
    expect(noIds).toContain(byNumber.id);
    expect(noIds).not.toContain(byName.id);
  });

  it('returns VALIDATION_ERROR for invalid list query values', async () => {
    const cookie = await adminCookie();

    const statusResponse = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ status: 'ACTIVE' })
      .set('Cookie', cookie)
      .expect(400);
    expect(asBody<ApiErrorBody>(statusResponse).error.code).toBe(
      'VALIDATION_ERROR',
    );

    const dateResponse = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ date: '2026-13-01' })
      .set('Cookie', cookie)
      .expect(400);
    expect(asBody<ApiErrorBody>(dateResponse).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('returns 404 for a missing order', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .get(`/api/v1/orders/${randomUUID()}`)
      .set('Cookie', cookie)
      .expect(404);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('NOT_FOUND');
  });

  it('updates a DRAFT order without changing system fields', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);
    const before = await prisma.order.findUnique({ where: { id: created.id } });

    const response = await request(app.getHttpServer())
      .put(`/api/v1/orders/${created.id}`)
      .set('Cookie', cookie)
      .send({
        customer_name: '李先生',
        pickup_location: '高雄車站',
        destination: '義享天地',
        price: 1500.5,
        note: '3件行李',
        order_no: 'ORD-19990101-001',
        status: 'OPEN',
        dispatch_mode: 'AUTO',
        driver_id: users.driver.driverId,
        created_by: users.driver.id,
      })
      .expect(200);

    const body = asBody<
      ApiSuccessBody<{
        customer_name: string;
        order_no: string;
        status: string;
        driver_id: string | null;
        dispatch_mode: string;
        price: number;
      }>
    >(response);
    expect(body.data).toMatchObject({
      customer_name: '李先生',
      pickup_location: '高雄車站',
      destination: '義享天地',
      price: 1500.5,
      note: '3件行李',
      order_no: created.order_no,
      status: 'DRAFT',
      dispatch_mode: 'OPEN',
      driver_id: null,
      created_by: users.admin.id,
    });
    expect(before?.orderNo).toBe(created.order_no);
  });

  it('rejects PUT for non-DRAFT orders', async () => {
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
        .put(`/api/v1/orders/${created.id}`)
        .set('Cookie', cookie)
        .send(orderPayload())
        .expect(409);

      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'INVALID_ORDER_STATUS',
      );
    }
  });

  it('hard-deletes a DRAFT order and its ORDER_CREATED event', async () => {
    const cookie = await adminCookie();
    const created = await createDraft(cookie);

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/orders/${created.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(asBody<{ success: true; data: null }>(response)).toEqual({
      success: true,
      data: null,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/orders/${created.id}`)
      .set('Cookie', cookie)
      .expect(404);

    expect(
      await prisma.order.findUnique({ where: { id: created.id } }),
    ).toBeNull();
    expect(
      await prisma.orderEvent.count({ where: { orderId: created.id } }),
    ).toBe(0);
  });

  it('rejects DELETE for non-DRAFT orders', async () => {
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
        .delete(`/api/v1/orders/${created.id}`)
        .set('Cookie', cookie)
        .expect(409);

      expect(asBody<ApiErrorBody>(response).error.code).toBe(
        'INVALID_ORDER_STATUS',
      );
      expect(
        await prisma.order.findUnique({ where: { id: created.id } }),
      ).not.toBeNull();
    }
  });

  it('returns VALIDATION_ERROR for missing required fields', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({})
      .expect(400);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('VALIDATION_ERROR');
  });

  it('creates an order with only pickup_location and stores optional fields as null', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        pickup_location: '左營高鐵站',
        scheduled_at: '2026-09-15T15:30:00',
        vehicle_type: '5人座',
      })
      .expect(200);

    const body = asBody<ApiSuccessBody<CreateOrderData>>(response);
    const stored = await prisma.order.findUnique({
      where: { id: body.data.id },
    });
    expect(stored?.pickupLocation).toBe('左營高鐵站');
    expect(stored?.customerName).toBeNull();
    expect(stored?.destination).toBeNull();
    expect(stored?.price).toBeNull();
    expect(stored?.note).toBeNull();
  });

  it('returns VALIDATION_ERROR for an invalid price', async () => {
    const cookie = await adminCookie();
    const response = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send(orderPayload({ price: 'abc' }))
      .expect(400);

    expect(asBody<ApiErrorBody>(response).error.code).toBe('VALIDATION_ERROR');
  });
});
