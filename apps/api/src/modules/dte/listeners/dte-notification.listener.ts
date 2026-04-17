import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../../notification/notification.service';
import { hasPermission } from '@zeru/shared';
import {
  DTE_TYPE_NAMES,
  DTE_TYPE_TO_SII_CODE,
} from '../constants/dte-types.constants';

const ADMIN_RECIPIENTS_CACHE_TTL_MS = 60_000;

interface DteEventPayload {
  tenantId: string;
  dteId: string;
  folio: number;
  dteType: string;
  montoTotal?: number;
  status?: string;
  error?: string;
}

interface CertificateEventPayload {
  tenantId: string;
  certificateId: string;
  subjectName: string;
  subjectRut: string;
  validUntil: Date;
  daysRemaining?: number;
}

interface FolioLowStockPayload {
  tenantId: string;
  dteType: string;
  remaining: number;
  folioRangeId: string;
}

interface FolioExhaustedPayload {
  tenantId: string;
  dteType: string;
  folioRangeId: string;
}

interface RcofGeneratedPayload {
  tenantId: string;
  date: string;
  boletaCount: number;
}

interface ReceivedTacitAcceptancePayload {
  tenantId: string;
  dteId: string;
  folio: number;
}

interface ReceivedDeadlineApproachingPayload {
  tenantId: string;
  dteId: string;
  folio: number;
  emisorRut: string;
  emisorRazon: string;
  deadlineDate: Date;
  dteType: string;
}

interface ReceivedRejectedPayload {
  tenantId: string;
  dteId: string;
  reason: string;
}

interface XmlReceivedPayload {
  tenantId: string;
  xmlContent: string;
  fromEmail: string;
  subject: string;
  receivedAt: Date;
  messageUid: number;
}

interface ExchangeSentPayload {
  tenantId: string;
  dteId: string;
  recipientEmail: string;
}

