import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { EmitDteSchema } from '@zeru/shared';
import { DteConfigService } from './dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { FolioService } from '../folio/folio.service';
import { FolioAllocationService } from '../folio/folio-allocation.service';
import {
  DTE_EMISSION_QUEUE,
  DTE_JOB_NAMES,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

@Injectable()
export class DteEmissionService {
  private readonly logger = new Logger(DteEmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: DteConfigService,
    private readonly certService: CertificateService,
    private readonly folioService: FolioService,
    private readonly folioAllocation: FolioAllocationService,
    @InjectQueue(DTE_EMISSION_QUEUE) private readonly emissionQueue: Queue,
  ) {}

  async emit(tenantId: string, userId: string, data: EmitDteSchema) {
    // 1. Sync validations (fail fast with HTTP 400)
    const config = await this.configService.get(tenantId);
    await this.certService.validatePrimaryCertExists(tenantId);
    await this.folioService.validateAvailability(
      tenantId,
      data.dteType,
      config.environment,
    );

    if (
      ['NOTA_CREDITO_ELECTRONICA', 'NOTA_DEBITO_ELECTRONICA'].includes(
        data.dteType,
      )
    ) {
      if (!data.references?.length) {
        throw new BadRequestException(
          'Notas de crédito/débito requieren referencia al documento original',
        );
      }
    }

    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 2. Allocate folio (atomic, BEFORE enqueue)
    const { folio, folioRangeId } = await this.folioAllocation.allocate(
      tenantId,
      data.dteType,
      config.environment,
    );

    // 3. Create DTE record with folio, status QUEUED
    const dte = await db.dte.create({
      data: {
        dteType: data.dteType,
        folio,
        environment: config.environment,
        status: 'QUEUED',
        direction: 'EMITTED',
        emisorRut: config.rut,
        emisorRazon: config.razonSocial,
        emisorGiro: config.giro,
        receptorRut: data.receptorRut,
        receptorRazon: data.receptorRazon,
        receptorGiro: data.receptorGiro,
        receptorDir: data.receptorDir,
        receptorComuna: data.receptorComuna,
        receptorCiudad: data.receptorCiudad,
        formaPago: data.formaPago,
        medioPago: data.medioPago,
        indServicio: data.indServicio,
        periodoDesde: data.periodoDesde
          ? new Date(data.periodoDesde)
          : undefined,
        periodoHasta: data.periodoHasta
          ? new Date(data.periodoHasta)
          : undefined,
        fechaEmision: data.fechaEmision
          ? new Date(data.fechaEmision)
          : new Date(),
        fechaVenc: data.fechaVenc ? new Date(data.fechaVenc) : undefined,
        legalEntityId: data.legalEntityId,
        folioRangeId,
        createdById: userId,
        tenantId,
        items: {
          create: data.items.map((item, idx) => ({
            lineNumber: idx + 1,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            descuentoPct: item.descuentoPct,
            descuentoMonto: item.descuentoMonto,
            recargoPct: item.recargoPct,
            recargoMonto: item.recargoMonto,
            indExe: item.indExe,
            codigosItem: item.codigosItem,
            montoItem:
              item.quantity * item.unitPrice -
              (item.descuentoMonto || 0) +
              (item.recargoMonto || 0),
          })),
        },
        references: data.references?.length
          ? {
              create: data.references.map((ref, idx) => ({
                lineNumber: idx + 1,
                tipoDocRef: ref.tipoDocRef,
                folioRef: ref.folioRef,
                fechaRef: new Date(ref.fechaRef),
                codRef: ref.codRef,
                razonRef: ref.razonRef,
              })),
            }
          : undefined,
        logs: {
          create: [
            { action: 'CREATED', message: 'DTE creado' },
            {
              action: 'QUEUED',
              message: `Folio ${folio} asignado, encolado para emisión`,
            },
          ],
        },
      },
      include: { items: true, references: true },
    });

    // 4. Enqueue with deterministic jobId
    await this.emissionQueue.add(
      DTE_JOB_NAMES.EMIT,
      { dteId: dte.id, tenantId },
      { ...DTE_QUEUE_CONFIG.EMISSION, jobId: `emit-${dte.id}` },
    );

    this.logger.log(
      `DTE ${dte.id} created with folio ${folio}, enqueued for emission`,
    );
    return dte;
  }

  async emitFromDraft(tenantId: string, userId: string, dteId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const draft = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true, references: true },
    });

    if (draft.status !== 'DRAFT') {
      throw new BadRequestException(
        'Solo se pueden emitir DTEs en estado borrador',
      );
    }

    const config = await this.configService.get(tenantId);
    await this.certService.validatePrimaryCertExists(tenantId);

    const { folio, folioRangeId } = await this.folioAllocation.allocate(
      tenantId,
      draft.dteType,
      config.environment,
    );

    await db.dte.update({
      where: { id: dteId },
      data: {
        folio,
        folioRangeId,
        environment: config.environment,
        status: 'QUEUED',
        emisorRut: config.rut,
        emisorRazon: config.razonSocial,
        emisorGiro: config.giro,
        logs: {
          create: {
            action: 'QUEUED',
            message: `Folio ${folio} asignado desde borrador, encolado`,
          },
        },
      },
    });

    await this.emissionQueue.add(
      DTE_JOB_NAMES.EMIT,
      { dteId, tenantId },
      { ...DTE_QUEUE_CONFIG.EMISSION, jobId: `emit-${dteId}` },
    );

    this.logger.log(
      `Draft ${dteId} promoted to QUEUED with folio ${folio}`,
    );
    return db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true, references: true },
    });
  }
}
