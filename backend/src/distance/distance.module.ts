import { Module } from '@nestjs/common';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DistanceService } from './distance.service';

@Module({
  imports: [PrismaModule, GeocodingModule],
  providers: [DistanceService],
  exports: [DistanceService],
})
export class DistanceModule {}
