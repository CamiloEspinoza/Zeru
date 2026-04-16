import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DteXmlParserService } from '../exchange/dte-xml-parser.service';
import { DteValidationService } from '../exchange/dte-validation.service';
import { DteReceivedService } from '../services/dte-received.service';
import { XmlSanitizerService } from '../services/xml-sanitizer.service';
import {
  DTE_RECEIVED_QUEUE,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

interface ReceivedJobData {
  tenantId: string;
  xmlContent: string;
  source: 'imap' | 'upload';
  fromEmail?: string;
}

@Processor(DTE_RECEIVED_QUEUE, {
  concurrency: DTE_QUEUE_CONFIG.RECEIVED.concurrency,
})
export class DteReceivedProcessor extends WorkerHost {
  private readonly logger = new Logger(DteReceivedProcessor.name);

  constructor(
    private readonly xmlParser: DteXmlParserService,
    private readonly validationService: DteValidationService,
    private readonly receivedService: DteReceivedService,
    private readonly xmlSanitizer: XmlSanitizerService,
  ) {
    super();
  }

  async process(job: Job<ReceivedJobData>): Promise<void> {
    const { tenantId, xmlContent, source, fromEmail } = job.data;

    this.logger.log(
      `Processing received DTE XML: tenant=${tenantId}, source=${source}`,
    );

    // 1. Sanitize XML
    this.xmlSanitizer.validateNoInjection(xmlContent);

    // 2. Parse XML via DteXmlParserService
    const parsedDtes = this.xmlParser.parseEnvioDte(xmlContent);

    if (parsedDtes.length === 0) {
      this.logger.warn(
        `No DTEs found in received XML for tenant ${tenantId}`,
      );
      return;
    }

    this.logger.log(
      `Parsed ${parsedDtes.length} DTE(s) from received XML`,
    );

    // 3. Validate and persist each DTE via DteReceivedService
    for (const parsed of parsedDtes) {
      try {
        const result = await this.receivedService.processReceivedDte(
          tenantId,
          parsed,
          fromEmail,
        );
        this.logger.log(
          `Processed received DTE ${result.dteId}: isNew=${result.isNew}, valid=${result.validation.valid}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process received DTE tipo=${parsed.tipoDTE} folio=${parsed.folio}: ${error}`,
        );
      }
    }

    this.logger.log(
      `Received DTE processing complete: tenant=${tenantId}, source=${source}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ReceivedJobData>, error: Error) {
    this.logger.error(
      `Received DTE processing failed for tenant ${job.data.tenantId}: ${error.message}`,
    );
  }
}
