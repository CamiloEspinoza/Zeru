import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AccessLevel } from '@prisma/client';
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
    description: 'Acceso completo a todos los modulos',
    isDefault: false,
    moduleAccess: allModulesAt(AccessLevel.MANAGE),
  },
  {
    slug: 'admin',
    name: 'Administrador',
    description: 'Administracion completa de la organizacion',
    isDefault: false,
    moduleAccess: allModulesAt(AccessLevel.MANAGE),
  },
  {
    slug: 'finance-manager',
    name: 'Gerente de Finanzas',
    description: 'Gestion financiera y contable',
    isDefault: false,
    moduleAccess: [
      { moduleKey: 'dashboard', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'assistant', accessLevel: AccessLevel.EDIT },
      { moduleKey: 'calendar', accessLevel: AccessLevel.EDIT },
      { moduleKey: 'documents', accessLevel: AccessLevel.MANAGE },
      { moduleKey: 'clients', accessLevel: AccessLevel.MANAGE },
      { moduleKey: 'collections', accessLevel: AccessLevel.MANAGE },
      { moduleKey: 'invoicing', accessLevel: AccessLevel.MANAGE },
      { moduleKey: 'accounting', accessLevel: AccessLevel.MANAGE },
      { moduleKey: 'directory', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'orgchart', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'org-intelligence', accessLevel: AccessLevel.NONE },
      { moduleKey: 'lab-reception', accessLevel: AccessLevel.NONE },
      { moduleKey: 'lab-processing', accessLevel: AccessLevel.NONE },
      { moduleKey: 'lab-reports', accessLevel: AccessLevel.NONE },
      { moduleKey: 'lab-coding', accessLevel: AccessLevel.NONE },
      { moduleKey: 'linkedin', accessLevel: AccessLevel.NONE },
      { moduleKey: 'integrations', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'reports', accessLevel: AccessLevel.MANAGE },
      { moduleKey: 'admin', accessLevel: AccessLevel.NONE },
      { moduleKey: 'settings', accessLevel: AccessLevel.VIEW },
    ],
  },
  {
    slug: 'accountant',
    name: 'Contador',
    description: 'Acceso contable y consulta de documentos',
    isDefault: false,
    moduleAccess: [
      { moduleKey: 'dashboard', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'assistant', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'calendar', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'documents', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'clients', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'collections', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'invoicing', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'accounting', accessLevel: AccessLevel.EDIT },
      { moduleKey: 'directory', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'orgchart', accessLevel: AccessLevel.NONE },
      { moduleKey: 'org-intelligence', accessLevel: AccessLevel.NONE },
      { moduleKey: 'lab-reception', accessLevel: AccessLevel.NONE },
      { moduleKey: 'lab-processing', accessLevel: AccessLevel.NONE },
      { moduleKey: 'lab-reports', accessLevel: AccessLevel.NONE },
      { moduleKey: 'lab-coding', accessLevel: AccessLevel.NONE },
      { moduleKey: 'linkedin', accessLevel: AccessLevel.NONE },
      { moduleKey: 'integrations', accessLevel: AccessLevel.NONE },
      { moduleKey: 'reports', accessLevel: AccessLevel.VIEW },
      { moduleKey: 'admin', accessLevel: AccessLevel.NONE },
      { moduleKey: 'settings', accessLevel: AccessLevel.NONE },
    ],
  },
  {
    slug: 'viewer',
    name: 'Observador',
    description: 'Solo lectura en todos los modulos',
    isDefault: true,
    moduleAccess: allModulesAt(AccessLevel.VIEW),
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
