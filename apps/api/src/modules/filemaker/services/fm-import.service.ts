import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from './fm-api.service';
import { FmSyncService } from './fm-sync.service';
import { ProcedenciasTransformer } from '../transformers/procedencias.transformer';

export interface ImportResult {
  legalEntitiesCreated: number;
  legalEntitiesUpdated: number;
  labOriginsCreated: number;
  labOriginsUpdated: number;
  contactsImported: number;
  pricingImported: number;
  errors: Array<{ fmRecordId: string; error: string }>;
}

@Injectable()
export class FmImportService {
  private readonly logger = new Logger(FmImportService.name);
  private importing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly syncService: FmSyncService,
    private readonly transformer: ProcedenciasTransformer,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Starts import in background, returns immediately. Listen for 'fm.import.done' event. */
  startImportProcedencias(tenantId: string): { started: boolean; message: string } {
    if (this.importing) {
      return { started: false, message: 'Import already in progress' };
    }

    this.importing = true;

    this.importProcedencias(tenantId)
      .then((result) => {
        this.eventEmitter.emit('fm.import.done', { tenantId, result });
      })
      .catch((error) => {
        this.logger.error(`Import failed: ${error}`);
        this.eventEmitter.emit('fm.import.done', { tenantId, error: String(error) });
      })
      .finally(() => {
        this.importing = false;
      });

    return { started: true, message: 'Import started in background' };
  }

  async importProcedencias(tenantId: string): Promise<ImportResult> {
    const result: ImportResult = {
      legalEntitiesCreated: 0,
      legalEntitiesUpdated: 0,
      labOriginsCreated: 0,
      labOriginsUpdated: 0,
      contactsImported: 0,
      pricingImported: 0,
      errors: [],
    };

    this.logger.log('Starting Procedencias import...');

    // 1. Fetch all FM records with portals
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

    // 2. Build caches: key → Zeru ID
    const existingEntities = await this.prisma.legalEntity.findMany({
      where: { tenantId },
      select: { id: true, rut: true },
    });
    const rutCache = new Map<string, string>();
    for (const e of existingEntities) {
      rutCache.set(e.rut, e.id);
    }

    const existingOrigins = await this.prisma.labOrigin.findMany({
      where: { tenantId },
      select: { id: true, code: true },
    });
    const codeCache = new Map<string, string>();
    for (const o of existingOrigins) {
      codeCache.set(o.code, o.id);
    }

    // 3. Process each FM record
    for (const record of fmRecords) {
      try {
        await this.importSingleProcedencia(tenantId, record, rutCache, codeCache, result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error importing FM record ${record.recordId}: ${msg}`);
        result.errors.push({ fmRecordId: record.recordId, error: msg });
      }
    }

    this.logger.log(
      `Import complete: LE ${result.legalEntitiesCreated} created / ${result.legalEntitiesUpdated} updated, ` +
      `Origins ${result.labOriginsCreated} created / ${result.labOriginsUpdated} updated, ` +
      `${result.contactsImported} contacts, ${result.pricingImported} pricing, ` +
      `${result.errors.length} errors`,
    );

    return result;
  }

  private async importSingleProcedencia(
    tenantId: string,
    record: { recordId: string; modId?: string; fieldData: Record<string, unknown>; portalData?: Record<string, unknown[]> },
    rutCache: Map<string, string>,
    codeCache: Map<string, string>,
    result: ImportResult,
  ) {
    // ── LegalEntity (may be null for 31% without RUT) ──

    const leData = this.transformer.extractLegalEntity(record);
    let legalEntityId: string | null = null;

    if (leData) {
      const existingLeId = rutCache.get(leData.rut);

      if (existingLeId) {
        // Update existing LegalEntity with fresh FM data
        await this.prisma.legalEntity.update({
          where: { id: existingLeId },
          data: leData,
        });
        legalEntityId = existingLeId;
        result.legalEntitiesUpdated++;
      } else {
        // Create new LegalEntity
        const le = await this.prisma.legalEntity.create({
          data: { ...leData, tenantId },
        });
        legalEntityId = le.id;
        rutCache.set(leData.rut, le.id);
        result.legalEntitiesCreated++;

        await this.ensureSyncRecord(tenantId, 'legal-entity', le.id, record);
      }

      // Replace contacts: delete existing + reimport from FM
      await this.prisma.legalEntityContact.deleteMany({
        where: { legalEntityId, tenantId },
      });
      const contacts = this.transformer.extractContacts(record);
      for (const contact of contacts) {
        await this.prisma.legalEntityContact.create({
          data: { ...contact, legalEntityId, tenantId },
        });
        result.contactsImported++;
      }
    }

    // ── LabOrigin (upsert by code) ──

    const originData = this.transformer.extractLabOrigin(record);
    const existingOriginId = codeCache.get(originData.code);
    let originId: string;

    if (existingOriginId) {
      // Update existing LabOrigin with fresh FM data
      await this.prisma.labOrigin.update({
        where: { id: existingOriginId },
        data: { ...originData, legalEntityId },
      });
      originId = existingOriginId;
      result.labOriginsUpdated++;
    } else {
      // Create new LabOrigin
      const origin = await this.prisma.labOrigin.create({
        data: { ...originData, legalEntityId, tenantId },
      });
      originId = origin.id;
      codeCache.set(originData.code, origin.id);
      result.labOriginsCreated++;

      await this.ensureSyncRecord(tenantId, 'lab-origin', origin.id, record);
    }

    // ── Pricing (upsert by billingConcept) ──

    const pricingItems = this.transformer.extractPricing(record);
    for (const pricing of pricingItems) {
      await this.prisma.labOriginPricing.upsert({
        where: {
          labOriginId_billingConcept: {
            labOriginId: originId,
            billingConcept: pricing.billingConcept,
          },
        },
        create: { ...pricing, labOriginId: originId, tenantId },
        update: {
          description: pricing.description,
          basePrice: pricing.basePrice,
          referencePrice: pricing.referencePrice,
          multiplier: pricing.multiplier,
        },
      });
      result.pricingImported++;
    }

    // ── Log ──

    await this.syncService.logSync({
      tenantId,
      entityType: 'lab-origin',
      entityId: originId,
      fmRecordId: record.recordId,
      action: existingOriginId ? 'import:update' : 'import:create',
      direction: 'fm_to_zeru',
    });
  }

  private async ensureSyncRecord(
    tenantId: string,
    entityType: string,
    entityId: string,
    record: { recordId: string; modId?: string },
  ) {
    const existing = await this.prisma.fmSyncRecord.findFirst({
      where: { tenantId, entityType, entityId },
    });
    if (existing) return;

    await this.prisma.fmSyncRecord.create({
      data: {
        tenantId,
        entityType,
        entityId,
        fmDatabase: this.transformer.database,
        fmLayout: this.transformer.layout,
        fmRecordId: record.recordId,
        fmModId: record.modId,
        syncStatus: 'SYNCED',
        lastSyncAt: new Date(),
      },
    });
  }
}
