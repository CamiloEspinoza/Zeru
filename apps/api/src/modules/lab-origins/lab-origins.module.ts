import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LabOriginsService } from './lab-origins.service';
import { LabOriginsController } from './lab-origins.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LabOriginsController],
  providers: [LabOriginsService],
  exports: [LabOriginsService],
})
export class LabOriginsModule {}
