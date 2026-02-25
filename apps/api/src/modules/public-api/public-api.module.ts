import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { V1AccountsController } from './v1-accounts.controller';
import { V1JournalEntriesController } from './v1-journal-entries.controller';
import { V1FiscalPeriodsController } from './v1-fiscal-periods.controller';
import { V1ReportsController } from './v1-reports.controller';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyScopeGuard } from '../../common/guards/api-key-scope.guard';
import { ApiKeyThrottlerGuard } from './api-key-throttler.guard';

@Module({
  imports: [AccountingModule, ApiKeysModule],
  controllers: [
    V1AccountsController,
    V1JournalEntriesController,
    V1FiscalPeriodsController,
    V1ReportsController,
  ],
  providers: [ApiKeyGuard, ApiKeyScopeGuard, ApiKeyThrottlerGuard],
})
export class PublicApiModule {}
