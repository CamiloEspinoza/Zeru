import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { FileMakerModule } from '../filemaker/filemaker.module';
import { FilesModule } from '../files/files.module';

// Constants
import {
  LAB_IMPORT_QUEUE,
  ATTACHMENT_MIGRATION_QUEUE,
} from './constants/queue.constants';

// Services
import { LabImportOrchestratorService } from './services/lab-import-orchestrator.service';
import { FmRangeResolverService } from './services/fm-range-resolver.service';

// Processors (queue dispatchers)
import { LabImportProcessor } from './processors/lab-import.processor';
import { AttachmentDownloadProcessor } from './processors/attachment-download.processor';

// Handlers (business logic)
import { ExamsBatchHandler } from './processors/handlers/exams-batch.handler';
import { WorkflowEventsBatchHandler } from './processors/handlers/workflow-events-batch.handler';
import { CommunicationsBatchHandler } from './processors/handlers/communications-batch.handler';
import { LiquidationsHandler } from './processors/handlers/liquidations.handler';
import { ChargesBatchHandler } from './processors/handlers/charges-batch.handler';

// Controllers
import { LabImportController } from './controllers/lab-import.controller';

@Module({
  imports: [
    PrismaModule,
    FileMakerModule,
    FilesModule,
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
      { name: LAB_IMPORT_QUEUE },
      { name: ATTACHMENT_MIGRATION_QUEUE },
    ),
  ],
  controllers: [LabImportController],
  providers: [
    // Services
    LabImportOrchestratorService,
    FmRangeResolverService,

    // Queue processors (one per queue)
    LabImportProcessor,
    AttachmentDownloadProcessor,

    // Handlers (injected into LabImportProcessor)
    ExamsBatchHandler,
    WorkflowEventsBatchHandler,
    CommunicationsBatchHandler,
    LiquidationsHandler,
    ChargesBatchHandler,

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
  exports: [LabImportOrchestratorService],
})
export class LabModule {}
