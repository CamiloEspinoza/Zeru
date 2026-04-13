import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DteVoidService } from '../services/dte-void.service';
import { DteCorrectionService } from '../services/dte-correction.service';
import { DteReissueService } from '../services/dte-reissue.service';
import { voidDteSchema, correctAmountsSchema } from '@zeru/shared';

@Controller('dte')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class DteVoidController {
  constructor(
    private readonly voidService: DteVoidService,
    private readonly correctionService: DteCorrectionService,
    private readonly reissueService: DteReissueService,
  ) {}

  @Get(':id/can-void')
  @RequirePermission('invoicing', 'void-dte')
  canVoid(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.voidService.checkCanVoid(tenantId, id);
  }

  @Post(':id/void')
  @RequirePermission('invoicing', 'void-dte')
  void(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(voidDteSchema)) body: { reason: string },
  ) {
    return this.voidService.void(tenantId, userId, id, body.reason);
  }

  @Post(':id/correct-text')
  @RequirePermission('invoicing', 'void-dte')
  correctText(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(voidDteSchema)) body: { reason: string },
  ) {
    return this.correctionService.correctText(
      tenantId,
      userId,
      id,
      body.reason,
    );
  }

  @Post(':id/correct-amounts')
  @RequirePermission('invoicing', 'void-dte')
  correctAmounts(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(correctAmountsSchema)) body: any,
  ) {
    return this.correctionService.correctAmounts(tenantId, userId, id, body);
  }

  @Post(':id/reissue')
  @RequirePermission('invoicing', 'emit-dte')
  reissue(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.reissueService.reissue(tenantId, userId, id);
  }
}
