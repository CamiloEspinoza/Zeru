import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { OrgImprovementsService } from '../services/org-improvements.service';
import {
  createImprovementSchema,
  updateImprovementSchema,
  type CreateImprovementDto,
  type UpdateImprovementDto,
} from '../dto';

@Controller('org-intelligence/improvements')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ImprovementsController {
  constructor(private readonly improvements: OrgImprovementsService) {}

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createImprovementSchema))
    dto: CreateImprovementDto,
  ) {
    return this.improvements.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.improvements.findAll(tenantId, projectId);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.improvements.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateImprovementSchema))
    dto: UpdateImprovementDto,
  ) {
    return this.improvements.update(tenantId, id, dto);
  }
}
