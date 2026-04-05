import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FmAuthService } from './services/fm-auth.service';
import { FmApiService } from './services/fm-api.service';
import { FmDiscoveryService } from './services/fm-discovery.service';
import { FmSyncService } from './services/fm-sync.service';
import { FmDiscoveryController } from './controllers/fm-discovery.controller';
import { FmSyncController } from './controllers/fm-sync.controller';
import { FmWebhookController } from './controllers/fm-webhook.controller';
import { FmImportController } from './controllers/fm-import.controller';
import { ProcedenciasTransformer } from './transformers/procedencias.transformer';
import { ConvenioTransformer } from './transformers/convenio.transformer';
import { FmImportService } from './services/fm-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [FmDiscoveryController, FmSyncController, FmWebhookController, FmImportController],
  providers: [FmAuthService, FmApiService, FmDiscoveryService, FmSyncService, ProcedenciasTransformer, ConvenioTransformer, FmImportService],
  exports: [FmAuthService, FmApiService, FmSyncService, ProcedenciasTransformer, ConvenioTransformer],
})
export class FileMakerModule {}
