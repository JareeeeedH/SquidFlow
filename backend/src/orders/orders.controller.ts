import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
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
import { parseOrderBody, parseOrderListQuery } from './orders.validation';

const parseOrderId = new ParseUUIDPipe({
  exceptionFactory: () => AppErrors.notFound('找不到訂單'),
});

@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async list(@Query() query: Record<string, unknown>) {
    const data = await this.ordersService.list(parseOrderListQuery(query));
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = await this.ordersService.create(user, parseOrderBody(body));
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  async getById(@Param('id', parseOrderId) id: string) {
    const data = await this.ordersService.getById(id);
    return {
      success: true,
      data,
    };
  }

  @Put(':id')
  async update(@Param('id', parseOrderId) id: string, @Body() body: unknown) {
    const data = await this.ordersService.update(id, parseOrderBody(body));
    return {
      success: true,
      data,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', parseOrderId) id: string) {
    await this.ordersService.remove(id);
    return {
      success: true,
      data: null,
    };
  }
}
