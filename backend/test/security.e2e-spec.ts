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
import { RateLimitService } from '../src/common/security/rate-limit.service';
import { API_CONTENT_SECURITY_POLICY } from '../src/common/security/security-headers';
import { setupApp } from '../src/setup-app';
import { cleanupTestUsers } from './cleanup-test-data';

config();

const SECURITY_ENV = {
  FRONTEND_ORIGIN: 'http://app.squidflow.test',
  LOGIN_MAX_FAILURES: '3',
  LOGIN_FAILURE_WINDOW_SECONDS: '60',
  LOGIN_RATE_LIMIT_MAX: '5',
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: '60',
  HIGH_RISK_RATE_LIMIT_MAX: '2',
  HIGH_RISK_RATE_LIMIT_WINDOW_SECONDS: '60',
} as const;

const prisma = new PrismaClient();
const password = 'SecurityTestP@ss-never-log-this';

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

function asError(response: request.Response): ApiErrorBody {
  return response.body as ApiErrorBody;
}

describe('Production security hardening (e2e)', () => {
  let app: INestApplication<App>;
  let rateLimits: RateLimitService;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    admin: {
      id: randomUUID(),
      username: `sec-admin-${suffix}`,
    },
    driver: {
      id: randomUUID(),
      username: `sec-driver-${suffix}`,
      driverId: randomUUID(),
      licensePlate: `SEC${suffix}`,
    },
  };
  const originalEnv: Partial<Record<keyof typeof SECURITY_ENV, string>> = {};

  function orderRecord(id: string, status: 'DRAFT' | 'OPEN', orderNo: string) {
    return {
      id,
      orderNo,
      customerName: '王先生',
      pickupLocation: '左營高鐵站',
      destination: '高雄小港機場',
      price: new Prisma.Decimal('1200.00'),
      note: '2件行李',
      status,
      dispatchMode: 'OPEN' as const,
      createdBy: users.admin.id,
    };
  }

  async function loginAs(username: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(200);
    const cookie = sessionCookie(response);
    expect(cookie).toBeDefined();
    return cookie as string;
  }

  beforeAll(async () => {
    for (const key of Object.keys(
      SECURITY_ENV,
    ) as (keyof typeof SECURITY_ENV)[]) {
      originalEnv[key] = process.env[key];
      process.env[key] = SECURITY_ENV[key];
    }

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
            onlineStatus: 'ONLINE',
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
    rateLimits = app.get(RateLimitService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await cleanupTestUsers(prisma, [users.admin.id, users.driver.id]);
    await prisma.$disconnect();
    for (const key of Object.keys(
      SECURITY_ENV,
    ) as (keyof typeof SECURITY_ENV)[]) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  beforeEach(() => {
    rateLimits.resetAll();
  });

  it('sets required security headers and omits HSTS outside production', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.headers['content-security-policy']).toBe(
      API_CONTENT_SECURITY_POLICY,
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('allows credentialed CORS for the frontend allowlist', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', SECURITY_ENV.FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      SECURITY_ENV.FRONTEND_ORIGIN,
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not reflect disallowed CORS origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('locks login after repeated invalid credentials, including the correct password', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const failed = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: users.admin.username, password: 'wrong-password' })
        .expect(401);
      expect(asError(failed).error.code).toBe('INVALID_CREDENTIALS');
    }

    const locked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: users.admin.username, password })
      .expect(429);
    expect(asError(locked).error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('clears brute-force failures after a successful login', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: users.admin.username, password: 'wrong-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: users.admin.username, password: 'wrong-password' })
      .expect(401);

    const success = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: users.admin.username, password })
      .expect(200);
    const cookie = sessionCookie(success);
    expect(cookie).toContain('HttpOnly');
    expect(cookie?.toLowerCase()).toContain('samesite=lax');
    expect(cookie?.toLowerCase()).not.toContain('secure');

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie as string)
      .expect(200);
  });

  it('rate-limits login requests from the same client', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: users.admin.username, password })
        .expect(200);
    }

    const limited = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: users.admin.username, password })
      .expect(429);
    expect(asError(limited).error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('rate-limits publish', async () => {
    const drafts = [randomUUID(), randomUUID(), randomUUID()];
    await prisma.order.createMany({
      data: drafts.map((id, index) => ({
        ...orderRecord(id, 'DRAFT', `ORD-SEC-P${index}-${suffix}`),
      })),
    });
    const cookie = await loginAs(users.admin.username);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${drafts[0]}/publish`)
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${drafts[1]}/publish`)
      .set('Cookie', cookie)
      .expect(200);
    const limited = await request(app.getHttpServer())
      .post(`/api/v1/orders/${drafts[2]}/publish`)
      .set('Cookie', cookie)
      .expect(429);
    expect(asError(limited).error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('rate-limits cancel', async () => {
    const openIds = [randomUUID(), randomUUID(), randomUUID()];
    await prisma.order.createMany({
      data: openIds.map((id, index) => ({
        ...orderRecord(id, 'OPEN', `ORD-SEC-C${index}-${suffix}`),
      })),
    });
    const cookie = await loginAs(users.admin.username);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${openIds[0]}/cancel`)
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${openIds[1]}/cancel`)
      .set('Cookie', cookie)
      .expect(200);
    const limited = await request(app.getHttpServer())
      .post(`/api/v1/orders/${openIds[2]}/cancel`)
      .set('Cookie', cookie)
      .expect(429);
    expect(asError(limited).error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('rate-limits accept', async () => {
    const openIds = [randomUUID(), randomUUID(), randomUUID()];
    await prisma.order.createMany({
      data: openIds.map((id, index) => ({
        ...orderRecord(id, 'OPEN', `ORD-SEC-A${index}-${suffix}`),
      })),
    });
    const cookie = await loginAs(users.driver.username);

    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${openIds[0]}/accept`)
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${openIds[1]}/accept`)
      .set('Cookie', cookie)
      .expect(409);
    const limited = await request(app.getHttpServer())
      .post(`/api/v1/driver/orders/${openIds[2]}/accept`)
      .set('Cookie', cookie)
      .expect(429);
    expect(asError(limited).error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('keeps driver forbidden from admin publish', async () => {
    const draftId = randomUUID();
    await prisma.order.create({
      data: {
        ...orderRecord(draftId, 'DRAFT', `ORD-SEC-R-${suffix}`),
      },
    });
    const cookie = await loginAs(users.driver.username);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/orders/${draftId}/publish`)
      .set('Cookie', cookie)
      .expect(403);
    expect(asError(response).error.code).toBe('FORBIDDEN');
  });
});
