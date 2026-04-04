import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from './fm-api.service';
import { FmSyncService } from './fm-sync.service';
import { ProcedenciasTransformer } from '../transformers/procedencias.transformer';

interface ImportResult {
  legalEntitiesCreated: number;
  legalEntitiesReused: number;
  labOriginsCreated: number;
  contactsCreated: number;
  pricingCreated: number;
  errors: Array<{ fmRecordId: string; error: string }>;
}

@Injectable()
export class FmImportService {
  private readonly logger = new Logger(FmImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly syncService: FmSyncService,
    private readonly transformer: ProcedenciasTransformer,
  ) {}

  async importProcedencias(tenantId: string): Promise<ImportResult> {
    const result: ImportResult = {
      legalEntitiesCreated: 0,
      legalEntitiesReused: 0,
      labOriginsCreated: 0,
      contactsCreated: 0,
      pricingCreated: 0,
      errors: [],
    };

    this.logger.log('Starting Procedencias import...');

    const fmRecords = await this.fmApi.findAll(
      this.transformer.database,
      this.transformer.layout,
      [{}],
      {
        portals: ['CONTACTOS Cobranzas', 'conceptos de cobro procedencia'],
        dateformats: 2,
      },
    );

    this.logger.log(`Fetched ${fmRecords.length} FM records`);

    const existingEntities = await this.prisma.legalEntity.findMany({
      where: { tenantId },
      select: { id: true, rut: true },
    });
    const rutCache = new Map<string, string>();
    for (const e of existingEntities) {
      rutCache.set(e.rut, e.id);
    }

    for (const record of fmRecords) {
      try {
        await this.importSingleProcedencia(tenantId, record, rutCache, result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error importing FM record ${record.recordId}: ${msg}`);
        result.errors.push({ fmRecordId: record.recordId, error: msg });
      }
    }

    this.logger.log(
      `Import complete: ${result.legalEntitiesCreated} LE created, ` +
      `${result.legalEntitiesReused} LE reused, ${result.labOriginsCreated} origins, ` +
      `${result.contactsCreated} contacts, ${result.pricingCreated} pricing, ` +
      `${result.errors.length} errors`,
    );

    return result;
  }

  private async importSingleProcedencia(
    tenantId: string,
    record: { recordId: string; modId?: string; fieldData: Record<string, unknown>; portalData?: Record<string, unknown[]> },
    rutCache: Map<string, string>,
    result: ImportResult,
  ) {
    const leData = this.transformer.extractLegalEntity(record);
    let legalEntityId: string | null = null;

    if (leData) {
      const cached = rutCache.get(leData.rut);
      if (cached) {
        legalEntityId = cached;
        result.legalEntitiesReused++;
      } else {
        const le = await this.prisma.legalEntity.create({
          data: { ...leData, tenantId },
        });
        legalEntityId = le.id;
        rutCache.set(leData.rut, le.id);
        result.legalEntitiesCreated++;

        await this.prisma.fmSyncRecord.create({
          data: {
            tenantId,
            entityType: 'legal-entity',
            entityId: le.id,
            fmDatabase: this.transformer.database,
            fmLayout: this.transformer.layout,
            fmRecordId: record.recordId,
            fmModId: record.modId,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
          },
        });
      }

      const contacts = this.transformer.extractContacts(record);
      for (const contact of contacts) {
        await this.prisma.legalEntityContact.create({
          data: { ...contact, legalEntityId, tenantId },
        });
        result.contactsCreated++;
      }
    }

    const originData = this.transformer.extractLabOrigin(record);
    const origin = await this.prisma.labOrigin.create({
      data: {
        ...originData,
        legalEntityId,
        tenantId,
      },
    });
    result.labOriginsCreated++;

    await this.prisma.fmSyncRecord.create({
      data: {
        tenantId,
        entityType: 'lab-origin',
        entityId: origin.id,
        fmDatabase: this.transformer.database,
        fmLayout: this.transformer.layout,
        fmRecordId: record.recordId,
        fmModId: record.modId,
        syncStatus: 'SYNCED',
        lastSyncAt: new Date(),
      },
    });

    const pricingItems = this.transformer.extractPricing(record);
    for (const pricing of pricingItems) {
      await this.prisma.labOriginPricing.create({
        data: { ...pricing, labOriginId: origin.id, tenantId },
      });
      result.pricingCreated++;
    }

    await this.syncService.logSync({
      tenantId,
      entityType: 'lab-origin',
      entityId: origin.id,
      fmRecordId: record.recordId,
      action: 'import',
      direction: 'fm_to_zeru',
    });
  }
}
