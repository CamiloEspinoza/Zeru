import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';

@Module({
  imports: [PrismaModule],
  providers: [ApiKeysService],
  controllers: [ApiKeysController],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
