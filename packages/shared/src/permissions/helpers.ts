import { MODULE_DEFINITIONS } from './module-definitions';
import type { AccessLevel } from './module-definitions';

const LEVEL_HIERARCHY: Record<AccessLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
  MANAGE: 3,
};

export interface ModuleAccessEntry {
  moduleKey: string;
  accessLevel: AccessLevel;
}

export interface PermissionOverrideEntry {
  permission: string;
  granted: boolean;
}

/**
 * Check if a role can access a module (at least VIEW level).
 * Used to filter the sidebar.
 */
export function canAccessModule(
  moduleAccess: ModuleAccessEntry[],
  moduleKey: string,
): boolean {
  const access = moduleAccess.find((a) => a.moduleKey === moduleKey);
  if (!access) return false;
  return LEVEL_HIERARCHY[access.accessLevel] >= LEVEL_HIERARCHY.VIEW;
}

/**
 * Check if a role has a specific permission, considering:
 * 1. Module access level
 * 2. Granular permission's minLevel
 * 3. Explicit overrides
 */
export function hasPermission(
  moduleAccess: ModuleAccessEntry[],
  overrides: PermissionOverrideEntry[],
  moduleKey: string,
  permissionKey: string,
): boolean {
  if (permissionKey === 'view') {
    return canAccessModule(moduleAccess, moduleKey);
  }

  const fullPermission = `${moduleKey}:${permissionKey}`;
  const override = overrides.find((o) => o.permission === fullPermission);
  if (override !== undefined) return override.granted;

  const access = moduleAccess.find((a) => a.moduleKey === moduleKey);
  if (!access) return false;

  const moduleDef = MODULE_DEFINITIONS.find((m) => m.key === moduleKey);
  if (!moduleDef) return false;

  const perm = moduleDef.granularPermissions.find(
    (p) => p.key === permissionKey,
  );
  if (!perm) return false;

  return LEVEL_HIERARCHY[access.accessLevel] >= LEVEL_HIERARCHY[perm.minLevel];
}
