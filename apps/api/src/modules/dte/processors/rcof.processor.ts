import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, DteEnvironment } from '@prisma/client';
import { RcofService } from '../services/rcof.service';
import { SiiBoletaRestService } from '../sii/sii-boleta-rest.service';
import { CertificateService } from '../certificate/certificate.service';
import {
  DTE_RCOF_QUEUE,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

interface RcofJobData {
  tenantId: string;
  date: string; // ISO date string
  environment: DteEnvironment;
}

@Processor(DTE_RCOF_QUEUE, {
  concurrency: DTE_QUEUE_CONFIG.RCOF.concurrency,
})
export class RcofProcessor extends WorkerHost {
  private readonly logger = new Logger(RcofProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rcofService: RcofService,
    private readonly siiBoletaRest: SiiBoletaRestService,
    private readonly certService: CertificateService,
  ) {
    super();
  }

  async process(job: Job<RcofJobData>): Promise<void> {
    const { tenantId, date, environment } = job.data;
    const rcofDate = new Date(date);

    this.logger.log(
      `Processing RCOF: tenant=${tenantId}, date=${date}, env=${environment}`,
    );

    // 1. Generate RCOF via RcofService
    const { xml, summary } = await this.rcofService.generate(
      tenantId,
      rcofDate,
    );

    // 2. Save via RcofService
    await this.rcofService.save(tenantId, rcofDate, environment, xml, summary);

    this.logger.log(
      `RCOF generated and saved: ${summary.length} type(s), date=${date}`,
    );

    // 3. Send to SII via SiiBoletaRestService (POST /rcof/envio, mTLS).
    const cert = await this.certService.getPrimaryCert(tenantId);
    const sendResult = await this.siiBoletaRest.sendRcof(
      xml,
      cert,
      environment,
    );

    this.logger.log(
      `RCOF sent to SII: tenant=${tenantId}, date=${date}, trackId=${sendResult.trackId}`,
    );

    // 4. Update DteRcof to SENT with the trackId returned by SII.
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    await db.dteRcof.updateMany({
      where: {
        tenantId,
        date: new Date(date),
        environment,
      },
      data: {
        status: 'SENT',
        siiTrackId: sendResult.trackId,
        siiResponse: sendResult.raw as any,
      },
    });

    this.logger.log(
      `RCOF processing complete: tenant=${tenantId}, date=${date}, trackId=${sendResult.trackId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<RcofJobData>, error: Error) {
    this.logger.error(
      `RCOF processing failed for tenant ${job.data.tenantId}, date=${job.data.date}: ${error.message}`,
    );

    try {
      if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
        const db = this.prisma.forTenant(
          job.data.tenantId,
        ) as unknown as PrismaClient;

        await db.dteRcof.updateMany({
          where: {
            tenantId: job.data.tenantId,
            date: new Date(job.data.date),
            environment: job.data.environment,
          },
          data: { status: 'ERROR' },
        });
      }
    } catch (logError) {
      this.logger.error(`Failed to handle RCOF failure: ${logError}`);
    }
  }
}
