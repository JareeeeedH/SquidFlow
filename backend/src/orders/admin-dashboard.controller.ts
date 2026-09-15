import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrdersService } from './orders.service';

@Controller('admin/dashboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDashboardController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getDashboard() {
    const data = await this.ordersService.getDashboard();
    return {
      success: true,
      data,
    };
  }
}
