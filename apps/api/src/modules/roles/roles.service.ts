import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { AccessLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateRoleDto {
  name: string;
  slug: string;
  description?: string;
  isDefault?: boolean;
  moduleAccess: { moduleKey: string; accessLevel: AccessLevel }[];
  overrides?: { permission: string; granted: boolean }[];
}

interface UpdateRoleDto {
  name?: string;
  description?: string;
  isDefault?: boolean;
  moduleAccess?: { moduleKey: string; accessLevel: AccessLevel }[];
  overrides?: { permission: string; granted: boolean }[];
}

const ALL_MODULE_KEYS = [
  'dashboard',
  'assistant',
  'calendar',
  'documents',
  'clients',
  'collections',
  'invoicing',
  'accounting',
  'directory',
  'orgchart',
  'org-intelligence',
  'lab-reception',
  'lab-processing',
  'lab-reports',
  'lab-coding',
  'linkedin',
  'integrations',
  'reports',
  'admin',
  'settings',
] as const;

/** Helper to build moduleAccess array where every module has the same level */
function allModulesAt(level: AccessLevel) {
  return ALL_MODULE_KEYS.map((moduleKey) => ({ moduleKey, accessLevel: level }));
}

/** Default role definitions seeded on tenant creation */
const DEFAULT_ROLES: {
  slug: string;
  name: string;
  description: string;
  isDefault: boolean;
  moduleAccess: { moduleKey: string; accessLevel: AccessLevel }[];
}[] = [
  {
    slug: 'owner',
    name: 'Propietario',
    description: 'Acceso completo a todos los módulos',
    isDefault: false,
    moduleAccess: allModulesAt('MANAGE' as AccessLevel),
  },
  {
    slug: 'admin',
    name: 'Administrador',
    description: 'Administración completa de la organización',
    isDefault: false,
    moduleAccess: allModulesAt('MANAGE' as AccessLevel),
  },
  {
    slug: 'finance-manager',
    name: 'Gerente de Finanzas',
    description: 'Gestión financiera y contable',
    isDefault: false,
    moduleAccess: [
      { moduleKey: 'dashboard', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'assistant', accessLevel: 'EDIT' as AccessLevel },
      { moduleKey: 'calendar', accessLevel: 'EDIT' as AccessLevel },
      { moduleKey: 'documents', accessLevel: 'MANAGE' as AccessLevel },
      { moduleKey: 'clients', accessLevel: 'MANAGE' as AccessLevel },
      { moduleKey: 'collections', accessLevel: 'MANAGE' as AccessLevel },
      { moduleKey: 'invoicing', accessLevel: 'MANAGE' as AccessLevel },
      { moduleKey: 'accounting', accessLevel: 'MANAGE' as AccessLevel },
      { moduleKey: 'directory', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'orgchart', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'org-intelligence', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'lab-reception', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'lab-processing', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'lab-reports', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'lab-coding', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'linkedin', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'integrations', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'reports', accessLevel: 'MANAGE' as AccessLevel },
      { moduleKey: 'admin', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'settings', accessLevel: 'VIEW' as AccessLevel },
    ],
  },
  {
    slug: 'accountant',
    name: 'Contador',
    description: 'Acceso contable y consulta de documentos',
    isDefault: false,
    moduleAccess: [
      { moduleKey: 'dashboard', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'assistant', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'calendar', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'documents', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'clients', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'collections', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'invoicing', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'accounting', accessLevel: 'EDIT' as AccessLevel },
      { moduleKey: 'directory', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'orgchart', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'org-intelligence', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'lab-reception', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'lab-processing', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'lab-reports', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'lab-coding', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'linkedin', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'integrations', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'reports', accessLevel: 'VIEW' as AccessLevel },
      { moduleKey: 'admin', accessLevel: 'NONE' as AccessLevel },
      { moduleKey: 'settings', accessLevel: 'NONE' as AccessLevel },
    ],
  },
  {
    slug: 'viewer',
    name: 'Observador',
    description: 'Solo lectura en todos los módulos',
    isDefault: true,
    moduleAccess: allModulesAt('VIEW' as AccessLevel),
  },
];

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all roles for a tenant with module-access count */
  findAll(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        _count: { select: { moduleAccess: true, members: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Get a single role with its module access and overrides */
  async findOne(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        moduleAccess: { orderBy: { moduleKey: 'asc' } },
        overrides: { orderBy: { permission: 'asc' } },
        _count: { select: { members: true } },
      },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    return role;
  }

  /** Create a custom role */
  async create(tenantId: string, dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
        moduleAccess: {
          createMany: {
            data: dto.moduleAccess.map((ma) => ({
              moduleKey: ma.moduleKey,
              accessLevel: ma.accessLevel,
            })),
          },
        },
        overrides: dto.overrides?.length
          ? {
              createMany: {
                data: dto.overrides.map((o) => ({
                  permission: o.permission,
                  granted: o.granted,
                })),
              },
            }
          : undefined,
      },
      include: {
        moduleAccess: true,
        overrides: true,
      },
    });
  }

  /** Update a role — system roles cannot have name/slug changed */
  async update(tenantId: string, id: string, dto: UpdateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (existing.isSystem && (dto.name !== undefined)) {
      throw new BadRequestException(
        'No se puede cambiar el nombre de un rol del sistema',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update scalar fields
      const role = await tx.role.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && !existing.isSystem
            ? { name: dto.name }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });

      // Replace module access if provided
      if (dto.moduleAccess) {
        await tx.roleModuleAccess.deleteMany({ where: { roleId: id } });
        await tx.roleModuleAccess.createMany({
          data: dto.moduleAccess.map((ma) => ({
            roleId: id,
            moduleKey: ma.moduleKey,
            accessLevel: ma.accessLevel,
          })),
        });
      }

      // Replace overrides if provided
      if (dto.overrides) {
        await tx.rolePermissionOverride.deleteMany({ where: { roleId: id } });
        if (dto.overrides.length > 0) {
          await tx.rolePermissionOverride.createMany({
            data: dto.overrides.map((o) => ({
              roleId: id,
              permission: o.permission,
              granted: o.granted,
            })),
          });
        }
      }

      // Return the full updated role
      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          moduleAccess: { orderBy: { moduleKey: 'asc' } },
          overrides: { orderBy: { permission: 'asc' } },
        },
      });
    });
  }

  /** Delete a role — system roles cannot be deleted */
  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (existing.isSystem) {
      throw new BadRequestException(
        'No se puede eliminar un rol del sistema',
      );
    }

    await this.prisma.role.delete({ where: { id } });
    return { deleted: true };
  }

  /** Seed the 5 default system roles for a newly created tenant */
  async seedDefaultRoles(tenantId: string) {
    for (const def of DEFAULT_ROLES) {
      await this.prisma.role.create({
        data: {
          tenantId,
          slug: def.slug,
          name: def.name,
          description: def.description,
          isSystem: true,
          isDefault: def.isDefault,
          moduleAccess: {
            createMany: {
              data: def.moduleAccess.map((ma) => ({
                moduleKey: ma.moduleKey,
                accessLevel: ma.accessLevel,
              })),
            },
          },
        },
      });
    }
  }
}
