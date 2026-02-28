import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { registerSchema } from './dto/register.dto';
import type { RegisterSchema } from '@zeru/shared';
import { sendCodeSchema, verifyCodeSchema } from '@zeru/shared';

interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
  membershipId: string;
}

interface TenantSelectionResult {
  requiresTenantSelection: true;
  tenants: Array<{ id: string; name: string; slug: string; role: UserRole }>;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Passwordless code flow ────────────────────────────────────────────────

  @Post('send-code')
  @HttpCode(200)
  async sendCode(
    @Body(new ZodValidationPipe(sendCodeSchema)) body: { email: string },
  ) {
    return this.authService.sendLoginCode(body.email);
  }

  @Post('verify-code')
  @HttpCode(200)
  async verifyCode(
    @Body(new ZodValidationPipe(verifyCodeSchema))
    body: { email: string; code: string; tenantId?: string },
  ) {
    return this.authService.verifyLoginCode(body.email, body.code, body.tenantId);
  }

  // ─── Password-based flow (kept for backwards compatibility) ────────────────

  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(
    @Request() req: { user: AuthenticatedUser | TenantSelectionResult },
  ) {
    const user = req.user;

    // Si hay múltiples tenants, devolver la lista para selección
    if ('requiresTenantSelection' in user) {
      return user;
    }

    return this.authService.login(user);
  }

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterSchema,
  ) {
    return this.authService.register(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: { user: { userId: string } }) {
    return this.authService.getProfile(req.user.userId);
  }

  @Post('waitlist')
  @HttpCode(200)
  async joinWaitlist(@Body() body: { email?: string }) {
    if (!body.email) throw new BadRequestException('email es requerido');
    return this.authService.joinWaitlist(body.email);
  }

  @Post('switch-tenant')
  @UseGuards(JwtAuthGuard)
  async switchTenant(
    @Request() req: { user: { userId: string } },
    @Body() body: { tenantId?: string },
  ) {
    if (!body.tenantId) throw new BadRequestException('tenantId es requerido');
    return this.authService.switchTenant(req.user.userId, body.tenantId);
  }
}
