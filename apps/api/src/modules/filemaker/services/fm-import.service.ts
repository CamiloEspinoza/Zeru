import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from './fm-api.service';
import { FmSyncService } from './fm-sync.service';
import { ProcedenciasTransformer } from '../transformers/procedencias.transformer';

export interface ImportResult {
  legalEntitiesCreated: number;
  legalEntitiesReused: number;
  labOriginsCreated: number;
  labOriginsSkipped: number;
  contactsCreated: number;
  pricingCreated: number;
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

    // Fire and forget — process in background
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
      legalEntitiesReused: 0,
      labOriginsCreated: 0,
      labOriginsSkipped: 0,
      contactsCreated: 0,
      pricingCreated: 0,
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

    // 2. Build caches for idempotency
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
      `Import complete: ${result.legalEntitiesCreated} LE created, ` +
      `${result.legalEntitiesReused} LE reused, ${result.labOriginsCreated} origins created, ` +
      `${result.labOriginsSkipped} origins skipped, ` +
      `${result.contactsCreated} contacts, ${result.pricingCreated} pricing, ` +
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
    let isNewLegalEntity = false;

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
        isNewLegalEntity = true;

        // Create sync record for LegalEntity
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

      // Only import contacts when creating a NEW LegalEntity (avoid duplicates on reuse)
      if (isNewLegalEntity) {
        const contacts = this.transformer.extractContacts(record);
        for (const contact of contacts) {
          await this.prisma.legalEntityContact.create({
            data: { ...contact, legalEntityId, tenantId },
          });
          result.contactsCreated++;
        }
      }
    }

    // ── LabOrigin (idempotent by code) ──

    const originData = this.transformer.extractLabOrigin(record);
    const existingOriginId = codeCache.get(originData.code);

    if (existingOriginId) {
      // Already imported — skip
      result.labOriginsSkipped++;
      return;
    }

    const origin = await this.prisma.labOrigin.create({
      data: {
        ...originData,
        legalEntityId,
        tenantId,
      },
    });
    codeCache.set(originData.code, origin.id);
    result.labOriginsCreated++;

    // Create sync record for LabOrigin
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

    // ── Pricing ──

    const pricingItems = this.transformer.extractPricing(record);
    for (const pricing of pricingItems) {
      await this.prisma.labOriginPricing.create({
        data: { ...pricing, labOriginId: origin.id, tenantId },
      });
      result.pricingCreated++;
    }

    // ── Log ──

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
