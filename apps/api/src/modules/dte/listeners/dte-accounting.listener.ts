import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { JournalEntriesService } from '../../accounting/services/journal-entries.service';
import { FiscalPeriodsService } from '../../accounting/services/fiscal-periods.service';
import { DteAccountMappingService } from '../services/dte-account-mapping.service';
import {
  DTE_TYPE_CODES,
  DTE_TYPE_NAMES,
} from '../constants/dte-types.constants';

interface DteSignedPayload {
  tenantId: string;
  dteId: string;
  folio: number;
  dteType: string;
  montoTotal?: number;
}

interface DteReceivedAcceptedPayload {
  tenantId: string;
  dteId: string;
}

interface DteRejectedPayload {
  tenantId: string;
  dteId: string;
  folio?: number;
  dteType?: string;
  status?: string;
}

/** Map from DteType enum name to SII numeric code. */
const TYPE_TO_CODE: Record<string, number> = Object.fromEntries(
  Object.entries(DTE_TYPE_CODES).map(([k, v]) => [k, v]),
);

@Injectable()
export class DteAccountingListener {
  private readonly logger = new Logger(DteAccountingListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journalEntries: JournalEntriesService,
    private readonly fiscalPeriods: FiscalPeriodsService,
    private readonly mappingService: DteAccountMappingService,
  ) {}

  // ─── Emitted DTEs ──────────────────────────────────────────────
  @OnEvent('dte.signed')
  async handleSigned(payload: DteSignedPayload) {
    try {
      await this.createJournalEntryForEmitted(payload);
    } catch (error) {
      this.logger.error(
        `Failed to create journal entry for emitted DTE ${payload.dteId}: ${error}`,
      );
    }
  }

  // ─── Received DTEs (accepted by user) ──────────────────────────
  @OnEvent('dte.received.accepted')
  async handleReceivedAccepted(payload: DteReceivedAcceptedPayload) {
    try {
      await this.createJournalEntryForReceived(payload);
    } catch (error) {
      this.logger.error(
        `Failed to create journal entry for received DTE ${payload.dteId}: ${error}`,
      );
    }
  }

  // ─── Rejected DTEs ────────────────────────────────────────────
  @OnEvent('dte.rejected')
  async handleRejected(payload: DteRejectedPayload) {
    try {
      await this.reverseJournalEntry(payload.tenantId, payload.dteId);
    } catch (error) {
      this.logger.error(
        `Failed to reverse journal entry for rejected DTE ${payload.dteId}: ${error}`,
      );
    }
  }

  // ─── Private ────────────────────────────────────────────────────

