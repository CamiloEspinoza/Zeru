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
  labOriginsSkippedDeleted: number;
  legalEntitiesSkippedDeleted: number;
  contactsImported: number;
  pricingImported: number;
  errors: Array<{ fmRecordId: string; error: string }>;
}

@Injectable()
export class FmImportService {
  private readonly logger = new Logger(FmImportService.name);
  private importing = new Map<string, boolean>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly syncService: FmSyncService,
    private readonly transformer: ProcedenciasTransformer,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Starts import in background, returns immediately. Listen for 'fm.import.done' event. */
  startImportProcedencias(tenantId: string): { started: boolean; message: string } {
    if (this.importing.get(tenantId)) {
      return { started: false, message: 'Import already in progress for this tenant' };
    }

    this.importing.set(tenantId, true);

    this.importProcedencias(tenantId)
      .then((result) => {
        this.eventEmitter.emit('fm.import.done', { tenantId, result });
      })
      .catch((error) => {
        this.logger.error(`Import failed: ${error}`);
        this.eventEmitter.emit('fm.import.done', { tenantId, error: String(error) });
      })
      .finally(() => {
        this.importing.delete(tenantId);
      });

    return { started: true, message: 'Import started in background' };
  }

  async importProcedencias(tenantId: string): Promise<ImportResult> {
    const result: ImportResult = {
      legalEntitiesCreated: 0,
      legalEntitiesUpdated: 0,
      labOriginsCreated: 0,
      labOriginsUpdated: 0,
      labOriginsSkippedDeleted: 0,
      legalEntitiesSkippedDeleted: 0,
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
        portals: ['CONTACTOS Cobranzas', 'CONTACTOS', 'conceptos de cobro procedencia'],
        dateformats: 2,
      },
    );

    this.logger.log(`Fetched ${fmRecords.length} FM records`);

    // 2. Build caches: key → Zeru ID (active records)
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

    // 3. Build soft-deleted sets (bypass soft-delete extension via rawClient)
    const rawClient = this.prisma.rawClient;
    const deletedOrigins = await rawClient.labOrigin.findMany({
      where: { tenantId, deletedAt: { not: null } },
      select: { code: true },
    });
    const deletedOriginCodes = new Set(deletedOrigins.map((o) => o.code));

    const deletedEntities = await rawClient.legalEntity.findMany({
      where: { tenantId, deletedAt: { not: null } },
      select: { rut: true },
    });
    const deletedEntityRuts = new Set(deletedEntities.map((e) => e.rut));

    this.logger.log(
      `Caches: ${rutCache.size} LE, ${codeCache.size} origins, ` +
      `${deletedOriginCodes.size} deleted origins, ${deletedEntityRuts.size} deleted LE`,
    );

    // 4. Process each FM record
    const contactsImportedForRut = new Set<string>();
    for (const record of fmRecords) {
      try {
        await this.importSingleProcedencia(
          tenantId, record, rutCache, codeCache,
          deletedOriginCodes, deletedEntityRuts, contactsImportedForRut, result,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error importing FM record ${record.recordId}: ${msg}`);
        result.errors.push({ fmRecordId: record.recordId, error: msg });
      }
    }

    this.logger.log(
      `Import complete: LE ${result.legalEntitiesCreated} created / ${result.legalEntitiesUpdated} updated / ${result.legalEntitiesSkippedDeleted} skipped (deleted), ` +
      `Origins ${result.labOriginsCreated} created / ${result.labOriginsUpdated} updated / ${result.labOriginsSkippedDeleted} skipped (deleted), ` +
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
    deletedOriginCodes: Set<string>,
    deletedEntityRuts: Set<string>,
    contactsImportedForRut: Set<string>,
    result: ImportResult,
  ) {
    // ── LabOrigin check first (if deleted in Zeru, skip entire record) ──

    const originData = this.transformer.extractLabOrigin(record);

    if (deletedOriginCodes.has(originData.code)) {
      result.labOriginsSkippedDeleted++;
      return;
    }

    // ── LegalEntity (may be null for 31% without RUT) ──

    const leData = this.transformer.extractLegalEntity(record);
    let legalEntityId: string | null = null;

    if (leData) {
      if (deletedEntityRuts.has(leData.rut)) {
        // LegalEntity was soft-deleted in Zeru — respect that decision
        result.legalEntitiesSkippedDeleted++;
      } else {
        const existingLeId = rutCache.get(leData.rut);
        let isNewLegalEntity = false;

        if (existingLeId) {
          await this.prisma.legalEntity.update({
            where: { id: existingLeId },
            data: leData,
          });
          legalEntityId = existingLeId;
          result.legalEntitiesUpdated++;
          await this.ensureSyncRecord(tenantId, 'legal-entity', existingLeId, record);
        } else {
          const le = await this.prisma.legalEntity.create({
            data: { ...leData, tenantId },
          });
          legalEntityId = le.id;
          rutCache.set(leData.rut, le.id);
          result.legalEntitiesCreated++;
          isNewLegalEntity = true;
          await this.ensureSyncRecord(tenantId, 'legal-entity', le.id, record);
        }

        // Only import contacts on first encounter of this RUT (avoid last-writer-wins)
        if (isNewLegalEntity || !contactsImportedForRut.has(leData.rut)) {
          contactsImportedForRut.add(leData.rut);
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

          // Also import general contacts (from CONTACTOS portal)
          const generalContacts = this.transformer.extractGeneralContacts(record);
          for (const contact of generalContacts) {
            await this.prisma.legalEntityContact.create({
              data: { ...contact, legalEntityId, tenantId },
            });
            result.contactsImported++;
          }
        }
      }
    }

    // ── LabOrigin (upsert by code) ──

    const existingOriginId = codeCache.get(originData.code);
    let originId: string;

    if (existingOriginId) {
      await this.prisma.labOrigin.update({
        where: { id: existingOriginId },
        data: { ...originData, legalEntityId },
      });
      originId = existingOriginId;
      result.labOriginsUpdated++;
      await this.ensureSyncRecord(tenantId, 'lab-origin', existingOriginId, record);
    } else {
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
        create: { ...pricing, labOriginId: originId, tenantId, deletedAt: null },
        update: {
          description: pricing.description,
          basePrice: pricing.basePrice,
          referencePrice: pricing.referencePrice,
          multiplier: pricing.multiplier,
          deletedAt: null, // resurrect if previously soft-deleted
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
