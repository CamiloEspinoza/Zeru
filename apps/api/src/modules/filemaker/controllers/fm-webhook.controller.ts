import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FmSyncService } from '../services/fm-sync.service';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { fmWebhookSchema, type FmWebhookDto } from '../dto';

@Controller('filemaker/webhook')
export class FmWebhookController {
  private readonly logger = new Logger(FmWebhookController.name);
  private readonly webhookKey: string;
  private readonly tenantId: string;

  constructor(
    private readonly sync: FmSyncService,
    config: ConfigService,
  ) {
    this.webhookKey = config.getOrThrow<string>('FM_WEBHOOK_KEY');
    // Single-tenant: Citolab's tenant ID is configured via env
    this.tenantId = config.getOrThrow<string>('FM_TENANT_ID');
  }

  @Post()
  async handleWebhook(
    @Headers('x-fm-webhook-key') apiKey: string,
    @Body(new ZodValidationPipe(fmWebhookSchema)) body: FmWebhookDto,
  ) {
    if (apiKey !== this.webhookKey) {
      this.logger.warn('Invalid webhook key received');
      throw new UnauthorizedException('Invalid webhook key');
    }

    await this.sync.handleWebhook(this.tenantId, body);
    return { received: true };
  }
}
