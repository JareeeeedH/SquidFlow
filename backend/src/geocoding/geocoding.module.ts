import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { GoogleGeocodingClient } from './google-geocoding.client';

@Module({
  providers: [GoogleGeocodingClient, GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
