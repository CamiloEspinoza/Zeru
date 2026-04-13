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
import { DteConfigService } from '../services/dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { SiiStatusService } from '../sii/sii-status.service';
import { DteStateMachineService } from '../services/dte-state-machine.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DTE_STATUS_CHECK_QUEUE,
  DTE_JOB_NAMES,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

interface StatusCheckJobData {
  dteId: string;
  tenantId: string;
  trackId: string;
}

@Processor(DTE_STATUS_CHECK_QUEUE, {
  concurrency: DTE_QUEUE_CONFIG.STATUS_CHECK.concurrency,
})
export class SiiStatusCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(SiiStatusCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: DteConfigService,
    private readonly certService: CertificateService,
    private readonly siiStatus: SiiStatusService,
    private readonly stateMachine: DteStateMachineService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(DTE_STATUS_CHECK_QUEUE)
    private readonly statusQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<StatusCheckJobData>): Promise<void> {
    const { dteId, tenantId, trackId } = job.data;
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const dte = await db.dte.findUniqueOrThrow({ where: { id: dteId } });

    if (
      ['ACCEPTED', 'REJECTED', 'ACCEPTED_WITH_OBJECTION', 'VOIDED'].includes(
        dte.status,
      )
    ) {
      this.logger.log(
        `DTE ${dteId} already in terminal state, skipping status check`,
      );
      return;
    }

    const config = await this.configService.get(tenantId);
    const cert = await this.certService.getPrimaryCert(tenantId);

    const result = await this.siiStatus.checkUploadStatus(
      trackId,
      config.rut,
      cert,
      config.environment,
    );

    this.logger.log(
      `SII status for ${dteId}: ${result.status} — ${result.statusGlosa}`,
    );

    await db.dteLog.create({
      data: {
        dteId,
        action: 'SII_RESPONSE',
        message: `Estado: ${result.status} — ${result.statusGlosa}`,
        metadata: result.raw as any,
      },
    });

    const isTerminal = result.status === 'EPR';

    if (isTerminal) {
      let finalStatus: 'ACCEPTED' | 'REJECTED' | 'ACCEPTED_WITH_OBJECTION';

      if (result.accepted > 0 && result.rejected === 0) {
        finalStatus =
          result.objected > 0 ? 'ACCEPTED_WITH_OBJECTION' : 'ACCEPTED';
      } else if (result.rejected > 0) {
        finalStatus = 'REJECTED';
      } else {
        finalStatus = 'ACCEPTED';
      }

      await db.dte.update({
        where: { id: dteId },
        data: { siiResponse: result.raw as any },
      });

      await this.stateMachine.transition(
        dteId,
        'SENT',
        finalStatus,
        db,
        result.statusGlosa,
      );

      this.eventEmitter.emit(`dte.${finalStatus.toLowerCase()}`, {
        tenantId,
        dteId,
        folio: dte.folio,
        dteType: dte.dteType,
        status: finalStatus,
      });

      this.logger.log(`DTE ${dteId} → ${finalStatus}`);
    } else {
      await this.statusQueue.add(DTE_JOB_NAMES.CHECK_STATUS, job.data, {
        delay: 60_000,
        jobId: `status-${dteId}-${Date.now()}`,
      });
      this.logger.log(
        `DTE ${dteId} still processing, re-queued status check`,
      );
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<StatusCheckJobData>, error: Error) {
    this.logger.error(
      `Status check failed for ${job.data.dteId}: ${error.message}`,
    );
  }
}
