import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(
    req: { body?: { slug?: string; tenantId?: string }; headers?: Record<string, string> },
    email: string,
    password: string,
  ) {
    const { slug, tenantId: tenantIdDirect } = req.body ?? {};
    const slugFromHeader = req.headers?.['x-tenant-slug'] as string | undefined;

    // Tenant seleccionado por ID directamente (segunda vuelta del flujo multi-tenant)
    if (tenantIdDirect) {
      const user = await this.authService.validateUser(email, password, tenantIdDirect);
      if (!user) throw new UnauthorizedException('Credenciales inválidas');
      return user;
    }

    // Con slug: resolución por slug
    const resolvedSlug = slug ?? slugFromHeader;
    if (resolvedSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: resolvedSlug },
        select: { id: true, isActive: true },
      });

      if (!tenant || !tenant.isActive) {
        throw new UnauthorizedException('Organización no encontrada');
      }

      const user = await this.authService.validateUser(email, password, tenant.id);
      if (!user) throw new UnauthorizedException('Credenciales inválidas');
      return user;
    }

    // Sin tenant: verificar credenciales y devolver lista si tiene más de uno
    const tenants = await this.authService.getTenantsForUser(email, password);

    if (!tenants) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (tenants.length === 0) {
      throw new UnauthorizedException('Sin organizaciones activas');
    }

    if (tenants.length === 1) {
      const user = await this.authService.validateUser(email, password, tenants[0].id);
      if (!user) throw new UnauthorizedException('Credenciales inválidas');
      return user;
    }

    return { requiresTenantSelection: true, tenants };
  }
}
