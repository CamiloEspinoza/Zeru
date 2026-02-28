import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageConfigModule } from '../storage-config/storage-config.module';
import { S3Service } from './s3.service';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [PrismaModule, StorageConfigModule],
  controllers: [FilesController],
  providers: [S3Service, FilesService],
  exports: [FilesService, S3Service],
})
export class FilesModule {}
