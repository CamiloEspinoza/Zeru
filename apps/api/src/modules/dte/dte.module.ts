import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

// Constants
import {
  DTE_EMISSION_QUEUE,
  DTE_STATUS_CHECK_QUEUE,
  DTE_EXCHANGE_QUEUE,
  DTE_BULK_BOLETA_QUEUE,
  DTE_RCOF_QUEUE,
  DTE_RECEIVED_QUEUE,
  DTE_QUEUE_CONFIG,
} from './constants/queue.constants';

// Controllers
import { DteController } from './controllers/dte.controller';
import { DteVoidController } from './controllers/dte-void.controller';
import { DteConfigController } from './controllers/dte-config.controller';
import { CertificateController } from './controllers/certificate.controller';
import { FolioController } from './controllers/folio.controller';

// Services
import { DteConfigService } from './services/dte-config.service';
import { DteService } from './services/dte.service';
import { DteDraftService } from './services/dte-draft.service';
import { DteEmissionService } from './services/dte-emission.service';
import { DteBuilderService } from './services/dte-builder.service';
import { DteStateMachineService } from './services/dte-state-machine.service';
import { ReceptorLookupService } from './services/receptor-lookup.service';
import { DteVoidService } from './services/dte-void.service';
import { DteCorrectionService } from './services/dte-correction.service';
import { DteReissueService } from './services/dte-reissue.service';
import { DtePdfService } from './services/dte-pdf.service';
import { Pdf417Service } from './services/pdf417.service';

// Certificate
import { CertificateService } from './certificate/certificate.service';
import { CertificateParserService } from './certificate/certificate-parser.service';

// Folio
import { FolioService } from './folio/folio.service';
import { FolioAllocationService } from './folio/folio-allocation.service';

// SII infrastructure
import { SiiCircuitBreakerService } from './sii/sii-circuit-breaker.service';
import { SiiSenderService } from './sii/sii-sender.service';
import { SiiStatusService } from './sii/sii-status.service';

// Processors (BullMQ workers)
import { DteEmissionProcessor } from './processors/dte-emission.processor';
import { SiiStatusCheckProcessor } from './processors/sii-status-check.processor';

// Event listeners
import { DteExchangeListener } from './listeners/dte-exchange.listener';
import { DteNotificationListener } from './listeners/dte-notification.listener';

// Crons
import { OrphanRecoveryCron } from './cron/orphan-recovery.cron';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6380),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: DTE_EMISSION_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.EMISSION,
      },
      {
        name: DTE_STATUS_CHECK_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.STATUS_CHECK,
      },
      {
        name: DTE_EXCHANGE_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.EXCHANGE,
      },
      {
        name: DTE_BULK_BOLETA_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.BULK_BOLETA,
      },
      {
        name: DTE_RCOF_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.RCOF,
      },
      {
        name: DTE_RECEIVED_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.RECEIVED,
      },
    ),
  ],
  controllers: [
    DteController,
    DteVoidController,
    DteConfigController,
    CertificateController,
    FolioController,
  ],
  providers: [
    // Services
    DteConfigService,
    DteService,
    DteDraftService,
    DteEmissionService,
    DteBuilderService,
    DteStateMachineService,
    ReceptorLookupService,
    DteVoidService,
    DteCorrectionService,
    DteReissueService,
    DtePdfService,
    Pdf417Service,

    // Certificate
    CertificateService,
    CertificateParserService,

    // Folio
    FolioService,
    FolioAllocationService,

    // SII infrastructure
    SiiCircuitBreakerService,
    SiiSenderService,
    SiiStatusService,

    // Processors
    DteEmissionProcessor,
    SiiStatusCheckProcessor,

    // Event listeners
    DteExchangeListener,
    DteNotificationListener,

    // Crons
    OrphanRecoveryCron,
  ],
  exports: [
    DteConfigService,
    DteService,
    DteEmissionService,
    DteStateMachineService,
    CertificateService,
    FolioService,
    FolioAllocationService,
    SiiCircuitBreakerService,
    ReceptorLookupService,
  ],
})
export class DteModule {}
