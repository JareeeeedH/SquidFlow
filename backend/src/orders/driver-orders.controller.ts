import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppErrors } from '../common/errors/app.error';
import { RateLimited } from '../common/security/rate-limit.decorator';
import { RateLimitGuard } from '../common/security/rate-limit.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { parseUpdateDriverLocationBody } from '../drivers/drivers.validation';
import { OrdersService } from './orders.service';
import {
  parseCompleteBody,
  parseDriverMyOrdersQuery,
} from './orders.validation';

const parseOrderId = new ParseUUIDPipe({
  exceptionFactory: () => AppErrors.notFound('找不到訂單'),
});

@Controller('driver/orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
  ) {
    const data = await this.ordersService.listMine(
      user,
      parseDriverMyOrdersQuery(query),
    );
    return {
      success: true,
      data,
    };
  }

  @Get('open')
  async listOpen(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.ordersService.listOpenForDriver(user);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimited('accept')
  async accept(
    @Param('id', parseOrderId) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.ordersService.accept(id, user);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async start(
    @Param('id', parseOrderId) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.ordersService.start(id, user);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/arrive')
  @HttpCode(HttpStatus.OK)
  async arrive(
    @Param('id', parseOrderId) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const coords = parseUpdateDriverLocationBody(body);
    const data = await this.ordersService.arrive(id, user, coords);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('id', parseOrderId) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = parseCompleteBody(body);
    const data = await this.ordersService.complete(id, user, input);
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
