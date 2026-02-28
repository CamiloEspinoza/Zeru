import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageConfigService } from './storage-config.service';
import { StorageConfigController } from './storage-config.controller';

@Module({
  imports: [PrismaModule],
  controllers: [StorageConfigController],
  providers: [StorageConfigService],
  exports: [StorageConfigService],
})
export class StorageConfigModule {}
