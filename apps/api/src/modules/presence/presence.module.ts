import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { PresenceCleanup } from './presence.cleanup';

@Module({
  providers: [PresenceService, PresenceCleanup],
  exports: [PresenceService],
})
export class PresenceModule {}
