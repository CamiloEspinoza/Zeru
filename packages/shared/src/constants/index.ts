export const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
] as const;

export const USER_ROLES = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER'] as const;

export const JOURNAL_ENTRY_STATUSES = ['DRAFT', 'POSTED', 'VOIDED'] as const;

export const FISCAL_PERIOD_STATUSES = ['OPEN', 'CLOSED'] as const;

export const TENANT_HEADER = 'x-tenant-id';
