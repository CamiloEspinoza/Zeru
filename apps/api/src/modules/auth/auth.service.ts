import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SkillsService } from '../ai/services/skills.service';
import { EmailService } from '../email/email.service';
import type { RegisterSchema } from '@zeru/shared';
import { UserRole } from '@prisma/client';

const DEFAULT_SKILLS = [
  'https://github.com/CamiloEspinoza/ifrs-accounting-standards-advisor',
];

const CODE_EXPIRY_MINUTES = 10;
const CODE_MAX_ATTEMPTS = 5;
const CODE_COOLDOWN_SECONDS = 60;

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
  membershipId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly skillsService: SkillsService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Passwordless code flow ──────────────────────────────────────────────────

  /**
   * Genera un código de 6 dígitos, lo almacena hasheado y lo envía por email.
   * Invalida códigos anteriores no usados del mismo email.
   */
  async sendLoginCode(email: string): Promise<{ expiresAt: string }> {
    // Verificar que el usuario exista
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      // No revelar si el email existe o no — devolver respuesta idéntica
      this.logger.warn(`Login code requested for unknown email: ${email}`);
      const fakeExpiry = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60_000);
      return { expiresAt: fakeExpiry.toISOString() };
    }

    // Rate limit: no enviar si hay un código reciente no expirado
    const recent = await this.prisma.loginCode.findFirst({
      where: {
        email,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - CODE_COOLDOWN_SECONDS * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      throw new BadRequestException(
        `Espera ${CODE_COOLDOWN_SECONDS} segundos antes de solicitar otro código`,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60_000);

    await this.prisma.loginCode.create({
      data: { email, codeHash, expiresAt },
    });

    await this.emailService.sendLoginCode(email, code);

    return { expiresAt: expiresAt.toISOString() };
  }

  /**
   * Verifica un código de login. Devuelve tokens JWT o lista de tenants si hay múltiples.
   */
  async verifyLoginCode(email: string, code: string, tenantId?: string) {
    const codeHash = createHash('sha256').update(code).digest('hex');

    const loginCode = await this.prisma.loginCode.findFirst({
      where: {
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!loginCode) {
      throw new UnauthorizedException('Código expirado o inválido');
    }

    if (loginCode.attempts >= CODE_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Demasiados intentos. Solicita un nuevo código');
    }

    // Incrementar intentos
    await this.prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { attempts: { increment: 1 } },
    });

    if (loginCode.codeHash !== codeHash) {
      throw new UnauthorizedException('Código incorrecto');
    }

    // Marcar como usado
    await this.prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { usedAt: new Date() },
    });

    // Si se proporcionó tenantId, hacer login directo
    if (tenantId) {
      return this.loginByEmail(email, tenantId);
    }

    // Buscar tenants del usuario
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            tenant: { select: { id: true, name: true, slug: true, isActive: true } },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const tenants = user.memberships
      .filter((m) => m.tenant.isActive)
      .map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
      }));

    if (tenants.length === 0) {
      throw new UnauthorizedException('Sin organizaciones activas');
    }

    if (tenants.length === 1) {
      return this.loginByEmail(email, tenants[0].id);
    }

    return { requiresTenantSelection: true as const, tenants };
  }

  /**
   * Login directo por email (después de verificar código), sin password.
   */
  private async loginByEmail(email: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { tenantId, isActive: true },
          select: { id: true, role: true, tenantId: true },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('Sin acceso a esta organización');
    }

    return this.login({
      id: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      role: membership.role,
      membershipId: membership.id,
    });
  }

  // ─── Password-based flow (existing) ─────────────────────────────────────────

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

    // Install default skills for the new tenant (non-blocking — errors don't fail registration)
    void this.installDefaultSkills(result.tenant.id);

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

  async joinWaitlist(email: string) {
    try {
      await this.prisma.waitlistEntry.create({ data: { email } });
      return { success: true };
    } catch {
      throw new ConflictException('Este email ya está en la lista de espera');
    }
  }

  private async installDefaultSkills(tenantId: string): Promise<void> {
    for (const repoUrl of DEFAULT_SKILLS) {
      try {
        await this.skillsService.install(tenantId, repoUrl);
        this.logger.log(`Default skill installed for tenant ${tenantId}: ${repoUrl}`);
      } catch (err) {
        this.logger.warn(
          `Could not install default skill "${repoUrl}" for tenant ${tenantId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
