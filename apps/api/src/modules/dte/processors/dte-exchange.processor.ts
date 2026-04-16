import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, ExchangeStatus } from '@prisma/client';
import { DteConfigService } from '../services/dte-config.service';
import {
  DTE_EXCHANGE_QUEUE,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

interface ExchangeJobData {
  dteId: string;
  tenantId: string;
  recipientEmail: string;
}

@Processor(DTE_EXCHANGE_QUEUE, {
  concurrency: DTE_QUEUE_CONFIG.EXCHANGE.concurrency,
})
export class DteExchangeProcessor extends WorkerHost {
  private readonly logger = new Logger(DteExchangeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: DteConfigService,
  ) {
    super();
  }

  async process(job: Job<ExchangeJobData>): Promise<void> {
    const { dteId, tenantId, recipientEmail } = job.data;
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    this.logger.log(
      `Processing DTE exchange: dteId=${dteId}, recipient=${recipientEmail}`,
    );

    // 1. Load DTE with XML content
    const dte = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      select: { id: true, folio: true, dteType: true, xmlContent: true },
    });

    if (!dte.xmlContent) {
      throw new Error(`DTE ${dteId} has no XML content for exchange`);
    }

    // 2. Load DteConfig for exchange email settings
    await this.configService.get(tenantId);

    // 3. TODO: Actually send email via SMTP (for now, log)
    this.logger.log(
      `[TODO] Would send DTE ${dteId} (folio ${dte.folio}) XML to ${recipientEmail}`,
    );

    // 4. Update DteExchange record status to SENT
    await db.dteExchange.updateMany({
      where: { dteId, tenantId, recipientEmail },
      data: { status: 'SENT' as ExchangeStatus },
    });

    // 5. Create DteExchangeEvent with eventType 'ENVIO_DTE'
    const exchange = await db.dteExchange.findFirst({
      where: { dteId, tenantId, recipientEmail },
    });

    if (exchange) {
      await db.dteExchangeEvent.create({
        data: {
          exchangeId: exchange.id,
          eventType: 'ENVIO_DTE',
          xmlContent: dte.xmlContent,
        },
      });
    }

    this.logger.log(
      `DTE exchange complete: dteId=${dteId}, recipient=${recipientEmail}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ExchangeJobData>, error: Error) {
    this.logger.error(
      `DTE exchange failed for dteId=${job.data.dteId}: ${error.message}`,
    );

    try {
      if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
        const db = this.prisma.forTenant(
          job.data.tenantId,
        ) as unknown as PrismaClient;

        await db.dteExchange.updateMany({
          where: {
            dteId: job.data.dteId,
            tenantId: job.data.tenantId,
            recipientEmail: job.data.recipientEmail,
          },
          data: { status: 'ERROR' as ExchangeStatus },
        });
      }
    } catch (logError) {
      this.logger.error(`Failed to handle exchange failure: ${logError}`);
    }
  }
}
