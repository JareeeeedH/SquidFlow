import { Module } from '@nestjs/common';
import { DistanceModule } from '../distance/distance.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  DEFAULT_WAVE_DISPATCH_OPTIONS,
  WAVE_DISPATCH_OPTIONS,
} from './wave-dispatch.constants';
import { WaveDispatchService } from './wave-dispatch.service';

@Module({
  imports: [PrismaModule, GeocodingModule, DistanceModule, NotificationsModule],
  providers: [
    {
      provide: WAVE_DISPATCH_OPTIONS,
      useValue: DEFAULT_WAVE_DISPATCH_OPTIONS,
    },
    WaveDispatchService,
  ],
  exports: [WaveDispatchService, WAVE_DISPATCH_OPTIONS],
})
export class DispatchModule {}
