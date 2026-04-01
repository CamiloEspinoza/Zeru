import { Module, forwardRef } from '@nestjs/common';
import { LockService } from './lock.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [forwardRef(() => RealtimeModule), forwardRef(() => PresenceModule)],
  providers: [LockService],
  exports: [LockService],
})
export class LockModule {}
