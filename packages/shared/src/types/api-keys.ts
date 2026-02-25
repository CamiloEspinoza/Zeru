export const API_KEY_SCOPES = [
  'accounts:read',
  'accounts:write',
  'journal-entries:read',
  'journal-entries:write',
  'journal-entries:manage',
  'fiscal-periods:read',
  'reports:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  tenantId: string;
  createdById: string;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  /** The raw key — only returned once on creation */
  secret: string;
}

export const API_KEY_SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'accounts:read': 'Leer plan de cuentas',
  'accounts:write': 'Crear/editar cuentas',
  'journal-entries:read': 'Leer asientos',
  'journal-entries:write': 'Crear asientos',
  'journal-entries:manage': 'Postear/anular asientos',
  'fiscal-periods:read': 'Leer períodos fiscales',
  'reports:read': 'Leer reportes',
};
