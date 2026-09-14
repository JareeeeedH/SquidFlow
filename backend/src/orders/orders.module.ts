import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DriverOrdersController } from './driver-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController, DriverOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
