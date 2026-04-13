import { Global, Module } from '@nestjs/common';
import { BrowserPoolService } from './browser-pool.service';

@Global()
@Module({
  providers: [BrowserPoolService],
  exports: [BrowserPoolService],
})
export class BrowserModule {}
