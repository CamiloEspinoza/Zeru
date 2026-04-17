import { Module } from '@nestjs/common';
import { QueueAdminController } from './queue-admin.controller';
import { QueueAdminService } from './queue-admin.service';

@Module({
  controllers: [QueueAdminController],
  providers: [QueueAdminService],
})
export class QueueAdminModule {}
