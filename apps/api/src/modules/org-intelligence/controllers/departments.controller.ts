import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DepartmentsService } from '../services/departments.service';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsSchema,
  type CreateDepartmentDto,
  type UpdateDepartmentDto,
  type ListDepartmentsDto,
} from '../dto';

@Controller('org-intelligence/departments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createDepartmentSchema))
    dto: CreateDepartmentDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.departmentsService.create(tenantId, dto);
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(listDepartmentsSchema))
    query: ListDepartmentsDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.departmentsService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.departmentsService.findOne(tenantId, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDepartmentSchema))
    dto: UpdateDepartmentDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.departmentsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.departmentsService.remove(tenantId, id);
  }
}
