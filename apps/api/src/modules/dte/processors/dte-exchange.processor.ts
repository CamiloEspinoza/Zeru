import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, ExchangeStatus } from '@prisma/client';
import { DteConfigService } from '../services/dte-config.service';
import {
  EmailService,
  type EmailAttachment,
} from '../../email/email.service';
import {
  DTE_EXCHANGE_QUEUE,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

interface ExchangeJobData {
  dteId: string;
  tenantId: string;
  recipientEmail: string;
}

/** eventType values stored in DteExchangeEvent for the 3 Ley 19.983 acuses */
const ACUSE_EVENT_TYPES = [
  'RECEPCION_DTE',
  'RESULTADO_DTE',
  'ENVIO_RECIBOS',
] as const;

type AcuseEventType = (typeof ACUSE_EVENT_TYPES)[number];

const ACUSE_FILENAMES: Record<AcuseEventType, string> = {
  RECEPCION_DTE: 'RecepcionDTE.xml',
  RESULTADO_DTE: 'ResultadoDTE.xml',
  ENVIO_RECIBOS: 'EnvioRecibos.xml',
};

@Processor(DTE_EXCHANGE_QUEUE, {
  concurrency: DTE_QUEUE_CONFIG.EXCHANGE.concurrency,
})
export class DteExchangeProcessor extends WorkerHost {
  private readonly logger = new Logger(DteExchangeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: DteConfigService,
    private readonly emailService: EmailService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<ExchangeJobData>): Promise<void> {
    const { dteId, tenantId, recipientEmail } = job.data;
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    this.logger.log(
      `Processing DTE exchange (acuses Ley 19.983): dteId=${dteId}, recipient=${recipientEmail}`,
    );

    // 1. Load DTE metadata for the email body
    const dte = await db.dte.findFirstOrThrow({
      where: { id: dteId },
      select: {
        id: true,
        folio: true,
        dteType: true,
        fechaEmision: true,
      },
    });

    // 2. Load DteConfig (ensures tenant has DTE config)
    await this.configService.get(tenantId);

    // 3. Load the exchange + its 3 signed XMLs (RECEPCION_DTE, RESULTADO_DTE, ENVIO_RECIBOS)
    const exchange = await db.dteExchange.findFirst({
      where: { dteId, tenantId, recipientEmail },
    });

    if (!exchange) {
      throw new Error(
        `DteExchange not found for dteId=${dteId}, recipient=${recipientEmail}`,
      );
    }

    const events = await db.dteExchangeEvent.findMany({
      where: {
        exchangeId: exchange.id,
        eventType: { in: [...ACUSE_EVENT_TYPES] },
      },
      select: { eventType: true, xmlContent: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Keep the most recent XML per eventType (in case of retries)
    const xmlByType = new Map<AcuseEventType, string>();
    for (const ev of events) {
      if (!ev.xmlContent) continue;
      xmlByType.set(ev.eventType as AcuseEventType, ev.xmlContent);
    }

    const attachments: EmailAttachment[] = [];
    for (const type of ACUSE_EVENT_TYPES) {
      const xml = xmlByType.get(type);
      if (!xml) continue;
      attachments.push({
        filename: ACUSE_FILENAMES[type],
        content: xml,
        contentType: 'application/xml',
      });
    }

    if (attachments.length === 0) {
      throw new Error(
        `No signed acuse XMLs found for exchange ${exchange.id} (dteId=${dteId})`,
      );
    }

    // 4. Send email with the 3 XMLs attached via AWS SES (SendRawEmail)
    const fechaStr = dte.fechaEmision.toISOString().slice(0, 10);
    const subject = `Acuses de recibo DTE N° ${dte.folio}`;
    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;line-height:1.5">
  <p>Adjuntamos los acuses de recibo correspondientes al DTE N° ${dte.folio} emitido el ${fechaStr}.</p>
  <p>Estos documentos cumplen con la Ley 19.983 sobre mérito ejecutivo de facturas.</p>
</body>
</html>`.trim();

    try {
      await this.emailService.sendWithAttachments(
        tenantId,
        recipientEmail,
        subject,
        html,
        attachments,
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(
        `Failed to send acuses email for dteId=${dteId}: ${message}`,
      );

      // Persist the failure context as an event; DteExchange has no lastError column.
      await db.dteExchangeEvent.create({
        data: {
          exchangeId: exchange.id,
          eventType: 'SEND_FAILED',
          metadata: { error: message, recipientEmail },
        },
      });

      // Let BullMQ retry; onFailed handler will mark ERROR when attempts exhausted.
      throw err;
    }

    // 5. Update exchange status to SENT
    await db.dteExchange.updateMany({
      where: { dteId, tenantId, recipientEmail },
      data: { status: 'SENT' as ExchangeStatus },
    });

    // 6. Log the successful send event
    await db.dteExchangeEvent.create({
      data: {
        exchangeId: exchange.id,
        eventType: 'ENVIO_DTE',
        metadata: {
          recipientEmail,
          attachments: attachments.map((a) => a.filename),
        },
      },
    });

    // 7. Emit domain event for notification listeners
    this.eventEmitter.emit('dte.exchange.sent', {
      tenantId,
      dteId,
      recipientEmail,
    });

    this.logger.log(
      `DTE exchange complete: dteId=${dteId}, folio=${dte.folio}, recipient=${recipientEmail}, attachments=${attachments.length}`,
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
