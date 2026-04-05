import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { FmRecord } from '@zeru/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from './fm-api.service';
import { FmSyncService } from './fm-sync.service';
import { ProcedenciasTransformer } from '../transformers/procedencias.transformer';
import { ConvenioTransformer } from '../transformers/convenio.transformer';

export interface ImportResult {
  billingConceptsCreated: number;
  billingConceptsUpdated: number;
  legalEntitiesCreated: number;
  legalEntitiesUpdated: number;
  legalEntitiesSkippedDeleted: number;
  billingAgreementsCreated: number;
  billingAgreementsUpdated: number;
  billingLinesImported: number;
  billingContactsImported: number;
  labOriginsCreated: number;
  labOriginsUpdated: number;
  labOriginsSkippedDeleted: number;
  errors: Array<{ step: string; fmRecordId: string; error: string }>;
}

@Injectable()
export class FmImportService {
  private readonly logger = new Logger(FmImportService.name);
  private importing = new Map<string, boolean>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly syncService: FmSyncService,
    private readonly procedenciasTransformer: ProcedenciasTransformer,
    private readonly convenioTransformer: ConvenioTransformer,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Starts import in background, returns immediately. Listen for 'fm.import.done' event. */
  startImportConvenios(tenantId: string): { started: boolean; message: string } {
    if (this.importing.get(tenantId)) {
      return { started: false, message: 'Import already in progress for this tenant' };
    }

    this.importing.set(tenantId, true);

    this.importConvenios(tenantId)
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

  /** Backwards-compatible alias */
  startImportProcedencias(tenantId: string): { started: boolean; message: string } {
    return this.startImportConvenios(tenantId);
  }

  async importConvenios(tenantId: string): Promise<ImportResult> {
    const result: ImportResult = {
      billingConceptsCreated: 0,
      billingConceptsUpdated: 0,
      legalEntitiesCreated: 0,
      legalEntitiesUpdated: 0,
      legalEntitiesSkippedDeleted: 0,
      billingAgreementsCreated: 0,
      billingAgreementsUpdated: 0,
      billingLinesImported: 0,
      billingContactsImported: 0,
      labOriginsCreated: 0,
      labOriginsUpdated: 0,
      labOriginsSkippedDeleted: 0,
      errors: [],
    };

    this.logger.log('Starting unified Convenios import (6-step pipeline)...');

    // ═══════════════════════════════════════════════════
    // Step 1: Import BillingConcepts
    // ═══════════════════════════════════════════════════

    const fmConceptMap = new Map<string, string>(); // FM recordId → Zeru UUID

    try {
      this.logger.log('Step 1: Importing BillingConcepts...');
      const conceptRecords = await this.fmApi.getAllRecords(
        this.convenioTransformer.database,
        this.convenioTransformer.conceptLayout,
        { dateformats: 2 },
      );
      this.logger.log(`Fetched ${conceptRecords.length} BillingConcept records from FM`);

      for (const record of conceptRecords) {
        try {
          const data = this.convenioTransformer.extractBillingConcept(record);
          const existing = await this.prisma.billingConcept.findUnique({
            where: { tenantId_code: { tenantId, code: data.code } },
          });

          if (existing) {
            await this.prisma.billingConcept.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                description: data.description,
                referencePrice: data.referencePrice,
                deletedAt: null,
              },
            });
            fmConceptMap.set(record.recordId, existing.id);
            result.billingConceptsUpdated++;
          } else {
            const created = await this.prisma.billingConcept.create({
              data: {
                code: data.code,
                name: data.name,
                description: data.description,
                referencePrice: data.referencePrice,
                tenantId,
              },
            });
            fmConceptMap.set(record.recordId, created.id);
            result.billingConceptsCreated++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push({ step: 'billing-concepts', fmRecordId: record.recordId, error: msg });
        }
      }

      this.logger.log(
        `Step 1 complete: ${result.billingConceptsCreated} created, ${result.billingConceptsUpdated} updated`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Step 1 failed globally: ${msg}`);
      result.errors.push({ step: 'billing-concepts', fmRecordId: '*', error: msg });
    }

    // ═══════════════════════════════════════════════════
    // Step 2: Import LegalEntities (from Procedencias*)
    // ═══════════════════════════════════════════════════

    const rutCache = new Map<string, string>(); // RUT → Zeru UUID

    try {
      this.logger.log('Step 2: Importing LegalEntities...');

      const existingEntities = await this.prisma.legalEntity.findMany({
        where: { tenantId },
        select: { id: true, rut: true },
      });
      for (const e of existingEntities) {
        rutCache.set(e.rut, e.id);
      }

      // Build soft-deleted set (bypass soft-delete extension via rawClient)
      const rawClient = this.prisma.rawClient;
      const deletedEntities = await rawClient.legalEntity.findMany({
        where: { tenantId, deletedAt: { not: null } },
        select: { rut: true },
      });
      const deletedEntityRuts = new Set(deletedEntities.map((e) => e.rut));

      const fmRecords = await this.fmApi.getAllRecords(
        this.procedenciasTransformer.database,
        this.procedenciasTransformer.layout,
        { dateformats: 2 },
      );
      this.logger.log(`Fetched ${fmRecords.length} Procedencias records from FM`);

      const contactsImportedForRut = new Set<string>();

      for (const record of fmRecords) {
        try {
          const leData = this.procedenciasTransformer.extractLegalEntity(record);
          if (!leData) continue;

          if (deletedEntityRuts.has(leData.rut)) {
            result.legalEntitiesSkippedDeleted++;
            continue;
          }

          const existingLeId = rutCache.get(leData.rut);
          let isNewLegalEntity = false;
          let legalEntityId: string;

          if (existingLeId) {
            const mergedLeData = Object.fromEntries(
              Object.entries(leData).filter(([, v]) => v !== null && v !== undefined),
            );
            await this.prisma.legalEntity.update({
              where: { id: existingLeId },
              data: mergedLeData,
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

          // Import LE contacts on first encounter of this RUT
          if (isNewLegalEntity || !contactsImportedForRut.has(leData.rut)) {
            contactsImportedForRut.add(leData.rut);
            await this.prisma.legalEntityContact.deleteMany({
              where: { legalEntityId, tenantId },
            });
            const contacts = this.procedenciasTransformer.extractContacts(record);
            for (const contact of contacts) {
              await this.prisma.legalEntityContact.create({
                data: { ...contact, legalEntityId, tenantId },
              });
            }
            const generalContacts = this.procedenciasTransformer.extractGeneralContacts(record);
            for (const contact of generalContacts) {
              await this.prisma.legalEntityContact.create({
                data: { ...contact, legalEntityId, tenantId },
              });
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push({ step: 'legal-entities', fmRecordId: record.recordId, error: msg });
        }
      }

      this.logger.log(
        `Step 2 complete: ${result.legalEntitiesCreated} created, ${result.legalEntitiesUpdated} updated, ${result.legalEntitiesSkippedDeleted} skipped`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Step 2 failed globally: ${msg}`);
      result.errors.push({ step: 'legal-entities', fmRecordId: '*', error: msg });
    }

