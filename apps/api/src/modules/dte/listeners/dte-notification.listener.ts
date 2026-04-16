import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../../notification/notification.service';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('dte.signed')
  async handleSigned(payload: DteEventPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `DTE ${typeName} N.${payload.folio} firmado y listo para descarga`;

    this.logger.log(`Notifying: ${typeName} #${payload.folio} firmada y lista`);

    const recipients = await this.getRecipients(
      payload.tenantId,
      payload.dteId,
    );

    for (const recipientId of recipients) {
      await this.notificationService.notify({
        type: 'dte.signed',
        title,
        body: `Monto total: $${(payload.montoTotal ?? 0).toLocaleString('es-CL')}`,
        data: { dteId: payload.dteId, folio: payload.folio, dteType: payload.dteType },
        groupKey: `dte-signed:${payload.dteId}`,
        recipientId,
        tenantId: payload.tenantId,
      });
    }
  }

  @OnEvent('dte.accepted')
  async handleAccepted(payload: DteEventPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `DTE ${typeName} N.${payload.folio} aceptado por el SII`;

    this.logger.log(`DTE ${payload.dteId} aceptado por SII`);

    const recipients = await this.getRecipients(
      payload.tenantId,
      payload.dteId,
    );

    for (const recipientId of recipients) {
      await this.notificationService.notify({
        type: 'dte.accepted',
        title,
        data: { dteId: payload.dteId, folio: payload.folio, dteType: payload.dteType },
        groupKey: `dte-accepted:${payload.dteId}`,
        recipientId,
        tenantId: payload.tenantId,
      });
    }
  }

  @OnEvent('dte.rejected')
  async handleRejected(payload: DteEventPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `DTE ${typeName} N.${payload.folio} RECHAZADO por el SII — revisar`;

    this.logger.warn(`DTE ${payload.dteId} RECHAZADO por SII`);

    const recipients = await this.getRecipients(
      payload.tenantId,
      payload.dteId,
    );

    for (const recipientId of recipients) {
      await this.notificationService.notify({
        type: 'dte.rejected',
        title,
        body: 'Acción requerida: revise el DTE rechazado y corrija los errores.',
        data: {
          dteId: payload.dteId,
          folio: payload.folio,
          dteType: payload.dteType,
          urgent: true,
        },
        groupKey: `dte-rejected:${payload.dteId}`,
        recipientId,
        tenantId: payload.tenantId,
      });
    }
  }

  @OnEvent('dte.failed')
  async handleFailed(payload: DteEventPayload) {
    const title = `Error en DTE — ${payload.error ?? 'Error desconocido'}`;

    this.logger.error(`DTE ${payload.dteId} ERROR: ${payload.error}`);

    const recipients = await this.getRecipients(
      payload.tenantId,
      payload.dteId,
    );

    for (const recipientId of recipients) {
      await this.notificationService.notify({
        type: 'dte.failed',
        title,
        body: payload.error ?? 'Se produjo un error inesperado al procesar el DTE.',
        data: {
          dteId: payload.dteId,
          folio: payload.folio,
          dteType: payload.dteType,
          error: payload.error,
          urgent: true,
        },
        recipientId,
        tenantId: payload.tenantId,
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────

  private getTypeName(dteType: string): string {
    const siiCode = DTE_TYPE_TO_SII_CODE[dteType] || 0;
    return DTE_TYPE_NAMES[siiCode] || dteType;
  }

  /**
   * Get notification recipients: the DTE creator if available,
   * otherwise all users in the tenant with access to the 'invoicing' module.
   */
  private async getRecipients(
    tenantId: string,
    dteId: string,
  ): Promise<string[]> {
    try {
      const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

      // Try to get the DTE creator first
      const dte = await db.dte.findUnique({
        where: { id: dteId },
        select: { createdById: true },
      });

      if (dte?.createdById) {
        return [dte.createdById];
      }

      // Fallback: find all users with invoicing module access in this tenant
      const usersWithAccess = await db.userTenant.findMany({
        where: {
          tenantId,
          role: {
            moduleAccess: {
              some: {
                moduleKey: 'invoicing',
                accessLevel: { not: 'NONE' },
              },
            },
          },
        },
        select: { userId: true },
      });

      return usersWithAccess.map((u) => u.userId);
    } catch (err) {
      this.logger.error(`Failed to resolve notification recipients: ${err}`);
      return [];
    }
  }
}
