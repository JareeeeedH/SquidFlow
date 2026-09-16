import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DriversService } from './drivers.service';
import {
  parseUpdateDriverLocationBody,
  parseUpdateOnlineStatusBody,
} from './drivers.validation';

@Controller('driver')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverStatusController {
  constructor(private readonly driversService: DriversService) {}

  @Get('status')
  async getOnlineStatus(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.driversService.getOnlineStatus(user);
    return {
      success: true,
      data,
    };
  }

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

  @Get('location')
  async getOwnLocation(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.driversService.getOwnLocation(user);
    return {
      success: true,
      data,
    };
  }

  @Patch('location')
  async updateOwnLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = await this.driversService.updateOwnLocation(
      user,
      parseUpdateDriverLocationBody(body),
    );
    return {
      success: true,
      data,
    };
  }
}