    // ═══════════════════════════════════════════════════
    // Step 3: Import BillingAgreements
    // ═══════════════════════════════════════════════════

    const convenioMap = new Map<string, string>(); // FM __pk_convenio → Zeru UUID
    const fmConvenioCodeToId = new Map<string, string>(); // agreement code → Zeru UUID

    // We keep the raw FM agreement records for Steps 4 and 5
    let agreementFmRecords: FmRecord[] = [];

    try {
      this.logger.log('Step 3: Importing BillingAgreements...');
      agreementFmRecords = await this.fmApi.getAllRecords(
        this.convenioTransformer.database,
        this.convenioTransformer.agreementLayout,
        { dateformats: 2 },
      );
      this.logger.log(`Fetched ${agreementFmRecords.length} BillingAgreement records from FM`);

      for (const record of agreementFmRecords) {
        try {
          const data = this.convenioTransformer.extractBillingAgreement(record);
          const fmPk = String(record.fieldData['__pk_convenio'] ?? '').trim();

          // Resolve LegalEntity by RUT
          let legalEntityId: string | null = null;
          if (data.rut) {
            legalEntityId = rutCache.get(data.rut) ?? null;
          }

          if (!legalEntityId) {
            // BillingAgreement requires a legalEntityId — skip if we can't resolve
            result.errors.push({
              step: 'billing-agreements',
              fmRecordId: record.recordId,
              error: `Cannot resolve LegalEntity for RUT "${data.rut}" — skipping agreement "${data.code}"`,
            });
            continue;
          }

          const existing = await this.prisma.billingAgreement.findUnique({
            where: { tenantId_code: { tenantId, code: data.code } },
          });

          let agreementId: string;

          if (existing) {
            await this.prisma.billingAgreement.update({
              where: { id: existing.id },
              data: {
                name: data.name,
                legalEntityId,
                status: data.status,
                contractDate: data.contractDate,
                paymentTerms: data.paymentTerms,
                customPaymentDays: data.customPaymentDays,
                billingDayOfMonth: data.billingDayOfMonth,
                isMonthlySettlement: data.isMonthlySettlement,
                billingModalities: data.billingModalities,
                examTypes: data.examTypes,
                operationalFlags: data.operationalFlags ?? undefined,
                isActive: data.isActive,
                notes: data.notes,
                deletedAt: null,
              },
            });
            agreementId = existing.id;
            result.billingAgreementsUpdated++;
          } else {
            const created = await this.prisma.billingAgreement.create({
              data: {
                code: data.code,
                name: data.name,
                legalEntityId,
                status: data.status,
                contractDate: data.contractDate,
                paymentTerms: data.paymentTerms,
                customPaymentDays: data.customPaymentDays,
                billingDayOfMonth: data.billingDayOfMonth,
                isMonthlySettlement: data.isMonthlySettlement,
                billingModalities: data.billingModalities,
                examTypes: data.examTypes,
                operationalFlags: data.operationalFlags ?? undefined,
                isActive: data.isActive,
                notes: data.notes,
                tenantId,
              },
            });
            agreementId = created.id;
            result.billingAgreementsCreated++;
          }

          if (fmPk) {
            convenioMap.set(fmPk, agreementId);
          }
          fmConvenioCodeToId.set(data.code, agreementId);

          await this.ensureSyncRecord(tenantId, 'billing-agreement', agreementId, record);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push({ step: 'billing-agreements', fmRecordId: record.recordId, error: msg });
        }
      }

      this.logger.log(
        `Step 3 complete: ${result.billingAgreementsCreated} created, ${result.billingAgreementsUpdated} updated`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Step 3 failed globally: ${msg}`);
      result.errors.push({ step: 'billing-agreements', fmRecordId: '*', error: msg });
    }

    // ═══════════════════════════════════════════════════
    // Step 4: Import BillingAgreementLines (from portal_cdc)
    // ═══════════════════════════════════════════════════

    try {
      this.logger.log('Step 4: Importing BillingAgreementLines...');

      for (const record of agreementFmRecords) {
        try {
          const fmPk = String(record.fieldData['__pk_convenio'] ?? '').trim();
          const agreementId = fmPk ? convenioMap.get(fmPk) : undefined;
          if (!agreementId) continue; // Agreement was skipped in Step 3

          const lines = this.convenioTransformer.extractPricingLines(record);

          for (const line of lines) {
            const billingConceptId = fmConceptMap.get(line.fmConceptRecordId);
            if (!billingConceptId) {
              result.errors.push({
                step: 'billing-lines',
                fmRecordId: record.recordId,
                error: `Cannot resolve BillingConcept for FM recordId "${line.fmConceptRecordId}"`,
              });
              continue;
            }

            await this.prisma.billingAgreementLine.upsert({
              where: {
                billingAgreementId_billingConceptId: {
                  billingAgreementId: agreementId,
                  billingConceptId,
                },
              },
              create: {
                billingAgreementId: agreementId,
                billingConceptId,
                factor: line.factor,
                negotiatedPrice: line.negotiatedPrice,
                referencePrice: line.referencePrice,
                tenantId,
                deletedAt: null,
              },
              update: {
                factor: line.factor,
                negotiatedPrice: line.negotiatedPrice,
                referencePrice: line.referencePrice,
                deletedAt: null,
              },
            });
            result.billingLinesImported++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push({ step: 'billing-lines', fmRecordId: record.recordId, error: msg });
        }
      }

      this.logger.log(`Step 4 complete: ${result.billingLinesImported} lines imported`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Step 4 failed globally: ${msg}`);
      result.errors.push({ step: 'billing-lines', fmRecordId: '*', error: msg });
    }

