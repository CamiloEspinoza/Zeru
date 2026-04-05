import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { FmDiscoveryService } from '../services/fm-discovery.service';
import { fmSearchSchema, type FmSearchDto } from '../dto';

@Controller('filemaker/discovery')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@RequirePermission('settings', 'manage')
export class FmDiscoveryController {
  constructor(private readonly discovery: FmDiscoveryService) {}

  @Get('databases')
  async listDatabases() {
    return this.discovery.listDatabases();
  }

  @Get('test-connection/:database')
  async testConnection(@Param('database') database: string) {
    return this.discovery.testConnection(database);
  }

  @Get(':database/layouts')
  async listLayouts(@Param('database') database: string) {
    return this.discovery.listLayouts(database);
  }

  @Get(':database/layouts/:layout/metadata')
  async getLayoutMetadata(
    @Param('database') database: string,
    @Param('layout') layout: string,
  ) {
    return this.discovery.getLayoutFields(database, layout);
  }

  @Get(':database/layouts/:layout/sample')
  async sampleRecords(
    @Param('database') database: string,
    @Param('layout') layout: string,
    @Query('limit') limit?: string,
  ) {
    return this.discovery.sampleRecords(database, layout, Math.min(limit ? parseInt(limit, 10) : 10, 100));
  }

  @Post(':database/layouts/:layout/search')
  async searchRecords(
    @Param('database') database: string,
    @Param('layout') layout: string,
    @Body(new ZodValidationPipe(fmSearchSchema)) body: FmSearchDto,
  ) {
    return this.discovery.searchRecords(database, layout, body.query, {
      offset: body.offset,
      limit: body.limit,
      sort: body.sort,
    });
  }

  @Get(':database/scripts')
  async listScripts(@Param('database') database: string) {
    return this.discovery.listScripts(database);
  }
}
