import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { UsersController } from './users.controller';
import { AvatarController } from './avatar.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FilesModule],
  controllers: [UsersController, AvatarController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
