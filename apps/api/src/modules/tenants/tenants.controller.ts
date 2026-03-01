import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  createTenantSchema,
  updateTenantSchema,
  type CreateTenantSchema,
  type UpdateTenantSchema,
} from '@zeru/shared';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** Create a new organization and add the current user as OWNER */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantSchema,
  ) {
    return this.tenantsService.create(userId, body);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  @Patch('current')
  @UseGuards(JwtAuthGuard, TenantGuard)
  updateCurrent(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantSchema,
  ) {
    return this.tenantsService.update(tenantId, body);
  }

  @Get('current/onboarding-status')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getOnboardingStatus(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getOnboardingStatus(tenantId);
  }

  @Post('current/complete-onboarding')
  @UseGuards(JwtAuthGuard, TenantGuard)
  completeOnboarding(@CurrentTenant() tenantId: string) {
    return this.tenantsService.completeOnboarding(tenantId);
  }
}
