import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectQueue,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DteBuilderService } from '../services/dte-builder.service';
import { BoletaBuilderService } from '../services/boleta-builder.service';
import { DteConfigService } from '../services/dte-config.service';
import { DteStateMachineService } from '../services/dte-state-machine.service';
import { CertificateService } from '../certificate/certificate.service';
import { FolioService } from '../folio/folio.service';
import { SiiSenderService } from '../sii/sii-sender.service';
import { SiiBoletaRestService } from '../sii/sii-boleta-rest.service';
import {
  DTE_EMISSION_QUEUE,
  DTE_STATUS_CHECK_QUEUE,
  DTE_JOB_NAMES,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';
import {
  TASA_IVA,
  CODIGOS_REFERENCIA,
  BOLETA_TYPES,
  DTE_TYPE_TO_SII_CODE,
} from '../constants/dte-types.constants';

interface EmissionJobData {
  dteId: string;
  tenantId: string;
}

/** Fully exempt DTE types — IVA is always 0 */
const EXEMPT_SII_CODES = [34, 41] as const;

const REFERENCE_CODE_MAP: Record<string, number> = {
  ANULA_DOCUMENTO: CODIGOS_REFERENCIA.ANULA,
  CORRIGE_TEXTO: CODIGOS_REFERENCIA.CORRIGE_TEXTO,
  CORRIGE_MONTOS: CODIGOS_REFERENCIA.CORRIGE_MONTOS,
};

@Processor(DTE_EMISSION_QUEUE, {
  concurrency: DTE_QUEUE_CONFIG.EMISSION.concurrency,
})
export class DteEmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(DteEmissionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: DteBuilderService,
    private readonly boletaBuilder: BoletaBuilderService,
    private readonly configService: DteConfigService,
    private readonly certService: CertificateService,
    private readonly folioService: FolioService,
    private readonly siiSender: SiiSenderService,
    private readonly siiBoletaRest: SiiBoletaRestService,
    private readonly stateMachine: DteStateMachineService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(DTE_STATUS_CHECK_QUEUE)
    private readonly statusQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<EmissionJobData>): Promise<void> {
    const { dteId, tenantId } = job.data;
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const dte = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true, references: true },
    });

    // ─── Idempotency checks ────────────────────────────────
    if (
      ['ACCEPTED', 'REJECTED', 'ACCEPTED_WITH_OBJECTION', 'VOIDED'].includes(
        dte.status,
      )
    ) {
      this.logger.log(
        `DTE ${dteId} already in terminal state ${dte.status}, skipping`,
      );
      return;
    }

    if (dte.siiTrackId && dte.status === 'SIGNED') {
      this.logger.warn(
        `DTE ${dteId} has trackId but still SIGNED — resuming status check`,
      );
      await this.stateMachine.transition(
        dteId,
        'SIGNED',
        'SENT',
        db,
        'Recovered: resuming from SIGNED with trackId',
      );
      await this.queueStatusCheck(dteId, tenantId, dte.siiTrackId);
      return;
    }

    if (dte.status === 'SENT') {
      this.logger.log(`DTE ${dteId} already SENT, skipping to status check`);
      if (dte.siiTrackId) {
        await this.queueStatusCheck(dteId, tenantId, dte.siiTrackId);
      }
      return;
    }

    // ─── PHASE 1: SIGN (no SII dependency) ─────────────────
    if (dte.status === 'QUEUED') {
      this.logger.log(
        `Phase 1: Signing DTE ${dteId} (folio ${dte.folio})`,
      );

      const config = await this.configService.get(tenantId);
      const cert = await this.certService.getPrimaryCert(tenantId);
      const caf = await this.folioService.getDecryptedCaf(
        tenantId,
        dte.folioRangeId!,
      );

      // Detect boleta vs factura routing
      const siiCode = DTE_TYPE_TO_SII_CODE[dte.dteType];
      const isBoleta = (BOLETA_TYPES as readonly number[]).includes(siiCode);
      const isExempt = (EXEMPT_SII_CODES as readonly number[]).includes(
        siiCode,
      );

      const buildInput = {
        dteType: dte.dteType,
        folio: dte.folio,
        fechaEmision: dte.fechaEmision.toISOString().split('T')[0],
        indServicio: dte.indServicio ?? undefined,
        emisor: {
          rut: config.rut,
          razonSocial: config.razonSocial,
          giro: config.giro,
          actividadEco: config.actividadEco,
          direccion: config.direccion,
          comuna: config.comuna,
        },
        receptor: {
          rut: dte.receptorRut ?? undefined,
          razonSocial: dte.receptorRazon ?? undefined,
          giro: dte.receptorGiro ?? undefined,
          direccion: dte.receptorDir ?? undefined,
          comuna: dte.receptorComuna ?? undefined,
        },
        items: dte.items.map((item) => ({
          nombre: item.itemName,
          descripcion: item.description ?? undefined,
          cantidad: Number(item.quantity),
          unidad: item.unit ?? undefined,
          precioUnitario: Number(item.unitPrice),
          descuento: Number(item.descuentoMonto ?? 0),
          exento: item.indExe === 1,
        })),
      };

      let result: { xml: string; tedXml: string; montoTotal: number };

      if (isBoleta) {
        result = this.boletaBuilder.build(buildInput, caf, cert);
      } else {
        result = this.builder.build(
          {
            ...buildInput,
            formaPago: dte.formaPago ?? undefined,
            medioPago: dte.medioPago ?? undefined,
            referencias: dte.references.map((ref) => ({
              tipoDocRef: ref.tipoDocRef,
              folioRef: ref.folioRef,
              fechaRef: ref.fechaRef.toISOString().split('T')[0],
              codRef: ref.codRef
                ? REFERENCE_CODE_MAP[ref.codRef]
                : undefined,
              razonRef: ref.razonRef ?? undefined,
            })),
          },
          caf,
          cert,
        );
      }

      // ─── Calculate montoNeto / montoExento / IVA from items ──
      const montoTotal = result.montoTotal;
      let montoNeto: number;
      let montoExento: number;
      let iva: number;

      if (isExempt) {
        // Fully exempt types (34, 41): no IVA ever
        montoNeto = 0;
        montoExento = montoTotal;
        iva = 0;
      } else {
        // Calculate from individual items
        let netoSum = 0;
        let exentoSum = 0;
        for (const item of dte.items) {
          const lineAmount = Number(item.montoItem);
          if (item.indExe != null && item.indExe > 0) {
            exentoSum += lineAmount;
          } else {
            netoSum += lineAmount;
          }
        }
        montoNeto = netoSum;
        montoExento = exentoSum;
        iva = Math.round(netoSum * TASA_IVA / 100);
      }

      await db.dte.update({
        where: { id: dteId },
        data: {
          xmlContent: result.xml,
          tedXml: result.tedXml,
          montoNeto,
          montoExento,
          iva,
          montoTotal,
        },
      });

      await this.stateMachine.transition(
        dteId,
        'QUEUED',
        'SIGNED',
        db,
        'XML generado, timbrado y firmado',
      );

      this.eventEmitter.emit('dte.signed', {
        tenantId,
        dteId,
        folio: dte.folio,
        dteType: dte.dteType,
        montoTotal,
      });

      this.logger.log(
        `Phase 1 complete: DTE ${dteId} signed (folio ${dte.folio})`,
      );
    }

    // ─── PHASE 2: SII SEND (async, tolerates downtime) ─────
    const signedDte = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
    });

    if (signedDte.status === 'SIGNED') {
      this.logger.log(`Phase 2: Sending DTE ${dteId} to SII`);

      const config = await this.configService.get(tenantId);
      const cert = await this.certService.getPrimaryCert(tenantId);

      const signedSiiCode = DTE_TYPE_TO_SII_CODE[dte.dteType];
      const signedIsBoleta = (BOLETA_TYPES as readonly number[]).includes(
        signedSiiCode,
      );

      let sendResult: { trackId: string };

      if (signedIsBoleta) {
        // Boletas use EnvioBOLETA envelope + REST API
        const envelopeXml = this.boletaBuilder.buildEnvelope(
          [signedDte.xmlContent!],
          {
            emisorRut: config.rut,
            enviaRut: cert.rut,
            resolutionDate: config.resolutionDate.toISOString().split('T')[0],
            resolutionNum: config.resolutionNum,
          },
          cert,
        );

        sendResult = await this.siiBoletaRest.sendBoletas(
          envelopeXml,
          cert,
          config.environment,
        );
      } else {
        // Facturas/NC/ND use EnvioDTE envelope + SOAP API
        const envelopeXml = this.builder.buildEnvelope(
          [signedDte.xmlContent!],
          config.rut,
          cert.rut,
          config.resolutionDate.toISOString().split('T')[0],
          config.resolutionNum,
          cert,
        );

        sendResult = await this.siiSender.sendDte(
          envelopeXml,
          cert,
          config.rut,
          config.environment,
        );
      }

      await db.dte.update({
        where: { id: dteId },
        data: {
          siiTrackId: sendResult.trackId,
          siiResponse: sendResult as any,
        },
      });

      await this.stateMachine.transition(
        dteId,
        'SIGNED',
        'SENT',
        db,
        `Enviado al SII, TrackID: ${sendResult.trackId}`,
      );
      await this.queueStatusCheck(dteId, tenantId, sendResult.trackId);

      this.logger.log(
        `Phase 2 complete: DTE ${dteId} sent to SII (trackId: ${sendResult.trackId})`,
      );
    }
  }

  private async queueStatusCheck(
    dteId: string,
    tenantId: string,
    trackId: string,
  ) {
    await this.statusQueue.add(
      DTE_JOB_NAMES.CHECK_STATUS,
      { dteId, tenantId, trackId },
      {
        ...DTE_QUEUE_CONFIG.STATUS_CHECK,
        delay: 30_000,
        jobId: `status-${dteId}`,
      },
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EmissionJobData>, error: Error) {
    this.logger.error(
      `DTE emission failed: ${job.data.dteId} — ${error.message}`,
    );

    try {
      const db = this.prisma.forTenant(
        job.data.tenantId,
      ) as unknown as PrismaClient;
      const dte = await db.dte.findUnique({
        where: { id: job.data.dteId },
      });

      // Mark ERROR only after all retries are exhausted
      if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
        if (dte?.status === 'QUEUED') {
          await this.stateMachine.transition(
            job.data.dteId,
            'QUEUED',
            'ERROR',
            db,
            `Error al firmar tras ${job.attemptsMade} intentos: ${error.message}`,
          );
        } else if (dte?.status === 'SIGNED') {
          await this.stateMachine.transition(
            job.data.dteId,
            'SIGNED',
            'ERROR',
            db,
            `Error al enviar al SII tras ${job.attemptsMade} intentos: ${error.message}`,
          );
        }
        this.eventEmitter.emit('dte.failed', {
          tenantId: job.data.tenantId,
          dteId: job.data.dteId,
          error: error.message,
        });
      }
    } catch (logError) {
      this.logger.error(`Failed to log emission error: ${logError}`);
    }
  }
}
