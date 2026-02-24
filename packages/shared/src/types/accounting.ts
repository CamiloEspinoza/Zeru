export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isActive: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
  parentId?: string;
}

export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export interface JournalEntry {
  id: string;
  number: number;
  date: Date;
  description: string;
  status: JournalEntryStatus;
  fiscalPeriodId: string;
  tenantId: string;
  lines: JournalEntryLine[];
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateJournalEntryInput {
  date: string;
  description: string;
  fiscalPeriodId: string;
  lines: CreateJournalEntryLineInput[];
}

export interface CreateJournalEntryLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export type FiscalPeriodStatus = 'OPEN' | 'CLOSED';

export interface FiscalPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: FiscalPeriodStatus;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFiscalPeriodInput {
  name: string;
  startDate: string;
  endDate: string;
}
