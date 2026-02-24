import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { S3Service } from './s3.service';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [FilesController],
  providers: [S3Service, FilesService],
  exports: [FilesService, S3Service],
})
export class FilesModule {}
