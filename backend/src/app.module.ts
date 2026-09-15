import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SecurityModule } from './common/security/security.module';
import { DriversModule } from './drivers/drivers.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    SecurityModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    DriversModule,
    OrdersModule,
    NotificationsModule,
  ],
})
export class AppModule {}