  private async createJournalEntryForEmitted(payload: DteSignedPayload) {
    const { tenantId, dteId } = payload;
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Idempotency guard: skip if a journal entry already exists for this DTE
    const existing = await db.dte.findUnique({
      where: { id: dteId },
      select: { journalEntryId: true },
    });
    if (existing?.journalEntryId) {
      this.logger.log(
        `DTE ${dteId} already has journalEntry ${existing.journalEntryId}, skipping`,
      );
      return;
    }

    const config = await db.dteConfig.findFirst({ where: {} });
    if (!config?.autoCreateJournalEntry) {
      this.logger.debug(
        `Auto journal entry disabled for tenant ${tenantId}, skipping`,
      );
      return;
    }

    const dte = await db.dte.findFirst({
      where: { id: dteId },
    });
    if (!dte) {
      this.logger.warn(`DTE ${dteId} not found for tenant ${tenantId}`);
      return;
    }

    // Only process emitted DTEs here
    if (dte.direction !== 'EMITTED') return;

    const dteTypeCode = TYPE_TO_CODE[dte.dteType];
    if (!dteTypeCode) {
      this.logger.warn(`Unknown DTE type: ${dte.dteType}`);
      return;
    }

    const mapping = await this.mappingService.getMapping(
      tenantId,
      dteTypeCode,
      'EMITTED',
    );
    if (!mapping) {
      this.logger.log(
        `No account mapping for emitted type ${dteTypeCode} in tenant ${tenantId}, skipping journal entry`,
      );
      return;
    }

    const fiscalPeriod = await this.findOpenFiscalPeriod(
      tenantId,
      dte.fechaEmision,
    );
    if (!fiscalPeriod) {
      this.logger.warn(
        `No open fiscal period found for DTE ${dteId} date ${dte.fechaEmision.toISOString()}`,
      );
      return;
    }

    const lines = this.buildEmittedLines(dte, mapping, dteTypeCode);
    if (lines.length < 2) {
      this.logger.warn(
        `Not enough account mappings configured for DTE type ${dteTypeCode} (EMITTED) in tenant ${tenantId}`,
      );
      return;
    }

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) >= 1) {
      this.logger.error(
        `Asiento desbalanceado para DTE ${dteId}: débito=${totalDebit}, crédito=${totalCredit}`,
      );
      return;
    }

    const typeName = DTE_TYPE_NAMES[dteTypeCode] ?? `Tipo ${dteTypeCode}`;
    const description = `${typeName} N.${dte.folio} - ${dte.receptorRazon ?? dte.receptorRut ?? 'S/N'}`;

    const entry = await this.journalEntries.create(tenantId, {
      date: dte.fechaEmision.toISOString().split('T')[0],
      description,
      fiscalPeriodId: fiscalPeriod.id,
      lines,
    });

    // Link the journal entry to the DTE
    await db.dte.update({
      where: { id: dteId },
      data: { journalEntryId: entry.id },
    });

    this.logger.log(
      `Created DRAFT journal entry #${entry.number} for emitted DTE ${dteId} (${typeName} N.${dte.folio})`,
    );
  }

  private async createJournalEntryForReceived(
    payload: DteReceivedAcceptedPayload,
  ) {
    const { tenantId, dteId } = payload;
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Idempotency guard: skip if a journal entry already exists for this DTE
    const existing = await db.dte.findUnique({
      where: { id: dteId },
      select: { journalEntryId: true },
    });
    if (existing?.journalEntryId) {
      this.logger.log(
        `DTE ${dteId} already has journalEntry ${existing.journalEntryId}, skipping`,
      );
      return;
    }

    const config = await db.dteConfig.findFirst({ where: {} });
    if (!config?.autoCreateJournalEntry) {
      this.logger.debug(
        `Auto journal entry disabled for tenant ${tenantId}, skipping`,
      );
      return;
    }

    const dte = await db.dte.findFirst({
      where: { id: dteId },
    });
    if (!dte) {
      this.logger.warn(`DTE ${dteId} not found for tenant ${tenantId}`);
      return;
    }

    if (dte.direction !== 'RECEIVED') return;

    const dteTypeCode = TYPE_TO_CODE[dte.dteType];
    if (!dteTypeCode) {
      this.logger.warn(`Unknown DTE type: ${dte.dteType}`);
      return;
    }

    const mapping = await this.mappingService.getMapping(
      tenantId,
      dteTypeCode,
      'RECEIVED',
    );
    if (!mapping) {
      this.logger.log(
        `No account mapping for received type ${dteTypeCode} in tenant ${tenantId}, skipping journal entry`,
      );
      return;
    }

    const fiscalPeriod = await this.findOpenFiscalPeriod(
      tenantId,
      dte.fechaEmision,
    );
    if (!fiscalPeriod) {
      this.logger.warn(
        `No open fiscal period found for received DTE ${dteId} date ${dte.fechaEmision.toISOString()}`,
      );
      return;
    }

    const lines = this.buildReceivedLines(dte, mapping, dteTypeCode);
    if (lines.length < 2) {
      this.logger.warn(
        `Not enough account mappings configured for DTE type ${dteTypeCode} (RECEIVED) in tenant ${tenantId}`,
      );
      return;
    }

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) >= 1) {
      this.logger.error(
        `Asiento desbalanceado para DTE ${dteId}: débito=${totalDebit}, crédito=${totalCredit}`,
      );
      return;
    }

    const typeName = DTE_TYPE_NAMES[dteTypeCode] ?? `Tipo ${dteTypeCode}`;
    const description = `${typeName} N.${dte.folio} recibida - ${dte.emisorRazon ?? dte.emisorRut}`;

    const entry = await this.journalEntries.create(tenantId, {
      date: dte.fechaEmision.toISOString().split('T')[0],
      description,
      fiscalPeriodId: fiscalPeriod.id,
      lines,
    });

    await db.dte.update({
      where: { id: dteId },
      data: { journalEntryId: entry.id },
    });

    this.logger.log(
      `Created DRAFT journal entry #${entry.number} for received DTE ${dteId} (${typeName} N.${dte.folio})`,
    );
  }

  private async reverseJournalEntry(tenantId: string, dteId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const dte = await db.dte.findFirst({
      where: { id: dteId },
      include: {
        journalEntry: { include: { lines: true } },
      },
    });

    if (!dte?.journalEntry) {
      this.logger.log(
        `No journal entry linked to rejected DTE ${dteId}, nothing to reverse`,
      );
      return;
    }

    const original = dte.journalEntry;
    if (original.status === 'VOIDED') {
      this.logger.log(
        `Journal entry #${original.number} already voided for DTE ${dteId}`,
      );
      return;
    }

    // Idempotency guard for reversal: check if a reversal entry already exists.
    // TODO: Add `reversalOfId String?` (self-relation) to JournalEntry model
    // for a proper link. For now we fall back to matching on description.
    const reversalDescription = `Reverso por rechazo - ${original.description}`;
    const existingReversal = await db.journalEntry.findFirst({
      where: {
        tenantId,
        description: reversalDescription,
        deletedAt: null,
      },
    });
    if (existingReversal) {
      this.logger.log(
        `Reversal journal entry already exists (#${existingReversal.number}) for DTE ${dteId}, skipping`,
      );
      return;
    }

    // Create a reversal entry (debit/credit swapped).
    // Use Decimal values directly; Prisma accepts Decimal/string without
    // coercion to Number (which would lose precision).
    const reversalLines = (
      original.lines as Array<{
        accountId: string;
        credit: any;
        debit: any;
        description: string | null;
      }>
    ).map((line) => ({
      accountId: line.accountId,
      debit: line.credit,
      credit: line.debit,
      description: `Reverso - ${line.description ?? ''}`.trim(),
    }));

    // Use the original entry's date so the reversal lands in the same
    // accounting context (critical if the current period differs).
    const fiscalPeriod = await this.findOpenFiscalPeriod(
      tenantId,
      original.date,
    );
    if (!fiscalPeriod) {
      this.logger.warn(
        `No open fiscal period for reversal of DTE ${dteId}`,
      );
      return;
    }

    const reversal = await this.journalEntries.create(tenantId, {
      date: original.date.toISOString().split('T')[0],
      description: reversalDescription,
      fiscalPeriodId: fiscalPeriod.id,
      // Cast: CreateJournalEntrySchema types debit/credit as number, but
      // Prisma accepts Decimal directly and we want to preserve precision.
      lines: reversalLines as unknown as Array<{
        accountId: string;
        debit: number;
        credit: number;
        description?: string;
      }>,
    });

    // Void the original entry if it was posted
    if (original.status === 'POSTED') {
      await this.journalEntries.void(original.id, tenantId);
    }

    this.logger.log(
      `Created reversal journal entry #${reversal.number} for rejected DTE ${dteId}`,
    );
  }

  /**
   * Build journal entry lines for an emitted DTE.
   */
  private buildEmittedLines(
    dte: {
      montoTotal: number;
      montoNeto: number;
      montoExento: number;
      iva: number;
      dteType: string;
    },
    mapping: {
      receivableAccountId: string | null;
      cashAccountId: string | null;
      revenueAccountId: string | null;
      revenueExemptAccountId: string | null;
      ivaDebitoAccountId: string | null;
      salesReturnAccountId: string | null;
    },
    dteTypeCode: number,
  ): Array<{ accountId: string; debit: number; credit: number; description?: string }> {
    const lines: Array<{ accountId: string; debit: number; credit: number; description?: string }> = [];
    const total = dte.montoTotal;
    const neto = dte.montoNeto;
    const exento = dte.montoExento;
    const iva = dte.iva;

    // NC 61 emitida: reverse of original factura (credit CxC, debit Revenue + IVA)
    if (dteTypeCode === DTE_TYPE_CODES.NOTA_CREDITO_ELECTRONICA) {
      if (mapping.salesReturnAccountId || mapping.receivableAccountId) {
        // Credit CxC (reduce receivable)
        if (mapping.receivableAccountId) {
          lines.push({
            accountId: mapping.receivableAccountId,
            debit: 0,
            credit: total,
            description: 'CxC (reverso por NC)',
          });
        }
        // Debit Sales Return or Revenue
        const revenueAccount = mapping.salesReturnAccountId ?? mapping.revenueAccountId;
        if (revenueAccount && neto > 0) {
          lines.push({
            accountId: revenueAccount,
            debit: neto,
            credit: 0,
            description: 'Devoluciones/Reverso ventas',
          });
        }
        if (revenueAccount && exento > 0) {
          const exemptAccount = mapping.revenueExemptAccountId ?? revenueAccount;
          lines.push({
            accountId: exemptAccount,
            debit: exento,
            credit: 0,
            description: 'Devoluciones/Reverso ventas exentas',
          });
        }
        if (mapping.ivaDebitoAccountId && iva > 0) {
          lines.push({
            accountId: mapping.ivaDebitoAccountId,
            debit: iva,
            credit: 0,
            description: 'IVA Debito Fiscal (reverso)',
          });
        }
      }
      return lines;
    }

    // Boleta 39: Debit Caja / Credit Ventas + IVA
    const isBoleta = ([
      DTE_TYPE_CODES.BOLETA_ELECTRONICA,
      DTE_TYPE_CODES.BOLETA_EXENTA_ELECTRONICA,
    ] as number[]).includes(dteTypeCode);

    // Debit side: CxC for facturas/ND, Caja for boletas
    const debitAccountId = isBoleta
      ? mapping.cashAccountId
      : mapping.receivableAccountId;

    if (debitAccountId) {
      lines.push({
        accountId: debitAccountId,
        debit: total,
        credit: 0,
        description: isBoleta ? 'Caja' : 'Cuentas por cobrar',
      });
    }

    // Credit side: Revenue
    const isExenta = ([
      DTE_TYPE_CODES.FACTURA_EXENTA_ELECTRONICA,
      DTE_TYPE_CODES.BOLETA_EXENTA_ELECTRONICA,
    ] as number[]).includes(dteTypeCode);

    if (isExenta) {
      // Exenta: no IVA, all goes to revenue exempt
      const revenueAccount =
        mapping.revenueExemptAccountId ?? mapping.revenueAccountId;
      if (revenueAccount) {
        lines.push({
          accountId: revenueAccount,
          debit: 0,
          credit: total,
          description: 'Ventas exentas',
        });
      }
    } else {
      // Afecta: split into Ventas (neto) + IVA Debito Fiscal
      if (mapping.revenueAccountId && neto > 0) {
        lines.push({
          accountId: mapping.revenueAccountId,
          debit: 0,
          credit: neto,
          description: 'Ventas',
        });
      }
      if (mapping.revenueAccountId && exento > 0) {
        const exemptAccount =
          mapping.revenueExemptAccountId ?? mapping.revenueAccountId;
        lines.push({
          accountId: exemptAccount,
          debit: 0,
          credit: exento,
          description: 'Ventas exentas',
        });
      }
      if (mapping.ivaDebitoAccountId && iva > 0) {
        lines.push({
          accountId: mapping.ivaDebitoAccountId,
          debit: 0,
          credit: iva,
          description: 'IVA Debito Fiscal',
        });
      }
    }

    return lines;
  }

  /**
   * Build journal entry lines for a received DTE.
   * Factura 33 recibida: Debit Compras + IVA Credito Fiscal / Credit CxP
   */
  private buildReceivedLines(
    dte: {
      montoTotal: number;
      montoNeto: number;
      montoExento: number;
      iva: number;
      dteType: string;
    },
    mapping: {
      payableAccountId: string | null;
      purchaseAccountId: string | null;
      ivaCreditoAccountId: string | null;
      purchaseReturnAccountId: string | null;
      revenueExemptAccountId: string | null;
    },
    dteTypeCode: number,
  ): Array<{ accountId: string; debit: number; credit: number; description?: string }> {
    const lines: Array<{ accountId: string; debit: number; credit: number; description?: string }> = [];
    const total = dte.montoTotal;
    const neto = dte.montoNeto;
    const exento = dte.montoExento;
    const iva = dte.iva;

    // NC 61 received: reverse of the original purchase
    if (dteTypeCode === DTE_TYPE_CODES.NOTA_CREDITO_ELECTRONICA) {
      if (mapping.payableAccountId) {
        lines.push({
          accountId: mapping.payableAccountId,
          debit: total,
          credit: 0,
          description: 'CxP (reverso por NC recibida)',
        });
      }
      const returnAccount =
        mapping.purchaseReturnAccountId ?? mapping.purchaseAccountId;
      if (returnAccount && neto > 0) {
        lines.push({
          accountId: returnAccount,
          debit: 0,
          credit: neto,
          description: 'Devoluciones/Reverso compras',
        });
      }
      if (mapping.ivaCreditoAccountId && iva > 0) {
        lines.push({
          accountId: mapping.ivaCreditoAccountId,
          debit: 0,
          credit: iva,
          description: 'IVA Credito Fiscal (reverso)',
        });
      }
      if (mapping.purchaseAccountId && exento > 0) {
        lines.push({
          accountId: mapping.purchaseAccountId,
          debit: 0,
          credit: exento,
          description: 'Devoluciones/Reverso compras exentas',
        });
      }
      return lines;
    }

    // Normal received factura/ND
    const isExenta = ([
      DTE_TYPE_CODES.FACTURA_EXENTA_ELECTRONICA,
    ] as number[]).includes(dteTypeCode);

    // Debit: Compras + IVA Credito
    if (isExenta) {
      if (mapping.purchaseAccountId) {
        lines.push({
          accountId: mapping.purchaseAccountId,
          debit: total,
          credit: 0,
          description: 'Compras exentas',
        });
      }
    } else {
      if (mapping.purchaseAccountId && neto > 0) {
        lines.push({
          accountId: mapping.purchaseAccountId,
          debit: neto,
          credit: 0,
          description: 'Compras',
        });
      }
      if (mapping.purchaseAccountId && exento > 0) {
        lines.push({
          accountId: mapping.purchaseAccountId,
          debit: exento,
          credit: 0,
          description: 'Compras exentas',
        });
      }
      if (mapping.ivaCreditoAccountId && iva > 0) {
        lines.push({
          accountId: mapping.ivaCreditoAccountId,
          debit: iva,
          credit: 0,
          description: 'IVA Credito Fiscal',
        });
      }
    }

    // Credit: CxP
    if (mapping.payableAccountId) {
      lines.push({
        accountId: mapping.payableAccountId,
        debit: 0,
        credit: total,
        description: 'Cuentas por pagar',
      });
    }

    return lines;
  }

  /**
   * Find an open fiscal period that contains the given date.
   */
  private async findOpenFiscalPeriod(tenantId: string, date: Date) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.fiscalPeriod.findFirst({
      where: {
        status: 'OPEN',
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}
