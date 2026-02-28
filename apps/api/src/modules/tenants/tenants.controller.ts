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
import {
  updateTenantSchema,
  type UpdateTenantSchema,
} from '@zeru/shared';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  getCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  @Patch('current')
  updateCurrent(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantSchema,
  ) {
    return this.tenantsService.update(tenantId, body);
  }

  @Get('current/onboarding-status')
  getOnboardingStatus(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getOnboardingStatus(tenantId);
  }

  @Post('current/complete-onboarding')
  completeOnboarding(@CurrentTenant() tenantId: string) {
    return this.tenantsService.completeOnboarding(tenantId);
  }
}
