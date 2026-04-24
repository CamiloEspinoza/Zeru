import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { FileMakerModule } from '../filemaker/filemaker.module';
import { FilesModule } from '../files/files.module';
import { ValidationModule } from './validation/validation.module';

// Constants
import {
  LAB_IMPORT_QUEUE,
  ATTACHMENT_MIGRATION_QUEUE,
  REPORT_VALIDATION_QUEUE,
  REPORT_VALIDATION_QUEUE_CONFIG,
} from './constants/queue.constants';

// Services — Import pipeline
import { LabImportOrchestratorService } from './services/lab-import-orchestrator.service';
import { FmRangeResolverService } from './services/fm-range-resolver.service';

// Services — CRUD
import { LabPatientService } from './services/lab-patient.service';
import { LabPractitionerService } from './services/lab-practitioner.service';
import { LabExamChargeService } from './services/lab-exam-charge.service';
import { LabLiquidationService } from './services/lab-liquidation.service';
import { LabDirectPaymentBatchService } from './services/lab-direct-payment-batch.service';
import { LabDiagnosticReportService } from './services/lab-diagnostic-report.service';

// Services — Sync
import { FmLabSyncService } from './services/fm-lab-sync.service';

// Processors (queue dispatchers)
import { LabImportProcessor } from './processors/lab-import.processor';
import { AttachmentDownloadProcessor } from './processors/attachment-download.processor';
import { ReportValidationProcessor } from './processors/report-validation.processor';

// Handlers (business logic)
import { ExamsBatchHandler } from './processors/handlers/exams-batch.handler';
import { WorkflowEventsBatchHandler } from './processors/handlers/workflow-events-batch.handler';
import { CommunicationsBatchHandler } from './processors/handlers/communications-batch.handler';
import { LiquidationsHandler } from './processors/handlers/liquidations.handler';
import { ChargesBatchHandler } from './processors/handlers/charges-batch.handler';
import { PractitionersHandler } from './processors/handlers/practitioners.handler';
import { RequestingPhysiciansHandler } from './processors/handlers/requesting-physicians.handler';

// Services — Dashboard
import { LabDashboardService } from './services/lab-dashboard.service';

// Services — Report validation
import { ReportValidationService } from './services/report-validation.service';

// Controllers
import { LabDashboardController } from './controllers/lab-dashboard.controller';
import { ReportValidationController } from './controllers/report-validation.controller';
import { LabImportController } from './controllers/lab-import.controller';
import { LabPatientController } from './controllers/lab-patient.controller';
import { LabPractitionerController } from './controllers/lab-practitioner.controller';
import { LabExamChargeController } from './controllers/lab-exam-charge.controller';
import { LabLiquidationController } from './controllers/lab-liquidation.controller';
import { LabDirectPaymentBatchController } from './controllers/lab-direct-payment-batch.controller';
import { LabDiagnosticReportController } from './controllers/lab-diagnostic-report.controller';

@Module({
  imports: [
    PrismaModule,
    FileMakerModule,
    FilesModule,
    ValidationModule,
    BullModule.registerQueue(
      {
        name: LAB_IMPORT_QUEUE,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
        },
      },
      {
        name: ATTACHMENT_MIGRATION_QUEUE,
        defaultJobOptions: {
          attempts: 10,
          backoff: { type: 'exponential', delay: 5000 },
        },
      },
      {
        name: REPORT_VALIDATION_QUEUE,
        defaultJobOptions: REPORT_VALIDATION_QUEUE_CONFIG.defaultJobOptions,
      },
    ),
  ],
  controllers: [
    LabDashboardController,
    ReportValidationController,
    LabImportController,
    LabPatientController,
    LabPractitionerController,
    LabExamChargeController,
    LabLiquidationController,
    LabDirectPaymentBatchController,
    LabDiagnosticReportController,
  ],
  providers: [
    // Dashboard
    LabDashboardService,

    // Report validation
    ReportValidationService,

    // Import pipeline services
    LabImportOrchestratorService,
    FmRangeResolverService,

    // CRUD services
    LabPatientService,
    LabPractitionerService,
    LabExamChargeService,
    LabLiquidationService,
    LabDirectPaymentBatchService,
    LabDiagnosticReportService,

    // Sync service
    FmLabSyncService,

    // Queue processors (one per queue)
    LabImportProcessor,
    AttachmentDownloadProcessor,
    ReportValidationProcessor,

    // Handlers (injected into LabImportProcessor)
    ExamsBatchHandler,
    WorkflowEventsBatchHandler,
    CommunicationsBatchHandler,
    LiquidationsHandler,
    ChargesBatchHandler,
    PractitionersHandler,
    RequestingPhysiciansHandler,

    // Citolab S3 config
    {
      provide: 'CITOLAB_S3_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        bucket: config.get<string>('CITOLAB_S3_BUCKET', 'archivos-citolab-virginia'),
        region: config.get<string>('CITOLAB_S3_REGION', 'us-east-1'),
        accessKeyId: config.get<string>('CITOLAB_AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.get<string>('CITOLAB_AWS_SECRET_ACCESS_KEY'),
      }),
    },
  ],
  exports: [
    LabImportOrchestratorService,
    LabPatientService,
    LabPractitionerService,
    LabExamChargeService,
    LabLiquidationService,
    LabDirectPaymentBatchService,
    LabDiagnosticReportService,
  ],
})
export class LabModule {}
