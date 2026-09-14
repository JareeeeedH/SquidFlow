import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  getSessionTtlSeconds,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '../common/cookie/cookie.config';
import { AuthenticatedUser } from '../common/types/authenticated-user';

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async replaceActiveSession(userId: string) {
    const expiresAt = new Date(Date.now() + getSessionTtlSeconds() * 1000);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.revokeActiveSessions(userId, tx);
          return tx.session.create({
            data: {
              userId,
              expiresAt,
            },
          });
        });
      } catch (error) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!isUniqueConflict || attempt === 2) {
          throw error;
        }
      }
    }

    throw new Error('Unable to create session');
  }

  async revokeActiveSessions(
    userId: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    await db.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async findAuthenticatedUser(
    sessionId: string,
  ): Promise<AuthenticatedUser | null> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    return session.user;
  }

  setCookie(response: Response, sessionId: string, expiresAt: Date): void {
    response.cookie(SESSION_COOKIE_NAME, sessionId, {
      ...sessionCookieOptions(),
      expires: expiresAt,
    });
  }

  clearCookie(response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  }

  readSessionId(
    cookies: Record<string, string> | undefined,
  ): string | undefined {
    return cookies?.[SESSION_COOKIE_NAME];
  }
}
