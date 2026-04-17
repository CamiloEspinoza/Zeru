import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import {
  DTE_EXCHANGE_QUEUE,
  DTE_JOB_NAMES,
} from '../constants/queue.constants';

interface DteSignedPayload {
  tenantId: string;
  dteId: string;
  folio: number;
  dteType: string;
}

@Injectable()
export class DteExchangeListener {
  private readonly logger = new Logger(DteExchangeListener.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DTE_EXCHANGE_QUEUE)
    private readonly exchangeQueue: Queue,
  ) {}

  @OnEvent('dte.signed')
  async handleSigned(payload: DteSignedPayload) {
    // Skip boletas — they don't require exchange
    const boletaTypes = [
      'BOLETA_ELECTRONICA',
      'BOLETA_EXENTA_ELECTRONICA',
    ];
    if (boletaTypes.includes(payload.dteType)) return;

    this.logger.log(
      `DTE ${payload.dteId} signed — checking exchange email for receptor`,
    );

    try {
      const db = this.prisma.forTenant(
        payload.tenantId,
      ) as unknown as PrismaClient;

      // Load the DTE to get the receptor info and legalEntityId
      const dte = await db.dte.findUnique({
        where: { id: payload.dteId },
        select: {
          id: true,
          xmlContent: true,
          receptorRut: true,
          legalEntityId: true,
        },
      });

      if (!dte?.xmlContent) {
        this.logger.warn(
          `DTE ${payload.dteId} has no XML content, skipping exchange`,
        );
        return;
      }

      // Look up the receptor's exchange email from LegalEntity
      let recipientEmail: string | null = null;

      if (dte.legalEntityId) {
        const legalEntity = await db.legalEntity.findUnique({
          where: { id: dte.legalEntityId },
          select: { dteExchangeEmail: true },
        });
        recipientEmail = legalEntity?.dteExchangeEmail ?? null;
      }

      // If no legalEntity link, try finding by RUT
      if (!recipientEmail && dte.receptorRut) {
        const legalEntity = await db.legalEntity.findFirst({
          where: { rut: dte.receptorRut, tenantId: payload.tenantId },
          select: { dteExchangeEmail: true },
        });
        recipientEmail = legalEntity?.dteExchangeEmail ?? null;
      }

      if (!recipientEmail) {
        this.logger.log(
          `No exchange email found for DTE ${payload.dteId} receptor, skipping exchange`,
        );
        return;
      }

      // Create DteExchange record with PENDING_SEND status
      // The 8-day deadline is the standard SII exchange period
      const deadlineAt = new Date();
      deadlineAt.setDate(deadlineAt.getDate() + 8);

      await db.dteExchange.create({
        data: {
          dteId: dte.id,
          tenantId: payload.tenantId,
          recipientEmail,
          status: 'PENDING_SEND',
          deadlineAt,
        },
      });

      // Queue the exchange email job
      await this.exchangeQueue.add(
        DTE_JOB_NAMES.SEND_TO_RECEPTOR,
        {
          dteId: dte.id,
          tenantId: payload.tenantId,
          recipientEmail,
        },
        {
          jobId: `exchange-${dte.id}`,
        },
      );

      this.logger.log(
        `Exchange queued for DTE ${payload.dteId} → ${recipientEmail}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to queue exchange for DTE ${payload.dteId}: ${err}`,
      );
    }
  }
}
