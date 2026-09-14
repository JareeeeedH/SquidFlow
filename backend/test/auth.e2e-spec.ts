import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
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
const password = 'AuthTestP@ss-never-log-this';

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

function sessionIdFromCookie(cookie: string): string {
  return cookie.split(';')[0].slice(`${SESSION_COOKIE_NAME}=`.length);
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = randomUUID().slice(0, 8);
  const users = {
    active: {
      id: randomUUID(),
      username: `auth-active-${suffix}`,
    },
    suspended: {
      id: randomUUID(),
      username: `auth-suspended-${suffix}`,
    },
  };

  beforeAll(async () => {
    await prisma.$connect();
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.createMany({
      data: [
        {
          id: users.active.id,
          username: users.active.username,
          passwordHash,
          role: 'DRIVER',
          status: 'ACTIVE',
        },
        {
          id: users.suspended.id,
          username: users.suspended.username,
          passwordHash,
          role: 'DRIVER',
          status: 'SUSPENDED',
        },
      ],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: {
        userId: {
          in: [users.active.id, users.suspended.id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [users.active.id, users.suspended.id],
        },
      },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it('logs in with the correct username and password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.active.username,
        password,
      })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: users.active.id,
        username: users.active.username,
        role: 'DRIVER',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('returns INVALID_CREDENTIALS for an unknown username', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: `missing-${suffix}`,
        password,
      })
      .expect(401);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: '帳號或密碼錯誤',
      },
    });
  });

  it('returns INVALID_CREDENTIALS for an incorrect password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.active.username,
        password: 'wrong-password',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
      },
    });
  });

  it('returns ACCOUNT_SUSPENDED for a suspended account', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.suspended.username,
        password,
      })
      .expect(403);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message: '帳號已停用',
      },
    });
  });

  it('creates a session and sets an HttpOnly cookie on login', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.active.username,
        password,
      })
      .expect(200);

    const cookie = sessionCookie(response);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const session = await prisma.session.findFirst({
      where: {
        id: sessionIdFromCookie(cookie as string),
        userId: users.active.id,
        revokedAt: null,
      },
    });
    expect(session).not.toBeNull();
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns the current user from GET /auth/me', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.active.username,
        password,
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie(loginResponse) as string)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        id: users.active.id,
        username: users.active.username,
        role: 'DRIVER',
        status: 'ACTIVE',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('returns 401 when no cookie is sent', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('returns 401 for a session that does not exist', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${randomUUID()}`)
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('returns 401 for a revoked session', async () => {
    const session = await prisma.session.create({
      data: {
        userId: users.active.id,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${session.id}`)
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('returns 401 for an expired session', async () => {
    await prisma.session.updateMany({
      where: {
        userId: users.active.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const session = await prisma.session.create({
      data: {
        userId: users.active.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${session.id}`)
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('revokes the session, clears the cookie, and rejects /auth/me after logout', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.active.username,
        password,
      })
      .expect(200);

    const cookie = sessionCookie(loginResponse) as string;
    const sessionId = sessionIdFromCookie(cookie);

    const logoutResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    expect(logoutResponse.body).toEqual({
      success: true,
      data: null,
    });
    expect(sessionCookie(logoutResponse)).toMatch(/squidflow_session=/i);

    const revoked = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    expect(revoked?.revokedAt).not.toBeNull();

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('returns success when logout is called without a session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: null,
    });
  });

  it('revokes the previous session and keeps only one active session on the second login', async () => {
    const firstLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.active.username,
        password,
      })
      .expect(200);
    const firstCookie = sessionCookie(firstLogin) as string;
    const firstSessionId = sessionIdFromCookie(firstCookie);

    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: users.active.username,
        password,
      })
      .expect(200);
    const secondCookie = sessionCookie(secondLogin) as string;
    const secondSessionId = sessionIdFromCookie(secondCookie);

    expect(secondSessionId).not.toBe(firstSessionId);

    const firstSession = await prisma.session.findUnique({
      where: { id: firstSessionId },
    });
    expect(firstSession?.revokedAt).not.toBeNull();

    const activeSessions = await prisma.session.findMany({
      where: {
        userId: users.active.id,
        revokedAt: null,
      },
    });
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].id).toBe(secondSessionId);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', firstCookie)
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', secondCookie)
      .expect(200);
  });

  it('does not log the password during login', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const consoleLog = jest.spyOn(console, 'log').mockImplementation();
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

    try {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: users.active.username,
          password,
        })
        .expect(200);

      const output = [
        ...logSpy.mock.calls,
        ...errorSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...debugSpy.mock.calls,
        ...consoleLog.mock.calls,
        ...consoleError.mock.calls,
        ...consoleWarn.mock.calls,
      ]
        .flat()
        .map((value) => String(value))
        .join(' ');

      expect(output).not.toContain(password);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      debugSpy.mockRestore();
      consoleLog.mockRestore();
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  });
});
