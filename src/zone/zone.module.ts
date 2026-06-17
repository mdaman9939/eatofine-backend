import { Global, Module } from '@nestjs/common';
import { ZoneService } from './zone.service';

/** Global so the geofence resolver is injectable wherever a location must be
 *  mapped to a zone (config get-zone-id, order placement). */
@Global()
@Module({
  providers: [ZoneService],
  exports: [ZoneService],
})
export class ZoneModule {}
