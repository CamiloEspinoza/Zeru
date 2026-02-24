import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import type { CreateUserSchema, UpdateUserSchema } from './dto';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const membershipSelect = {
  id: true,
  role: true,
  isActive: true,
  createdAt: true,
  tenantId: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista todos los usuarios de un tenant (via membresías) */
  async findAll(tenantId: string, query?: { page?: number; perPage?: number }) {
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 10;
    const skip = (page - 1) * perPage;

    const [memberships, total] = await Promise.all([
      this.prisma.userTenant.findMany({
        where: { tenantId },
        include: { user: { select: userSelect } },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userTenant.count({ where: { tenantId } }),
    ]);

    return {
      data: memberships.map((m) => ({
        ...m.user,
        role: m.role,
        membershipId: m.id,
        membershipActive: m.isActive,
      })),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  /** Obtiene un usuario en el contexto de un tenant */
  async findById(userId: string, tenantId: string) {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { user: { select: userSelect } },
    });

    if (!membership) {
      throw new NotFoundException(`Usuario no encontrado en esta organización`);
    }

    return {
      ...membership.user,
      role: membership.role,
      membershipId: membership.id,
      membershipActive: membership.isActive,
    };
  }

  /** Crea un usuario nuevo y lo invita al tenant, o invita a uno existente */
  async create(tenantId: string, data: CreateUserSchema) {
    const role = (data.role as UserRole) ?? UserRole.OWNER;

    // Si el usuario ya existe, solo crear membresía
    let user = await this.prisma.user.findUnique({ where: { email: data.email } });

    if (user) {
      const existing = await this.prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId } },
      });

      if (existing) {
        throw new ConflictException('El usuario ya pertenece a esta organización');
      }

      const membership = await this.prisma.userTenant.create({
        data: { userId: user.id, tenantId, role },
        include: { user: { select: userSelect } },
      });

      return {
        ...membership.user,
        role: membership.role,
        membershipId: membership.id,
        membershipActive: membership.isActive,
      };
    }

    // Usuario nuevo: crear usuario + membresía en una transacción
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const result = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        memberships: { create: { tenantId, role } },
      },
      include: {
        memberships: {
          where: { tenantId },
        },
      },
    });

    const membership = result.memberships[0];
    const { password: _, memberships: __, ...userFields } = result;

    return {
      ...userFields,
      role: membership.role,
      membershipId: membership.id,
      membershipActive: membership.isActive,
    };
  }

  /** Actualiza datos base del usuario */
  async update(userId: string, tenantId: string, data: UpdateUserSchema) {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });

    if (!membership) {
      throw new NotFoundException(`Usuario no encontrado en esta organización`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: userSelect,
    });

    return {
      ...updatedUser,
      role: membership.role,
      membershipId: membership.id,
      membershipActive: membership.isActive,
    };
  }

  /** Cambia el rol de un usuario en un tenant */
  async updateMembership(userId: string, tenantId: string, role: UserRole) {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });

    if (!membership) {
      throw new NotFoundException(`Membresía no encontrada`);
    }

    const updated = await this.prisma.userTenant.update({
      where: { id: membership.id },
      data: { role },
      include: { user: { select: userSelect } },
    });

    return {
      ...updated.user,
      role: updated.role,
      membershipId: updated.id,
      membershipActive: updated.isActive,
    };
  }
}
