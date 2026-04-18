import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
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

type TriggerDto = z.infer<typeof triggerSchema>;

@Controller('lab/report-validation')
export class ReportValidationController {
  private readonly logger = new Logger(ReportValidationController.name);
  private readonly webhookKey: string;

  constructor(
    private readonly validationService: ReportValidationService,
    config: ConfigService,
  ) {
    this.webhookKey = config.getOrThrow<string>('FM_WEBHOOK_KEY');
  }

  /**
   * Endpoint called by FileMaker when a report is validated.
   * Responds immediately with { status: "received" },
   * then processes the validation asynchronously.
   */
  @Post('trigger')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async trigger(
    @Headers('x-fm-webhook-key') apiKey: string,
    @Body(new ZodValidationPipe(triggerSchema)) body: TriggerDto,
  ) {
    // Authenticate via API key (same mechanism as FM webhook)
    const keyBuffer = Buffer.from(apiKey ?? '');
    const expectedBuffer = Buffer.from(this.webhookKey);
    if (
      keyBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(keyBuffer, expectedBuffer)
    ) {
      this.logger.warn('Invalid webhook key on validation trigger');
      throw new UnauthorizedException('Invalid webhook key');
    }

    this.logger.log(
      `[Trigger] Report validation requested: ${body.database} #${body.informeNumber}`,
    );

    // Fire and forget — process in background
    this.validationService
      .processValidation({
        database: body.database,
        informeNumber: body.informeNumber,
      })
      .catch((err) => {
        this.logger.error(
          `[Trigger] Background processing failed: ${err instanceof Error ? err.message : err}`,
        );
      });

    return {
      status: 'received',
      database: body.database,
      informeNumber: body.informeNumber,
    };
  }
}
