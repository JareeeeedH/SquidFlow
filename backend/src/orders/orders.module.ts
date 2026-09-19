import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { DistanceModule } from '../distance/distance.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { DriverOrdersController } from './driver-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, DispatchModule, GeocodingModule, DistanceModule],
  controllers: [
    AdminDashboardController,
    OrdersController,
    DriverOrdersController,
  ],
  providers: [OrdersService],
})
export class OrdersModule {}
