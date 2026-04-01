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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { PersonProfilesService } from '../services/person-profiles.service';
import {
  createPersonProfileSchema,
  updatePersonProfileSchema,
  listPersonProfilesSchema,
  updatePersonReportsToSchema,
  orgchartQuerySchema,
  type CreatePersonProfileDto,
  type UpdatePersonProfileDto,
  type ListPersonProfilesDto,
  type UpdatePersonReportsToDto,
  type OrgchartQueryDto,
} from '../dto';

@Controller('org-intelligence/persons')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PersonProfilesController {
  constructor(
    private readonly personProfilesService: PersonProfilesService,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createPersonProfileSchema)) dto: CreatePersonProfileDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.personProfilesService.create(tenantId, dto);
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(listPersonProfilesSchema)) query: ListPersonProfilesDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.personProfilesService.findAll(tenantId, query);
  }

  @Get('orgchart')
  async getOrgchart(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(orgchartQuerySchema)) query: OrgchartQueryDto,
  ) {
    return this.personProfilesService.getOrgchart(tenantId, query.rootId, query.depth);
  }

  @Get('departments')
  async getDepartments(@CurrentTenant() tenantId: string) {
    return this.personProfilesService.getDepartments(tenantId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.personProfilesService.findOne(tenantId, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePersonProfileSchema)) dto: UpdatePersonProfileDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.personProfilesService.update(tenantId, id, dto);
  }

  @Patch(':id/reports-to')
  async updateReportsTo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePersonReportsToSchema))
    dto: UpdatePersonReportsToDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.personProfilesService.updateReportsTo(
      tenantId,
      id,
      dto.reportsToId,
    );
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.personProfilesService.remove(tenantId, id);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo de imagen');
    return this.personProfilesService.uploadAvatar(tenantId, id, file);
  }

  @Get(':id/avatar')
  async getAvatarUrl(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.personProfilesService.getAvatarUrl(tenantId, id);
  }
}
