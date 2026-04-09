import { SetMetadata } from '@nestjs/common';

export const PROJECT_MIN_ROLE_KEY = 'project_min_role';
export type ProjectMinRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export const RequireProjectRole = (role: ProjectMinRole) =>
  SetMetadata(PROJECT_MIN_ROLE_KEY, role);
