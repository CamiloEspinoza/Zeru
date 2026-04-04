// ── FM Data API types ──

export interface FmRecord {
  recordId: string;
  modId: string;
  fieldData: Record<string, unknown>;
  portalData?: Record<string, Record<string, unknown>[]>;
}

export interface FmResponse {
  records: FmRecord[];
  totalRecordCount: number;
}

export interface FmQueryOptions {
  offset?: number;
  limit?: number;
  sort?: { fieldName: string; sortOrder: 'ascend' | 'descend' }[];
  portals?: string[];
  dateformats?: 0 | 1 | 2;
}

export interface FmFindQuery {
  [field: string]: string;
}

export interface FmLayout {
  name: string;
  table: string;
  isFolder?: boolean;
  folderLayoutNames?: FmLayout[];
}

export interface FmFieldMetadata {
  name: string;
  type: string;
  result: string;
  global: boolean;
  autoEnter: boolean;
  fourDigitYear: boolean;
  maxRepeat: number;
  maxCharacters: number;
  notEmpty: boolean;
  numeric: boolean;
  repetitions: number;
  timeOfDay: boolean;
}

export interface FmPortalMetadata {
  name: string;
  fields: FmFieldMetadata[];
}

export interface FmLayoutMetadata {
  fields: FmFieldMetadata[];
  portals: FmPortalMetadata[];
}

export interface FmScript {
  name: string;
  isFolder?: boolean;
  folderScriptNames?: FmScript[];
}

export interface FmScriptResult {
  scriptResult?: string;
  scriptError?: string;
}

// ── Sync types ──

export type FmSyncStatus = 'SYNCED' | 'PENDING_TO_FM' | 'PENDING_TO_ZERU' | 'ERROR';

export interface FmSyncRecordInfo {
  id: string;
  entityType: string;
  entityId: string;
  fmDatabase: string;
  fmLayout: string;
  fmRecordId: string;
  syncStatus: FmSyncStatus;
  lastSyncAt: string;
  syncError: string | null;
  retryCount: number;
}

export interface FmSyncStats {
  synced: number;
  pendingToFm: number;
  pendingToZeru: number;
  error: number;
  total: number;
}

// ── Connection status ──

export interface FmConnectionStatus {
  connected: boolean;
  host: string;
  database: string;
  lastChecked: string;
  error?: string;
}
