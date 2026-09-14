import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppErrors } from '../common/errors/app.error';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { OrdersService } from './orders.service';

const parseOrderId = new ParseUUIDPipe({
  exceptionFactory: () => AppErrors.notFound('找不到訂單'),
});

@Controller('driver/orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('open')
  async listOpen(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.ordersService.listOpenForDriver(user);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  async getById(
    @Param('id', parseOrderId) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.ordersService.getForDriver(user, id);
    return {
      success: true,
      data,
    };
  }
}
