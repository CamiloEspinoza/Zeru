import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    { provide: 'NOTIFICATION_SERVICE', useExisting: NotificationService },
  ],
  exports: [NotificationService, 'NOTIFICATION_SERVICE'],
})
export class NotificationModule {}
