import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { NotificationsService } from './notifications.service';
import {
  parseDeletePushSubscriptionBody,
  parsePushSubscriptionBody,
} from './notifications.validation';

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscription')
  @HttpCode(HttpStatus.OK)
  async upsertSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const data = await this.notificationsService.upsertSubscription(
      user,
      parsePushSubscriptionBody(body),
    );
    return {
      success: true,
      data,
    };
  }

  @Delete('subscription')
  @HttpCode(HttpStatus.OK)
  async deleteSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const { endpoint } = parseDeletePushSubscriptionBody(body);
    await this.notificationsService.deleteSubscription(user, endpoint);
    return {
      success: true,
      data: null,
    };
  }
}
