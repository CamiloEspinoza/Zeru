import type { UserRole } from './user';

export interface LoginRequest {
  email: string;
  password: string;
  /** Slug del tenant al que se quiere acceder */
  slug?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
}

/** Respuesta cuando el usuario pertenece a más de un tenant y no especificó slug */
export interface TenantSelectionRequired {
  requiresTenantSelection: true;
  tenants: Array<{ id: string; name: string; slug: string; role: UserRole }>;
}
