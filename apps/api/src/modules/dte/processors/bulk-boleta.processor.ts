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
import { BoletaBuilderService } from '../services/boleta-builder.service';
import { DteConfigService } from '../services/dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { SiiBoletaRestService } from '../sii/sii-boleta-rest.service';
import { DteStateMachineService } from '../services/dte-state-machine.service';
import {
  DTE_BULK_BOLETA_QUEUE,
  DTE_STATUS_CHECK_QUEUE,
  DTE_JOB_NAMES,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

interface BulkBoletaJobData {
  tenantId: string;
  dteIds: string[];
}

const MAX_BOLETAS_PER_JOB = 50;

@Processor(DTE_BULK_BOLETA_QUEUE, {
  concurrency: DTE_QUEUE_CONFIG.BULK_BOLETA.concurrency,
})
export class BulkBoletaProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkBoletaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boletaBuilder: BoletaBuilderService,
    private readonly configService: DteConfigService,
    private readonly certService: CertificateService,
    private readonly siiBoletaRest: SiiBoletaRestService,
    private readonly stateMachine: DteStateMachineService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(DTE_STATUS_CHECK_QUEUE)
    private readonly statusQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<BulkBoletaJobData>): Promise<void> {
    const { tenantId, dteIds } = job.data;

    if (dteIds.length > MAX_BOLETAS_PER_JOB) {
      throw new Error(
        `Batch exceeds max ${MAX_BOLETAS_PER_JOB} boletas, got ${dteIds.length}`,
      );
    }

    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    this.logger.log(
      `Processing bulk boleta batch: ${dteIds.length} boletas for tenant ${tenantId}`,
    );

    // Step 1: Load all DTEs and filter to only SIGNED ones
    const dtes = await db.dte.findMany({
      where: { id: { in: dteIds } },
      select: {
        id: true,
        status: true,
        folio: true,
        dteType: true,
        xmlContent: true,
      },
    });

    const signedBoletas = dtes.filter((dte) => {
      if (dte.status !== 'SIGNED') {
        this.logger.warn(
          `Skipping DTE ${dte.id}: status is ${dte.status}, not SIGNED`,
        );
        return false;
      }
      if (!dte.xmlContent) {
        this.logger.warn(`Skipping DTE ${dte.id}: no XML content`);
        return false;
      }
      return true;
    });

    if (signedBoletas.length === 0) {
      this.logger.log('No SIGNED boletas found in batch, nothing to send');
      return;
    }

    this.logger.log(
      `Found ${signedBoletas.length} SIGNED boletas out of ${dteIds.length} requested`,
    );

    // Step 2: Build a single EnvioBOLETA envelope with all signed XMLs
    const config = await this.configService.get(tenantId);
    const cert = await this.certService.getPrimaryCert(tenantId);

    const boletaXmls = signedBoletas.map((dte) => dte.xmlContent!);

    const envelopeXml = this.boletaBuilder.buildEnvelope(
      boletaXmls,
      {
        emisorRut: config.rut,
        enviaRut: cert.rut,
        resolutionDate: config.resolutionDate.toISOString().split('T')[0],
        resolutionNum: config.resolutionNum,
      },
      cert,
    );

    // Step 3: Send via SII Boleta REST API
    const sendResult = await this.siiBoletaRest.sendBoletas(
      envelopeXml,
      cert,
      config.environment,
    );

    this.logger.log(
      `Bulk boleta envelope sent to SII: trackId=${sendResult.trackId}`,
    );

    // Step 4: Update all boletas with trackId and transition to SENT
    for (const dte of signedBoletas) {
      try {
        await db.dte.update({
          where: { id: dte.id },
          data: {
            siiTrackId: sendResult.trackId,
            siiResponse: { trackId: sendResult.trackId, bulk: true } as any,
          },
        });

        await this.stateMachine.transition(
          dte.id,
          'SIGNED',
          'SENT',
          db,
          `Enviado al SII en lote (TrackID: ${sendResult.trackId})`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to update boleta ${dte.id} after bulk send: ${err}`,
        );
      }
    }

    // Step 5: Queue a single status check for the batch (using the first DTE as reference)
    // Each boleta in the batch shares the same trackId
    for (const dte of signedBoletas) {
      await this.statusQueue.add(
        DTE_JOB_NAMES.CHECK_STATUS,
        { dteId: dte.id, tenantId, trackId: sendResult.trackId },
        {
          ...DTE_QUEUE_CONFIG.STATUS_CHECK,
          delay: 30_000,
          jobId: `status-${dte.id}`,
        },
      );
    }

    this.logger.log(
      `Bulk boleta batch complete: ${signedBoletas.length} boletas sent, status checks queued`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<BulkBoletaJobData>, error: Error) {
    this.logger.error(
      `Bulk boleta batch failed for tenant ${job.data.tenantId}: ${error.message}`,
    );

    try {
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        const db = this.prisma.forTenant(
          job.data.tenantId,
        ) as unknown as PrismaClient;

        // Mark all boletas in the batch as ERROR
        for (const dteId of job.data.dteIds) {
          const dte = await db.dte.findUnique({
            where: { id: dteId },
            select: { status: true },
          });

          if (dte?.status === 'SIGNED') {
            await this.stateMachine.transition(
              dteId,
              'SIGNED',
              'ERROR',
              db,
              `Error en envío en lote tras ${job.attemptsMade} intentos: ${error.message}`,
            );

            this.eventEmitter.emit('dte.failed', {
              tenantId: job.data.tenantId,
              dteId,
              error: error.message,
            });
          }
        }
      }
    } catch (logError) {
      this.logger.error(`Failed to handle bulk boleta failure: ${logError}`);
    }
  }
}
