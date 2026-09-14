import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DriversService } from './drivers.service';
import { parseUpdateOnlineStatusBody } from './drivers.validation';

@Controller('driver')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverStatusController {
  constructor(private readonly driversService: DriversService) {}

  @Patch('status')
  async updateOnlineStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = await this.driversService.updateOnlineStatus(
      user,
      parseUpdateOnlineStatusBody(body),
    );
    return {
      success: true,
      data,
    };
  }
}
