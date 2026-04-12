import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { StorageConfigModule } from '../storage-config/storage-config.module';
import { UsersController } from './users.controller';
import { AvatarController } from './avatar.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FilesModule, StorageConfigModule],
  controllers: [UsersController, AvatarController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
