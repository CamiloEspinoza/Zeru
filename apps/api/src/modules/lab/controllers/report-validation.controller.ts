import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  UseGuards,
  Logger,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ReportValidationService } from '../services/report-validation.service';

const triggerSchema = z.object({
  database: z.enum([
    'BIOPSIAS',
    'BIOPSIASRESPALDO',
    'PAPANICOLAOU',
    'PAPANICOLAOUHISTORICO',
  ]),
  informeNumber: z.coerce.number().int().positive(),
});
type TriggerInput = z.infer<typeof triggerSchema>;

@Controller('lab/report-validation')
export class ReportValidationController {
  private readonly logger = new Logger(ReportValidationController.name);
  private readonly tenantId: string;
  private readonly webhookKey: string;

  constructor(
    private readonly service: ReportValidationService,
    config: ConfigService,
  ) {
    this.tenantId = config.get<string>('FM_TENANT_ID') ?? '';
    this.webhookKey = config.get<string>('FM_WEBHOOK_KEY') ?? '';
    if (!this.tenantId || !this.webhookKey) {
      this.logger.warn(
        'FM_TENANT_ID or FM_WEBHOOK_KEY not configured — endpoints will reject all requests',
      );
    }
  }

  @Post('trigger')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async trigger(
    @Headers('x-fm-webhook-key') providedKey: string | undefined,
    @Body(new ZodValidationPipe(triggerSchema)) body: TriggerInput,
    @Headers('x-triggered-by-user-id') triggeredByUserId?: string,
  ) {
    this.assertWebhookKey(providedKey);
    this.logger.log(
      `[Trigger] Enqueue requested: ${body.database} #${body.informeNumber}`,
    );
    const { jobId } = await this.service.enqueueValidation({
      tenantId: this.tenantId,
      database: body.database,
      informeNumber: body.informeNumber,
      triggeredByUserId: triggeredByUserId ?? null,
    });
    return { status: 'enqueued', jobId };
  }

  @Get('can-dispatch/:database/:informeNumber')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 600, ttl: 60000 } })
  async canDispatch(
    @Headers('x-fm-webhook-key') providedKey: string | undefined,
    @Param('database') database: string,
    @Param('informeNumber', ParseIntPipe) informeNumber: number,
  ) {
    this.assertWebhookKey(providedKey);
    return this.service.getCanDispatch(this.tenantId, informeNumber, database);
  }

  private assertWebhookKey(provided: string | undefined): void {
    if (!provided || !this.webhookKey) {
      throw new UnauthorizedException('missing webhook key');
    }
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(this.webhookKey, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      this.logger.warn('Invalid webhook key on report-validation endpoint');
      throw new UnauthorizedException('invalid webhook key');
    }
  }
}
