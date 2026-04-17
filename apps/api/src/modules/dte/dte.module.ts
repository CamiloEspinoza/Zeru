import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
import { DteReceivedController } from './controllers/dte-received.controller';
import { DteConfigController } from './controllers/dte-config.controller';
import { CertificateController } from './controllers/certificate.controller';
import { FolioController } from './controllers/folio.controller';
import { DtePublicController } from './controllers/dte-public.controller';
import { DteReportsController } from './controllers/dte-reports.controller';

// Services
import { DteConfigService } from './services/dte-config.service';
import { DteService } from './services/dte.service';
import { DteDraftService } from './services/dte-draft.service';
import { DteEmissionService } from './services/dte-emission.service';
import { DteBuilderService } from './services/dte-builder.service';
import { BoletaBuilderService } from './services/boleta-builder.service';
import { RcofService } from './services/rcof.service';
import { DteStateMachineService } from './services/dte-state-machine.service';
import { ReceptorLookupService } from './services/receptor-lookup.service';
import { DteVoidService } from './services/dte-void.service';
import { DteCorrectionService } from './services/dte-correction.service';
import { DteReissueService } from './services/dte-reissue.service';
import { DtePdfService } from './services/dte-pdf.service';
import { Pdf417Service } from './services/pdf417.service';
import { DteReceivedService } from './services/dte-received.service';
import { DteAccountMappingService } from './services/dte-account-mapping.service';
import { XmlSanitizerService } from './services/xml-sanitizer.service';

// Certificate
import { CertificateService } from './certificate/certificate.service';
import { CertificateParserService } from './certificate/certificate-parser.service';

// Certification (SII certification process)
import { CertificationService } from './certification/certification.service';
import { CertificationController } from './certification/certification.controller';

// Folio
import { FolioService } from './folio/folio.service';
import { FolioAllocationService } from './folio/folio-allocation.service';

// SII infrastructure
import { SiiCircuitBreakerService } from './sii/sii-circuit-breaker.service';
import { SiiSenderService } from './sii/sii-sender.service';
import { SiiStatusService } from './sii/sii-status.service';
import { SiiReclamoService } from './sii/sii-reclamo.service';
import { SiiBoletaRestService } from './sii/sii-boleta-rest.service';
import { SiiRateLimiterService } from './sii/sii-rate-limiter.service';

// Exchange
import { ImapPollingService } from './exchange/imap-polling.service';
import { DteXmlParserService } from './exchange/dte-xml-parser.service';
import { DteValidationService } from './exchange/dte-validation.service';
import { ExchangeResponseService } from './exchange/exchange-response.service';

// Processors (BullMQ workers)
import { DteEmissionProcessor } from './processors/dte-emission.processor';
import { SiiStatusCheckProcessor } from './processors/sii-status-check.processor';
import { BulkBoletaProcessor } from './processors/bulk-boleta.processor';
import { DteExchangeProcessor } from './processors/dte-exchange.processor';
import { DteReceivedProcessor } from './processors/dte-received.processor';
import { RcofProcessor } from './processors/rcof.processor';

// Event listeners
import { DteExchangeListener } from './listeners/dte-exchange.listener';
import { DteNotificationListener } from './listeners/dte-notification.listener';
import { DteAccountingListener } from './listeners/dte-accounting.listener';

// Crons
import { OrphanRecoveryCron } from './cron/orphan-recovery.cron';
import { DeadlineCron } from './cron/deadline.cron';
import { RcofCron } from './cron/rcof.cron';
import { CertificateExpiryCron } from './cron/certificate-expiry.cron';

// Accounting module (for journal entry creation)
import { AccountingModule } from '../accounting/accounting.module';

// Notification module (for DTE event notifications)
import { NotificationModule } from '../notification/notification.module';

// Common services
import { ChileanHolidaysService } from '../../common/services/chilean-holidays.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRATION') ?? '7d') as any,
        },
      }),
      inject: [ConfigService],
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
    AccountingModule,
    NotificationModule,
  ],
  controllers: [
    DteController,
    DtePublicController,
    DteVoidController,
    DteReceivedController,
    DteConfigController,
    CertificateController,
    FolioController,
    DteReportsController,
    CertificationController,
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
    DteReceivedService,
    DteAccountMappingService,
    BoletaBuilderService,
    RcofService,
    XmlSanitizerService,
    ChileanHolidaysService,

    // Certificate
    CertificateService,
    CertificateParserService,

    // Certification
    CertificationService,

    // Folio
    FolioService,
    FolioAllocationService,

    // SII infrastructure
    SiiCircuitBreakerService,
    SiiSenderService,
    SiiStatusService,
    SiiReclamoService,
    SiiBoletaRestService,
    SiiRateLimiterService,

    // Exchange
    ImapPollingService,
    DteXmlParserService,
    DteValidationService,
    ExchangeResponseService,

    // Processors
    DteEmissionProcessor,
    SiiStatusCheckProcessor,
    BulkBoletaProcessor,
    DteExchangeProcessor,
    DteReceivedProcessor,
    RcofProcessor,

    // Event listeners
    DteExchangeListener,
    DteNotificationListener,
    DteAccountingListener,

    // Crons
    OrphanRecoveryCron,
    DeadlineCron,
    RcofCron,
    CertificateExpiryCron,
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
    DteAccountMappingService,
    XmlSanitizerService,
  ],
})
export class DteModule {}
