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

// ─── Income Statement ────────────────────────────────────────────

export interface IncomeStatementRow {
  account_id: string;
  code: string;
  name: string;
  type: 'REVENUE' | 'EXPENSE';
  parent_id: string | null;
  balance: string;
}

export interface IncomeStatementEntryRow {
  journal_entry_id: string;
  entry_date: Date;
  entry_number: number;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

// ─── Accounting Process ──────────────────────────────────────────

export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface AccountingProcessStep {
  id: string;
  name: string;
  description: string | null;
  order: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountingStepCompletion {
  id: string;
  stepId: string;
  fiscalPeriodId: string;
  status: StepStatus;
  completedAt: Date | null;
  notes: string | null;
  completedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessStepWithCompletion extends AccountingProcessStep {
  completion: AccountingStepCompletion | null;
}

export interface CreateProcessStepInput {
  name: string;
  description?: string;
  order: number;
}

export interface UpdateProcessStepInput {
  name?: string;
  description?: string;
  order?: number;
}

export interface UpdateStepCompletionInput {
  fiscalPeriodId: string;
  status: StepStatus;
  notes?: string;
}

export interface ReorderStepsInput {
  steps: Array<{ id: string; order: number }>;
}
