import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegisterSchema } from '@zeru/shared';
import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
  membershipId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Valida email + password y devuelve la membresía del usuario en el tenant dado.
   * Si el usuario existe pero no tiene membresía en ese tenant, lanza Unauthorized.
   */
  async validateUser(
    email: string,
    password: string,
    tenantId: string,
  ): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { tenantId, isActive: true },
          select: { id: true, role: true, tenantId: true },
        },
      },
    });

    if (!user || !user.isActive) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('Sin acceso a esta organización');
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      role: membership.role,
      membershipId: membership.id,
    };
  }

  /**
   * Si el usuario tiene varios tenants y no especificó slug,
   * devuelve la lista para que el cliente seleccione.
   */
  async getTenantsForUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
          include: { tenant: { select: { id: true, name: true, slug: true, isActive: true } } },
        },
      },
    });

    if (!user || !user.isActive) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user.memberships
      .filter((m) => m.tenant.isActive)
      .map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
      }));
  }

  login(user: AuthUser) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: (this.config.get<string>('JWT_EXPIRATION') ?? '7d') as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRATION') ?? '30d') as any,
    });

    return { accessToken, refreshToken, tenantId: user.tenantId };
  }

  async register(data: RegisterSchema) {
    const slug = data.tenantName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: data.tenantName, slug },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          memberships: {
            create: {
              tenantId: tenant.id,
              role: UserRole.OWNER,
            },
          },
        },
        include: {
          memberships: {
            where: { tenantId: tenant.id },
            select: { id: true, role: true, tenantId: true },
          },
        },
      });

      return { tenant, user };
    });

    const membership = result.user.memberships[0];
    const authUser: AuthUser = {
      id: result.user.id,
      email: result.user.email,
      tenantId: membership.tenantId,
      role: membership.role,
      membershipId: membership.id,
    };

    return this.login(authUser);
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            tenantId: true,
            tenant: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  }

  /**
   * Cambia el tenant activo del usuario sin requerir contraseña.
   * Verifica que el usuario tenga membresía activa en el tenant solicitado.
   */
  async switchTenant(userId: string, tenantId: string) {
    const membership = await this.prisma.userTenant.findFirst({
      where: { userId, tenantId, isActive: true },
      include: { tenant: { select: { isActive: true } } },
    });

    if (!membership || !membership.tenant.isActive) {
      throw new UnauthorizedException('Sin acceso a esta organización');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      role: membership.role,
      membershipId: membership.id,
    };

    return this.login(authUser);
  }
}
