import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { S3Service } from '../files/s3.service';
import { UserRole } from '@prisma/client';
import type { CreateUserSchema, UpdateUserSchema } from './dto';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  personProfiles: {
    where: { deletedAt: null },
    select: { id: true, name: true, avatarS3Key: true },
    take: 1,
  },
} as const;

const _membershipSelect = {
  id: true,
  role: true,
  roleId: true,
  isActive: true,
  createdAt: true,
  tenantId: true,
  roleRef: { select: { id: true, name: true, slug: true } },
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly s3: S3Service,
  ) {}

  /** Lista todos los usuarios de un tenant (via membresías) */
  async findAll(tenantId: string, query?: { page?: number; perPage?: number; search?: string }) {
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 10;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { tenantId };
    if (query?.search) {
      where.user = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [memberships, total] = await Promise.all([
      this.prisma.userTenant.findMany({
        where,
        include: {
          user: { select: userSelect },
          roleRef: { select: { id: true, name: true, slug: true } },
        },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userTenant.count({ where }),
    ]);

    return {
      data: memberships.map((m) => ({
        ...m.user,
        role: m.role,
        roleRef: m.roleRef ?? null,
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
      include: {
        user: { select: userSelect },
        roleRef: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!membership) {
      throw new NotFoundException(`Usuario no encontrado en esta organización`);
    }

    return {
      ...membership.user,
      role: membership.role,
      roleRef: membership.roleRef ?? null,
      membershipId: membership.id,
      membershipActive: membership.isActive,
    };
  }

  /** Crea un usuario nuevo y lo invita al tenant, o invita a uno existente */
  async create(tenantId: string, data: CreateUserSchema) {
    const role = (data.role as UserRole) ?? UserRole.OWNER;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const tenantName = tenant?.name ?? 'tu organización';

    // Resolve roleId: match by slug (lowercase of enum), fallback to default role
    const matchedRole = await this.prisma.role.findFirst({
      where: { tenantId, slug: role.toLowerCase() },
      select: { id: true },
    });
    const roleId = matchedRole?.id ?? undefined;

    // Si el usuario ya existe, solo crear membresía
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });

    if (user) {
      const existing = await this.prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId } },
      });

      if (existing) {
        throw new ConflictException('El usuario ya pertenece a esta organización');
      }

      const membership = await this.prisma.userTenant.create({
        data: { userId: user.id, tenantId, role, roleId },
        include: {
          user: { select: userSelect },
          roleRef: { select: { id: true, name: true, slug: true } },
        },
      });

      void this.sendWelcomeEmail(data.email, user.firstName, tenantName, tenantId);

      return {
        ...membership.user,
        role: membership.role,
        roleRef: membership.roleRef ?? null,
        membershipId: membership.id,
        membershipActive: membership.isActive,
      };
    }

    // Usuario nuevo: crear usuario + membresía en una transacción
    // Password random ya que el login es por código de email
    const hashedPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    const result = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        memberships: { create: { tenantId, role, roleId } },
      },
      include: {
        memberships: {
          where: { tenantId },
          include: { roleRef: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    const membership = result.memberships[0];
    const { password: _, memberships: __, ...userFields } = result;

    void this.sendWelcomeEmail(data.email, data.firstName, tenantName, tenantId);

    return {
      ...userFields,
      role: membership.role,
      roleRef: membership.roleRef ?? null,
      membershipId: membership.id,
      membershipActive: membership.isActive,
    };
  }

  private async sendWelcomeEmail(email: string, firstName: string, tenantName: string, tenantId?: string): Promise<void> {
    try {
      await this.emailService.sendWelcomeEmail(email, firstName, tenantName, tenantId);
    } catch (err) {
      this.logger.warn(`Could not send welcome email to ${email}: ${(err as Error).message}`);
    }
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

    // Resolve roleId from slug
    const matchedRole = await this.prisma.role.findFirst({
      where: { tenantId, slug: role.toLowerCase() },
      select: { id: true },
    });

    const updated = await this.prisma.userTenant.update({
      where: { id: membership.id },
      data: { role, roleId: matchedRole?.id ?? undefined },
      include: {
        user: { select: userSelect },
        roleRef: { select: { id: true, name: true, slug: true } },
      },
    });

    return {
      ...updated.user,
      role: updated.role,
      roleRef: updated.roleRef ?? null,
      membershipId: updated.id,
      membershipActive: updated.isActive,
    };
  }

  /** Vincula un PersonProfile a un usuario y resuelve el avatar */
  async linkPerson(userId: string, tenantId: string, personProfileId: string) {
    // Verify user belongs to tenant
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!membership) {
      throw new NotFoundException('Usuario no encontrado en esta organización');
    }

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Verify person exists
    const person = await client.personProfile.findFirst({
      where: { id: personProfileId, deletedAt: null },
    });
    if (!person) {
      throw new NotFoundException('Perfil de persona no encontrado');
    }

    // Check if this person is already linked to another user
    if (person.userId && person.userId !== userId) {
      throw new ConflictException('Este perfil ya está vinculado a otro usuario');
    }

    // Check if user already has a linked person in this tenant
    const existingLink = await client.personProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    if (existingLink && existingLink.id !== personProfileId) {
      throw new ConflictException('Este usuario ya tiene un perfil vinculado. Desvincule primero.');
    }

    // Link person to user
    const updated = await client.personProfile.update({
      where: { id: personProfileId },
      data: { userId },
      select: { id: true, name: true, avatarS3Key: true },
    });

    // Resolve avatar if person has one
    if (updated.avatarS3Key) {
      await this.resolveAndStoreAvatar(userId, tenantId, updated.avatarS3Key);
    }

    return { linked: true, personProfileId, personName: updated.name };
  }

  /** Desvincula un PersonProfile de un usuario y limpia el avatar */
  async unlinkPerson(userId: string, tenantId: string) {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!membership) {
      throw new NotFoundException('Usuario no encontrado en esta organización');
    }

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const linked = await client.personProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!linked) {
      throw new BadRequestException('Este usuario no tiene un perfil vinculado');
    }

    await client.personProfile.update({
      where: { id: linked.id },
      data: { userId: null },
    });

    // Clear avatar URL on user
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return { unlinked: true };
  }

  /** Genera una presigned URL del avatar del PersonProfile y la guarda en User.avatarUrl */
  async resolveAndStoreAvatar(userId: string, tenantId: string, avatarS3Key: string): Promise<string | null> {
    try {
      const url = await this.s3.getPresignedUrl(tenantId, avatarS3Key, 86400); // 24h
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: url },
      });
      return url;
    } catch (err) {
      this.logger.warn(`Could not resolve avatar for user ${userId}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Resuelve el avatar de un usuario desde su PersonProfile vinculado (si existe) */
  async resolveAvatarFromPerson(userId: string, tenantId: string): Promise<string | null> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const person = await client.personProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { avatarS3Key: true },
    });

    if (!person?.avatarS3Key) return null;

    return this.resolveAndStoreAvatar(userId, tenantId, person.avatarS3Key);
  }

  /** Devuelve el PersonProfile vinculado a un usuario en un tenant */
  async getLinkedPerson(userId: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const person = await client.personProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, name: true, role: true, avatarS3Key: true, email: true },
    });

    return person ?? null;
  }
}