    // ═══════════════════════════════════════════════════
    // Step 5: Import BillingContacts (from CONTACTOS Cobranzas portal)
    // ═══════════════════════════════════════════════════

    try {
      this.logger.log('Step 5: Importing BillingContacts...');

      for (const record of agreementFmRecords) {
        try {
          const fmPk = String(record.fieldData['__pk_convenio'] ?? '').trim();
          const agreementId = fmPk ? convenioMap.get(fmPk) : undefined;
          if (!agreementId) continue;

          const contacts = this.convenioTransformer.extractContacts(record);
          if (contacts.length === 0) continue;

          // Replace pattern: delete existing + recreate
          await this.prisma.billingContact.deleteMany({
            where: { billingAgreementId: agreementId, tenantId },
          });

          for (const contact of contacts) {
            await this.prisma.billingContact.create({
              data: {
                name: contact.name,
                role: contact.role,
                email: contact.email,
                phone: contact.phone,
                mobile: contact.mobile,
                billingAgreementId: agreementId,
                tenantId,
              },
            });
            result.billingContactsImported++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push({ step: 'billing-contacts', fmRecordId: record.recordId, error: msg });
        }
      }

      this.logger.log(`Step 5 complete: ${result.billingContactsImported} contacts imported`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Step 5 failed globally: ${msg}`);
      result.errors.push({ step: 'billing-contacts', fmRecordId: '*', error: msg });
    }

    // ═══════════════════════════════════════════════════
    // Step 6: Import LabOrigins (from Procedencias*)
    // ═══════════════════════════════════════════════════

    try {
      this.logger.log('Step 6: Importing LabOrigins...');

      const fmRecords = await this.fmApi.getAllRecords(
        this.procedenciasTransformer.database,
        this.procedenciasTransformer.layout,
        { dateformats: 2 },
      );

      const existingOrigins = await this.prisma.labOrigin.findMany({
        where: { tenantId },
        select: { id: true, code: true },
      });
      const codeCache = new Map<string, string>();
      for (const o of existingOrigins) {
        codeCache.set(o.code, o.id);
      }

      // Build soft-deleted set
      const rawClient = this.prisma.rawClient;
      const deletedOrigins = await rawClient.labOrigin.findMany({
        where: { tenantId, deletedAt: { not: null } },
        select: { code: true },
      });
      const deletedOriginCodes = new Set(deletedOrigins.map((o) => o.code));

      for (const record of fmRecords) {
        try {
          const originData = this.procedenciasTransformer.extractLabOrigin(record);

          if (deletedOriginCodes.has(originData.code)) {
            result.labOriginsSkippedDeleted++;
            continue;
          }

          // Resolve LegalEntity
          const leData = this.procedenciasTransformer.extractLegalEntity(record);
          const legalEntityId = leData ? (rutCache.get(leData.rut) ?? null) : null;

          // Resolve BillingAgreement via _fk_convenio
          const convenioFk = String(record.fieldData['_fk_convenio'] ?? '').trim();
          const billingAgreementId = convenioFk ? (convenioMap.get(convenioFk) ?? null) : null;

          const existingOriginId = codeCache.get(originData.code);
          let originId: string;

          if (existingOriginId) {
            const updateData: Record<string, unknown> = { ...originData };
            if (legalEntityId) updateData.legalEntityId = legalEntityId;
            if (billingAgreementId) updateData.billingAgreementId = billingAgreementId;
            await this.prisma.labOrigin.update({
              where: { id: existingOriginId },
              data: updateData,
            });
            originId = existingOriginId;
            result.labOriginsUpdated++;
            await this.ensureSyncRecord(tenantId, 'lab-origin', existingOriginId, record);
          } else {
            const origin = await this.prisma.labOrigin.create({
              data: {
                ...originData,
                legalEntityId,
                billingAgreementId,
                tenantId,
              },
            });
            originId = origin.id;
            codeCache.set(originData.code, origin.id);
            result.labOriginsCreated++;
            await this.ensureSyncRecord(tenantId, 'lab-origin', origin.id, record);
          }

          // Log sync
          await this.syncService.logSync({
            tenantId,
            entityType: 'lab-origin',
            entityId: originId,
            fmRecordId: record.recordId,
            action: existingOriginId ? 'import:update' : 'import:create',
            direction: 'fm_to_zeru',
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push({ step: 'lab-origins', fmRecordId: record.recordId, error: msg });
        }
      }

      this.logger.log(
        `Step 6 complete: ${result.labOriginsCreated} created, ${result.labOriginsUpdated} updated, ${result.labOriginsSkippedDeleted} skipped`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Step 6 failed globally: ${msg}`);
      result.errors.push({ step: 'lab-origins', fmRecordId: '*', error: msg });
    }

    // ═══════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════

    this.logger.log(
      `Import complete: ` +
      `Concepts ${result.billingConceptsCreated}c/${result.billingConceptsUpdated}u, ` +
      `LE ${result.legalEntitiesCreated}c/${result.legalEntitiesUpdated}u/${result.legalEntitiesSkippedDeleted}s, ` +
      `Agreements ${result.billingAgreementsCreated}c/${result.billingAgreementsUpdated}u, ` +
      `Lines ${result.billingLinesImported}, Contacts ${result.billingContactsImported}, ` +
      `Origins ${result.labOriginsCreated}c/${result.labOriginsUpdated}u/${result.labOriginsSkippedDeleted}s, ` +
      `${result.errors.length} errors`,
    );

    return result;
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
        fmDatabase: this.procedenciasTransformer.database,
        fmLayout: entityType === 'billing-agreement'
          ? this.convenioTransformer.agreementLayout
          : this.procedenciasTransformer.layout,
        fmRecordId: record.recordId,
        fmModId: record.modId,
        syncStatus: 'SYNCED',
        lastSyncAt: new Date(),
      },
    });
  }
}
