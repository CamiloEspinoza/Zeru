import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ChartOfAccountsController } from './controllers/chart-of-accounts.controller';
import { JournalEntriesController } from './controllers/journal-entries.controller';
import { FiscalPeriodsController } from './controllers/fiscal-periods.controller';
import { ReportsController } from './controllers/reports.controller';
import { AccountingProcessController } from './controllers/accounting-process.controller';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { JournalEntriesService } from './services/journal-entries.service';
import { FiscalPeriodsService } from './services/fiscal-periods.service';
import { ReportsService } from './services/reports.service';
import { AccountingProcessService } from './services/accounting-process.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ChartOfAccountsController,
    JournalEntriesController,
    FiscalPeriodsController,
    ReportsController,
    AccountingProcessController,
  ],
  providers: [
    ChartOfAccountsService,
    JournalEntriesService,
    FiscalPeriodsService,
    ReportsService,
    AccountingProcessService,
  ],
  exports: [
    ChartOfAccountsService,
    JournalEntriesService,
    FiscalPeriodsService,
    ReportsService,
    AccountingProcessService,
  ],
})
export class AccountingModule {}
