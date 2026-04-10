import { Module } from '@nestjs/common';
import { LockService } from './lock.service';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [PresenceModule],
  providers: [LockService],
  exports: [LockService],
})
export class LockModule {}
