import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AppErrors } from '../common/errors/app.error';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      currentUser?: AuthenticatedUser;
    }>();
    const user = request.currentUser;
    if (!user) {
      throw AppErrors.unauthorized();
    }
    if (!requiredRoles.includes(user.role)) {
      throw AppErrors.forbidden();
    }
    return true;
  }
}
