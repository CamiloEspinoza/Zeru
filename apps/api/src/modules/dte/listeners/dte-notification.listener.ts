import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import {
  DTE_TYPE_NAMES,
  DTE_TYPE_TO_SII_CODE,
} from '../constants/dte-types.constants';

interface DteEventPayload {
  tenantId: string;
  dteId: string;
  folio: number;
  dteType: string;
  montoTotal?: number;
  status?: string;
  error?: string;
}

@Injectable()
export class DteNotificationListener {
  private readonly logger = new Logger(DteNotificationListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('dte.signed')
  async handleSigned(payload: DteEventPayload) {
    const db = this.prisma.forTenant(
      payload.tenantId,
    ) as unknown as PrismaClient;
    const dte = await db.dte.findUnique({
      where: { id: payload.dteId },
      select: { createdById: true },
    });
    if (!dte?.createdById) return;

    const siiCode = DTE_TYPE_TO_SII_CODE[payload.dteType] || 0;
    const typeName = DTE_TYPE_NAMES[siiCode] || payload.dteType;

    this.logger.log(`Notifying: ${typeName} #${payload.folio} firmada y lista`);
    // TODO: Create notification via NotificationService when available
    // For now, just log — the WebSocket notification will be added when we integrate with NotificationModule
  }

  @OnEvent('dte.accepted')
  async handleAccepted(payload: DteEventPayload) {
    this.logger.log(`DTE ${payload.dteId} aceptado por SII`);
  }

  @OnEvent('dte.rejected')
  async handleRejected(payload: DteEventPayload) {
    this.logger.warn(`DTE ${payload.dteId} RECHAZADO por SII`);
    // TODO: Create urgent notification + email alert
  }

  @OnEvent('dte.failed')
  async handleFailed(payload: DteEventPayload) {
    this.logger.error(`DTE ${payload.dteId} ERROR: ${payload.error}`);
    // TODO: Create error notification
  }
}