@Injectable()
export class DteNotificationListener {
  private readonly logger = new Logger(DteNotificationListener.name);
  private readonly adminRecipientsCache = new Map<
    string,
    { userIds: string[]; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('dte.signed')
  async handleSigned(payload: DteEventPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `DTE ${typeName} N.${payload.folio} firmado y listo para descarga`;
    await this.notifyDteRecipients({
      tenantId: payload.tenantId,
      dteId: payload.dteId,
      type: 'dte.signed',
      title,
      body: `Monto total: $${(payload.montoTotal ?? 0).toLocaleString('es-CL')}`,
      data: { dteId: payload.dteId, folio: payload.folio, dteType: payload.dteType },
      groupKey: `dte-signed:${payload.dteId}`,
    });
  }

  @OnEvent('dte.accepted')
  async handleAccepted(payload: DteEventPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `DTE ${typeName} N.${payload.folio} aceptado por el SII`;
    await this.notifyDteRecipients({
      tenantId: payload.tenantId,
      dteId: payload.dteId,
      type: 'dte.accepted',
      title,
      data: { dteId: payload.dteId, folio: payload.folio, dteType: payload.dteType },
      groupKey: `dte-accepted:${payload.dteId}`,
    });
  }

  @OnEvent('dte.accepted_with_objection')
  async handleAcceptedWithObjection(payload: DteEventPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `DTE ${typeName} N.${payload.folio} aceptado con reparos`;
    await this.notifyDteRecipients({
      tenantId: payload.tenantId,
      dteId: payload.dteId,
      type: 'dte.accepted_with_objection',
      title,
      body: 'El SII aceptó el DTE con reparos. Revise las observaciones.',
      data: {
        dteId: payload.dteId,
        folio: payload.folio,
        dteType: payload.dteType,
        warning: true,
      },
      groupKey: `dte-accepted-objection:${payload.dteId}`,
    });
  }

  @OnEvent('dte.rejected')
  async handleRejected(payload: DteEventPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `DTE ${typeName} N.${payload.folio} RECHAZADO por el SII — revisar`;
    await this.notifyDteRecipients({
      tenantId: payload.tenantId,
      dteId: payload.dteId,
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
    });
  }

  @OnEvent('dte.failed')
  async handleFailed(payload: DteEventPayload) {
    const title = `Error en DTE — ${payload.error ?? 'Error desconocido'}`;
    await this.notifyDteRecipients({
      tenantId: payload.tenantId,
      dteId: payload.dteId,
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
    });
  }

  // ─── Certificado ─────────────────────────────────────────

  @OnEvent('dte.certificate.expired')
  async handleCertificateExpired(payload: CertificateEventPayload) {
    const title = `Certificado digital VENCIDO — no puede emitir DTEs`;
    const body = `El certificado de ${payload.subjectName} (${payload.subjectRut}) venció el ${payload.validUntil.toISOString().slice(0, 10)}. Renuévelo en el SII para continuar emitiendo.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.certificate.expired',
      title,
      body,
      data: { certificateId: payload.certificateId, urgent: true },
      groupKey: `dte-cert-expired:${payload.certificateId}`,
    });
  }

  @OnEvent('dte.certificate.expiring-critical')
  async handleCertificateExpiringCritical(payload: CertificateEventPayload) {
    const title = `Certificado digital vence en ${payload.daysRemaining} días — acción URGENTE`;
    const body = `El certificado de ${payload.subjectName} (${payload.subjectRut}) vence el ${payload.validUntil.toISOString().slice(0, 10)}. Renueve inmediatamente para evitar interrupción del servicio.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.certificate.expiring-critical',
      title,
      body,
      data: {
        certificateId: payload.certificateId,
        daysRemaining: payload.daysRemaining,
        urgent: true,
      },
      groupKey: `dte-cert-critical:${payload.certificateId}`,
    });
  }

  @OnEvent('dte.certificate.expiring-soon')
  async handleCertificateExpiringSoon(payload: CertificateEventPayload) {
    const title = `Certificado digital vence en ${payload.daysRemaining} días`;
    const body = `El certificado de ${payload.subjectName} (${payload.subjectRut}) vence el ${payload.validUntil.toISOString().slice(0, 10)}. Planifique la renovación.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.certificate.expiring-soon',
      title,
      body,
      data: {
        certificateId: payload.certificateId,
        daysRemaining: payload.daysRemaining,
      },
      groupKey: `dte-cert-soon:${payload.certificateId}`,
    });
  }

  // ─── Folio ───────────────────────────────────────────────

  @OnEvent('dte.folio.low_stock')
  async handleFolioLowStock(payload: FolioLowStockPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `Folios bajos: ${payload.remaining} restantes para ${typeName}`;
    const body = `Solicite un nuevo CAF en el SII antes de agotar los folios disponibles.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.folio.low_stock',
      title,
      body,
      data: {
        dteType: payload.dteType,
        remaining: payload.remaining,
        folioRangeId: payload.folioRangeId,
      },
      groupKey: `dte-folio-low:${payload.folioRangeId}`,
    });
  }

  @OnEvent('dte.folio.exhausted')
  async handleFolioExhausted(payload: FolioExhaustedPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const title = `Folios AGOTADOS para ${typeName} — emisión bloqueada`;
    const body = `No se pueden emitir más DTEs de tipo ${typeName}. Cargue un nuevo CAF desde el SII de inmediato.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.folio.exhausted',
      title,
      body,
      data: {
        dteType: payload.dteType,
        folioRangeId: payload.folioRangeId,
        urgent: true,
      },
      groupKey: `dte-folio-exhausted:${payload.folioRangeId}`,
    });
  }

  // ─── RCOF / compliance ───────────────────────────────────

  @OnEvent('dte.rcof.generated')
  async handleRcofGenerated(payload: RcofGeneratedPayload) {
    const title = `RCOF generado para ${payload.date}`;
    const body = `Se generó el reporte consolidado de boletas (${payload.boletaCount} boletas) y se envió al SII.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.rcof.generated',
      title,
      body,
      data: { date: payload.date, boletaCount: payload.boletaCount },
      groupKey: `dte-rcof:${payload.date}`,
    });
  }

  // ─── DTE recibidos ───────────────────────────────────────

  @OnEvent('dte.received.tacit-acceptance')
  async handleReceivedTacitAcceptance(payload: ReceivedTacitAcceptancePayload) {
    const title = `DTE recibido aceptado tácitamente (folio ${payload.folio})`;
    const body = `El plazo de 8 días para reclamar venció. El DTE quedó aceptado automáticamente por ley.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.received.tacit-acceptance',
      title,
      body,
      data: { dteId: payload.dteId, folio: payload.folio },
      groupKey: `dte-tacit:${payload.dteId}`,
    });
  }

  @OnEvent('dte.received.deadline-approaching')
  async handleReceivedDeadlineApproaching(payload: ReceivedDeadlineApproachingPayload) {
    const typeName = this.getTypeName(payload.dteType);
    const deadline = payload.deadlineDate.toISOString().slice(0, 10);
    const title = `Plazo para reclamar ${typeName} N.${payload.folio} vence el ${deadline}`;
    const body = `Emisor: ${payload.emisorRazon} (${payload.emisorRut}). Después del plazo, el DTE queda aceptado tácitamente.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.received.deadline-approaching',
      title,
      body,
      data: {
        dteId: payload.dteId,
        folio: payload.folio,
        deadlineDate: payload.deadlineDate,
        emisorRut: payload.emisorRut,
        urgent: true,
      },
      groupKey: `dte-deadline:${payload.dteId}`,
    });
  }

  @OnEvent('dte.received.rejected')
  async handleReceivedRejected(payload: ReceivedRejectedPayload) {
    const title = `DTE recibido rechazado — notificación al emisor enviada`;
    const body = `Motivo: ${payload.reason}`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.received.rejected',
      title,
      body,
      data: { dteId: payload.dteId, reason: payload.reason },
      groupKey: `dte-received-rejected:${payload.dteId}`,
    });
  }

  @OnEvent('dte.xml-received')
  async handleXmlReceived(payload: XmlReceivedPayload) {
    const title = `Nuevo DTE recibido por correo`;
    const body = `De: ${payload.fromEmail}. Asunto: ${payload.subject}. Revise la bandeja de recibidos.`;
    await this.notifyAdmins({
      tenantId: payload.tenantId,
      type: 'dte.xml-received',
      title,
      body,
      data: {
        fromEmail: payload.fromEmail,
        subject: payload.subject,
        messageUid: payload.messageUid,
      },
      groupKey: `dte-xml:${payload.messageUid}`,
    });
  }

  @OnEvent('dte.exchange.sent')
  async handleExchangeSent(payload: ExchangeSentPayload) {
    const title = `Acuses de recibo enviados al emisor`;
    const body = `Los 3 XMLs firmados (RecepcionDTE, ResultadoDTE, EnvioRecibos) se enviaron a ${payload.recipientEmail} conforme a la Ley 19.983.`;
    await this.notifyDteRecipients({
      tenantId: payload.tenantId,
      dteId: payload.dteId,
      type: 'dte.exchange.sent',
      title,
      body,
      data: {
        dteId: payload.dteId,
        recipientEmail: payload.recipientEmail,
      },
      groupKey: `dte-exchange-sent:${payload.dteId}`,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────

  private getTypeName(dteType: string): string {
    const siiCode = DTE_TYPE_TO_SII_CODE[dteType] || 0;
    return DTE_TYPE_NAMES[siiCode] || dteType;
  }

  private async notifyDteRecipients(params: {
    tenantId: string;
    dteId: string;
    type: string;
    title: string;
    body?: string;
    data: Record<string, unknown>;
    groupKey?: string;
  }) {
    const recipients = await this.getDteRecipients(params.tenantId, params.dteId);
    await this.dispatchTo(recipients, params);
  }

  private async notifyAdmins(params: {
    tenantId: string;
    type: string;
    title: string;
    body?: string;
    data: Record<string, unknown>;
    groupKey?: string;
  }) {
    const recipients = await this.getAdminRecipients(params.tenantId);
    await this.dispatchTo(recipients, params);
  }

  private async dispatchTo(
    recipientIds: string[],
    params: {
      tenantId: string;
      type: string;
      title: string;
      body?: string;
      data: Record<string, unknown>;
      groupKey?: string;
    },
  ) {
    for (const recipientId of recipientIds) {
      try {
        await this.notificationService.notify({
          type: params.type,
          title: params.title,
          body: params.body,
          data: params.data,
          groupKey: params.groupKey,
          recipientId,
          tenantId: params.tenantId,
        });
      } catch (err) {
        this.logger.error(
          `Failed to notify recipient ${recipientId} for ${params.type}: ${err}`,
        );
      }
    }
  }

  private async getDteRecipients(
    tenantId: string,
    dteId: string,
  ): Promise<string[]> {
    try {
      const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
      const dte = await db.dte.findUnique({
        where: { id: dteId },
        select: { createdById: true },
      });
      if (dte?.createdById) return [dte.createdById];
      return this.getAdminRecipients(tenantId);
    } catch (err) {
      this.logger.error(`Failed to resolve DTE recipients: ${err}`);
      return [];
    }
  }

  private async getAdminRecipients(tenantId: string): Promise<string[]> {
    const cached = this.adminRecipientsCache.get(tenantId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.userIds;
    }

    try {
      const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

      // Load active members with their role + moduleAccess + overrides, then
      // filter in-memory using the shared hasPermission helper. This mirrors
      // the PermissionGuard resolution logic (see permission.guard.ts).
      const members = await (db as any).userTenant.findMany({
        where: { tenantId, isActive: true },
        include: {
          roleRef: {
            include: {
              moduleAccess: true,
              overrides: true,
            },
          },
        },
      });

      const allowed: string[] = [];
      const owners: string[] = [];

      for (const m of members) {
        if (m.roleRef?.slug === 'owner') owners.push(m.userId);

        const role = m.roleRef;
        if (!role) continue;

        const moduleAccess = (role.moduleAccess ?? []).map((a: any) => ({
          moduleKey: a.moduleKey,
          accessLevel: a.accessLevel,
        }));
        const overrides = (role.overrides ?? []).map((o: any) => ({
          permission: o.permission,
          granted: o.granted,
        }));

        if (hasPermission(moduleAccess, overrides, 'invoicing', 'manage-config')) {
          allowed.push(m.userId);
        }
      }

      // Fallback: if nobody has manage-config, notify OWNERs of the tenant.
      const userIds = allowed.length > 0 ? allowed : owners;

      this.adminRecipientsCache.set(tenantId, {
        userIds,
        expiresAt: now + ADMIN_RECIPIENTS_CACHE_TTL_MS,
      });

      return userIds;
    } catch (err) {
      this.logger.error(`Failed to resolve admin recipients: ${err}`);
      return [];
    }
  }
}
