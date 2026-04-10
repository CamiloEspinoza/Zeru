import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FileMakerModule } from '../filemaker/filemaker.module';

@Module({
  imports: [PrismaModule, FileMakerModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class LabModule {}
