export interface Tenant {
  id: string;
  name: string;
  slug: string;
  rut?: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  rut?: string;
  address?: string;
  phone?: string;
}

export interface UpdateTenantInput {
  name?: string;
  rut?: string;
  address?: string;
  phone?: string;
}
