import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppErrors } from '../common/errors/app.error';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { SessionService } from './session.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      currentUser?: AuthenticatedUser;
    }>();

    const sessionId = this.sessionService.readSessionId(request.cookies);
    if (!sessionId) {
      throw AppErrors.unauthorized();
    }

    const user = await this.sessionService.findAuthenticatedUser(sessionId);
    if (!user) {
      throw AppErrors.unauthorized();
    }

    request.currentUser = user;
    return true;
  }
}
