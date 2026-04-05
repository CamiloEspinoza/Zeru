import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FmImportService } from '../services/fm-import.service';

@Controller('filemaker/import')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FmImportController {
  constructor(private readonly importService: FmImportService) {}

  @Post('procedencias')
  @HttpCode(HttpStatus.ACCEPTED)
  importProcedencias(@CurrentTenant() tenantId: string) {
    return this.importService.startImportProcedencias(tenantId);
  }
}
