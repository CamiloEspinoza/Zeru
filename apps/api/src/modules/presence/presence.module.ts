import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PresenceService } from './presence.service';
import { PresenceCleanup } from './presence.cleanup';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => RealtimeModule),
  ],
  providers: [PresenceService, PresenceCleanup],
  exports: [PresenceService],
})
export class PresenceModule {}
