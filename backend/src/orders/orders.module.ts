import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { DriverOrdersController } from './driver-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [
    AdminDashboardController,
    OrdersController,
    DriverOrdersController,
  ],
  providers: [OrdersService],
})
export class OrdersModule {}
