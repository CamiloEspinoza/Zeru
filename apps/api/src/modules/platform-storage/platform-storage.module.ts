import { Module } from '@nestjs/common';
import { PlatformStorageService } from './platform-storage.service';

@Module({
  providers: [PlatformStorageService],
  exports: [PlatformStorageService],
})
export class PlatformStorageModule {}
