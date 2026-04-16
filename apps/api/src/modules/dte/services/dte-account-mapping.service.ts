import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, DteDirection } from '@prisma/client';
import {
  DTE_TYPE_CODES,
  DTE_TYPE_NAMES,
} from '../constants/dte-types.constants';

/**
 * Default account mapping seed data.
 * Account IDs are left null — tenants must configure them before
 * automatic journal entries can be created.
 */
const DEFAULT_MAPPINGS: Array<{
  dteTypeCode: number;
  direction: DteDirection;
  label: string;
}> = [
  { dteTypeCode: DTE_TYPE_CODES.FACTURA_ELECTRONICA, direction: 'EMITTED', label: 'Factura afecta emitida' },
  { dteTypeCode: DTE_TYPE_CODES.FACTURA_EXENTA_ELECTRONICA, direction: 'EMITTED', label: 'Factura exenta emitida' },
  { dteTypeCode: DTE_TYPE_CODES.BOLETA_ELECTRONICA, direction: 'EMITTED', label: 'Boleta afecta emitida' },
  { dteTypeCode: DTE_TYPE_CODES.NOTA_DEBITO_ELECTRONICA, direction: 'EMITTED', label: 'Nota de debito emitida' },
  { dteTypeCode: DTE_TYPE_CODES.NOTA_CREDITO_ELECTRONICA, direction: 'EMITTED', label: 'Nota de credito emitida' },
  { dteTypeCode: DTE_TYPE_CODES.FACTURA_ELECTRONICA, direction: 'RECEIVED', label: 'Factura afecta recibida' },
  { dteTypeCode: DTE_TYPE_CODES.FACTURA_EXENTA_ELECTRONICA, direction: 'RECEIVED', label: 'Factura exenta recibida' },
  { dteTypeCode: DTE_TYPE_CODES.NOTA_CREDITO_ELECTRONICA, direction: 'RECEIVED', label: 'Nota de credito recibida' },
  { dteTypeCode: DTE_TYPE_CODES.NOTA_DEBITO_ELECTRONICA, direction: 'RECEIVED', label: 'Nota de debito recibida' },
];

export interface UpsertMappingData {
  dteTypeCode: number;
  direction: DteDirection;
  receivableAccountId?: string | null;
  payableAccountId?: string | null;
  cashAccountId?: string | null;
  revenueAccountId?: string | null;
  revenueExemptAccountId?: string | null;
  purchaseAccountId?: string | null;
  ivaDebitoAccountId?: string | null;
  ivaCreditoAccountId?: string | null;
  salesReturnAccountId?: string | null;
  purchaseReturnAccountId?: string | null;
}

@Injectable()
export class DteAccountMappingService {
  private readonly logger = new Logger(DteAccountMappingService.name);

  private readonly db: PrismaClient;

  constructor(private readonly prisma: PrismaService) {
    this.db = this.prisma as unknown as PrismaClient;
  }

  /** Get the mapping for a specific DTE type + direction. */
  async getMapping(tenantId: string, dteTypeCode: number, direction: DteDirection) {
    return this.db.dteAccountMapping.findUnique({
      where: {
        tenantId_dteTypeCode_direction: {
          tenantId,
          dteTypeCode,
          direction,
        },
      },
    });
  }

  /** Create or update a mapping. */
  async upsert(tenantId: string, data: UpsertMappingData) {
    const { dteTypeCode, direction, ...accounts } = data;

    return this.db.dteAccountMapping.upsert({
      where: {
        tenantId_dteTypeCode_direction: {
          tenantId,
          dteTypeCode,
          direction,
        },
      },
      create: {
        tenantId,
        dteTypeCode,
        direction,
        ...accounts,
      },
      update: accounts,
    });
  }

  /** List all mappings for a tenant. */
  async list(tenantId: string) {
    const mappings = await this.db.dteAccountMapping.findMany({
      where: { tenantId },
      orderBy: [{ dteTypeCode: 'asc' }, { direction: 'asc' }],
    });

    return mappings.map((m: (typeof mappings)[number]) => ({
      ...m,
      dteTypeName: DTE_TYPE_NAMES[m.dteTypeCode] ?? `Tipo ${m.dteTypeCode}`,
    }));
  }

  /**
   * Seed default mapping rows if none exist for this tenant.
   * Account IDs will be null — the user must configure them via the UI.
   */
  async seedDefaults(tenantId: string) {
    const existing = await this.db.dteAccountMapping.count({
      where: { tenantId },
    });

    if (existing > 0) {
      this.logger.log(
        `Tenant ${tenantId} already has ${existing} mappings, skipping seed`,
      );
      return this.list(tenantId);
    }

    await this.db.dteAccountMapping.createMany({
      data: DEFAULT_MAPPINGS.map((m) => ({
        tenantId,
        dteTypeCode: m.dteTypeCode,
        direction: m.direction,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Seeded ${DEFAULT_MAPPINGS.length} default DTE account mappings for tenant ${tenantId}`,
    );

    return this.list(tenantId);
  }
}
