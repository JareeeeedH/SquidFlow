import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppError, AppErrors } from '../common/errors/app.error';
import { RateLimitService } from '../common/security/rate-limit.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly rateLimits: RateLimitService,
  ) {}

  async login(username: string, password: string, ip: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          passwordHash: true,
        },
      });

      if (!user) {
        throw AppErrors.invalidCredentials();
      }

      const passwordMatches = await this.passwordService.verify(
        password,
        user.passwordHash,
      );
      if (!passwordMatches) {
        throw AppErrors.invalidCredentials();
      }

      if (user.status === 'SUSPENDED') {
        throw AppErrors.accountSuspended();
      }

      const session = await this.sessionService.replaceActiveSession(user.id);
      this.rateLimits.clearLoginFailures(ip, username);

      return {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        session,
      };
    } catch (error) {
      if (
        error instanceof AppError &&
        error.errorCode === 'INVALID_CREDENTIALS'
      ) {
        this.rateLimits.recordLoginFailure(ip, username);
      }
      throw error;
    }
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (!sessionId) {
      return;
    }
    const userId = await this.sessionService.revokeById(sessionId);
    if (userId) {
      await this.prisma.pushSubscription.deleteMany({
        where: { userId },
      });
    }
  }
}
