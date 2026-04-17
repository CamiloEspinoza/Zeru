import { hasPermission, canAccessModule } from '@zeru/shared';
import type { ModuleAccessEntry, PermissionOverrideEntry } from '@zeru/shared';

function access(moduleKey: string, level: string): ModuleAccessEntry {
  return { moduleKey, accessLevel: level as any };
}

function override(perm: string, granted: boolean): PermissionOverrideEntry {
  return { permission: perm, granted };
}

describe('canAccessModule', () => {
  it('returns true when module has VIEW access', () => {
    expect(canAccessModule([access('projects', 'VIEW')], 'projects')).toBe(true);
  });

  it('returns true when module has EDIT access', () => {
    expect(canAccessModule([access('projects', 'EDIT')], 'projects')).toBe(true);
  });

  it('returns true when module has MANAGE access', () => {
    expect(canAccessModule([access('projects', 'MANAGE')], 'projects')).toBe(true);
  });

  it('returns false when module has NONE access', () => {
    expect(canAccessModule([access('projects', 'NONE')], 'projects')).toBe(false);
  });

  it('returns false when module is not in access list', () => {
    expect(canAccessModule([access('dashboard', 'VIEW')], 'projects')).toBe(false);
  });
});

describe('hasPermission', () => {
  // ── view (special case) ──

  it('"view" returns true when module has VIEW access', () => {
    expect(hasPermission([access('projects', 'VIEW')], [], 'projects', 'view')).toBe(true);
  });

  it('"view" returns false when module has NONE access', () => {
    expect(hasPermission([access('projects', 'NONE')], [], 'projects', 'view')).toBe(false);
  });

  // ── ACTION_LEVEL_MAP fallback ──

  it('"read" maps to VIEW — granted at VIEW level', () => {
    expect(hasPermission([access('lab', 'VIEW')], [], 'lab', 'read')).toBe(true);
  });

  it('"read" maps to VIEW — denied at NONE level', () => {
    expect(hasPermission([access('lab', 'NONE')], [], 'lab', 'read')).toBe(false);
  });

  it('"write" maps to EDIT — granted at EDIT level', () => {
    expect(hasPermission([access('lab', 'EDIT')], [], 'lab', 'write')).toBe(true);
  });

  it('"write" maps to EDIT — denied at VIEW level', () => {
    expect(hasPermission([access('lab', 'VIEW')], [], 'lab', 'write')).toBe(false);
  });

  it('"write" maps to EDIT — granted at MANAGE level', () => {
    expect(hasPermission([access('lab', 'MANAGE')], [], 'lab', 'write')).toBe(true);
  });

  it('"edit" maps to EDIT — granted at EDIT level', () => {
    expect(hasPermission([access('lab', 'EDIT')], [], 'lab', 'edit')).toBe(true);
  });

  it('"manage" maps to MANAGE — granted at MANAGE level', () => {
    expect(hasPermission([access('settings', 'MANAGE')], [], 'settings', 'manage')).toBe(true);
  });

  it('"manage" maps to MANAGE — denied at EDIT level', () => {
    expect(hasPermission([access('settings', 'EDIT')], [], 'settings', 'manage')).toBe(false);
  });

  it('"admin" maps to MANAGE — granted at MANAGE level', () => {
    expect(hasPermission([access('lab', 'MANAGE')], [], 'lab', 'admin')).toBe(true);
  });

  it('"admin" maps to MANAGE — denied at EDIT level', () => {
    expect(hasPermission([access('lab', 'EDIT')], [], 'lab', 'admin')).toBe(false);
  });

  // ── Granular permissions take precedence ──

  it('granular permission takes precedence over fallback map', () => {
    // lab-origins has granular 'write' with minLevel EDIT
    // The fallback would also map 'write' to EDIT, but the granular path should be taken
    expect(hasPermission([access('lab-origins', 'EDIT')], [], 'lab-origins', 'write')).toBe(true);
    expect(hasPermission([access('lab-origins', 'VIEW')], [], 'lab-origins', 'write')).toBe(false);
  });

  it('granular "create" on projects requires EDIT', () => {
    expect(hasPermission([access('projects', 'EDIT')], [], 'projects', 'create')).toBe(true);
    expect(hasPermission([access('projects', 'VIEW')], [], 'projects', 'create')).toBe(false);
  });

  it('granular "delete" on projects requires MANAGE', () => {
    expect(hasPermission([access('projects', 'MANAGE')], [], 'projects', 'delete')).toBe(true);
    expect(hasPermission([access('projects', 'EDIT')], [], 'projects', 'delete')).toBe(false);
  });

  // ── Overrides ──

  it('explicit override grant takes precedence over level', () => {
    // User has VIEW on projects but override grants 'create'
    expect(
      hasPermission(
        [access('projects', 'VIEW')],
        [override('projects:create', true)],
        'projects',
        'create',
      ),
    ).toBe(true);
  });

  it('explicit override deny takes precedence over level', () => {
    // User has MANAGE on projects but override denies 'delete'
    expect(
      hasPermission(
        [access('projects', 'MANAGE')],
        [override('projects:delete', false)],
        'projects',
        'delete',
      ),
    ).toBe(false);
  });

  it('override works with fallback actions too', () => {
    // Override denies lab:read even though user has MANAGE
    expect(
      hasPermission(
        [access('lab', 'MANAGE')],
        [override('lab:read', false)],
        'lab',
        'read',
      ),
    ).toBe(false);
  });

  // ── Unknown/invalid cases ──

  it('unknown action name returns false', () => {
    expect(hasPermission([access('projects', 'MANAGE')], [], 'projects', 'nonexistent')).toBe(false);
  });

  it('unknown module returns false', () => {
    expect(hasPermission([access('fake-module', 'MANAGE')], [], 'fake-module', 'read')).toBe(false);
  });

  it('no module access entry returns false', () => {
    expect(hasPermission([], [], 'projects', 'view')).toBe(false);
  });

  // ── Modules with empty granularPermissions ──

  it('module with no granular perms: "view" works via special case', () => {
    expect(hasPermission([access('dashboard', 'VIEW')], [], 'dashboard', 'view')).toBe(true);
  });

  it('module with no granular perms: "read" works via fallback', () => {
    expect(hasPermission([access('dashboard', 'VIEW')], [], 'dashboard', 'read')).toBe(true);
  });

  it('module with no granular perms: "write" works via fallback', () => {
    expect(hasPermission([access('dashboard', 'EDIT')], [], 'dashboard', 'write')).toBe(true);
  });

  it('module with no granular perms: unknown action denied', () => {
    expect(hasPermission([access('dashboard', 'MANAGE')], [], 'dashboard', 'custom-action')).toBe(false);
  });
});
