import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    DriversModule,
    OrdersModule,
  ],
})
export class AppModule {}
