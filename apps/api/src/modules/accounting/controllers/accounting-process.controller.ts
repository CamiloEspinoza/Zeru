import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  createProcessStepSchema,
  updateProcessStepSchema,
  updateStepCompletionSchema,
  reorderStepsSchema,
  type CreateProcessStepSchema,
  type UpdateProcessStepSchema,
  type UpdateStepCompletionSchema,
  type ReorderStepsSchema,
} from '@zeru/shared';
import { AccountingProcessService } from '../services/accounting-process.service';

@Controller('accounting/process')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AccountingProcessController {
  constructor(private readonly processService: AccountingProcessService) {}

  // ─── Steps CRUD ──────────────────────────────────────────

  @Get('steps')
  listSteps(@CurrentTenant() tenantId: string) {
    return this.processService.findAllSteps(tenantId);
  }

  @Post('steps')
  createStep(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createProcessStepSchema))
    body: CreateProcessStepSchema,
  ) {
    return this.processService.createStep(tenantId, body);
  }

  @Patch('steps/reorder')
  reorderSteps(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(reorderStepsSchema))
    body: ReorderStepsSchema,
  ) {
    return this.processService.reorderSteps(tenantId, body);
  }

  @Patch('steps/:id')
  updateStep(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateProcessStepSchema))
    body: UpdateProcessStepSchema,
  ) {
    return this.processService.updateStep(id, tenantId, body);
  }

  @Delete('steps/:id')
  deleteStep(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.processService.deleteStep(id, tenantId);
  }

  @Post('steps/load-defaults')
  loadDefaults(@CurrentTenant() tenantId: string) {
    return this.processService.loadDefaultSteps(tenantId);
  }

  // ─── Progress per Period ──────────────────────────────────

  @Get('progress')
  getProgress(
    @CurrentTenant() tenantId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
  ) {
    return this.processService.getProgress(tenantId, fiscalPeriodId);
  }

  @Patch('progress/:stepId')
  updateProgress(
    @Param('stepId') stepId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateStepCompletionSchema))
    body: UpdateStepCompletionSchema,
  ) {
    return this.processService.updateStepCompletion(stepId, tenantId, userId, body);
  }
}
