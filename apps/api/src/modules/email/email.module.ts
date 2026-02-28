import { Module, Global } from '@nestjs/common';
import { EmailConfigModule } from '../email-config/email-config.module';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [EmailConfigModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
