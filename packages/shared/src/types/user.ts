export type UserRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Membresía: representa la pertenencia de un usuario a un tenant */
export interface UserTenant {
  id: string;
  userId: string;
  tenantId: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Usuario con sus membresías cargadas */
export interface UserWithMemberships extends User {
  memberships: UserTenant[];
}

/** Usuario como se devuelve en el contexto de un tenant específico */
export interface UserInTenant extends User {
  role: UserRole;
  membershipId: string;
}

/** Membresía con datos del tenant incluidos (respuesta de /auth/me) */
export interface MembershipWithTenant {
  id: string;
  role: UserRole;
  tenantId: string;
  tenant: { id: string; name: string; slug: string };
}

/** Perfil completo del usuario con sus membresías activas */
export interface UserProfile extends User {
  memberships: MembershipWithTenant[];
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface UpdateMembershipInput {
  role?: UserRole;
  isActive?: boolean;
}
