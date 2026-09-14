import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DriverStatusController } from './driver-status.controller';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [AuthModule],
  controllers: [DriversController, DriverStatusController],
  providers: [DriversService],
})
export class DriversModule {}
