import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DteEmissionService } from '../services/dte-emission.service';
import { DteDraftService } from '../services/dte-draft.service';
import { DteService } from '../services/dte.service';
import { DtePdfService } from '../services/dte-pdf.service';
import { ReceptorLookupService } from '../services/receptor-lookup.service';
import {
  emitDteSchema,
  updateDteDraftSchema,
  type EmitDteSchema,
  type UpdateDteDraftSchema,
} from '@zeru/shared';

@Controller('dte')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard, ThrottlerGuard)
export class DteController {
  constructor(
    private readonly emissionService: DteEmissionService,
    private readonly draftService: DteDraftService,
    private readonly dteService: DteService,
    private readonly dtePdfService: DtePdfService,
    private readonly receptorLookup: ReceptorLookupService,
  ) {}

  // ─── Emission ─────────────────────────────────────────────

  @Post()
  @RequirePermission('invoicing', 'emit-dte')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  emit(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(emitDteSchema)) body: EmitDteSchema,
  ) {
    return this.emissionService.emit(tenantId, userId, body);
  }

  // ─── Drafts ───────────────────────────────────────────────

  @Post('draft')
  @RequirePermission('invoicing', 'emit-dte')
  createDraft(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(emitDteSchema)) body: EmitDteSchema,
  ) {
    return this.draftService.create(tenantId, userId, body);
  }

  @Put('draft/:id')
  @RequirePermission('invoicing', 'emit-dte')
  updateDraft(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDteDraftSchema))
    body: UpdateDteDraftSchema,
  ) {
    return this.draftService.update(tenantId, id, body);
  }

  @Delete('draft/:id')
  @RequirePermission('invoicing', 'emit-dte')
  deleteDraft(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.draftService.delete(tenantId, id);
  }

  @Post('draft/:id/emit')
  @RequirePermission('invoicing', 'emit-dte')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  emitFromDraft(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.emissionService.emitFromDraft(tenantId, userId, id);
  }

  // ─── Queries ──────────────────────────────────────────────

  @Get()
  @SkipThrottle()
  @RequirePermission('invoicing', 'view')
  list(
    @CurrentTenant() tenantId: string,
    @Query('dteType') dteType?: string,
    @Query('status') status?: string,
    @Query('direction') direction?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dteService.list(tenantId, {
      dteType: dteType as any,
      status: status as any,
      direction: direction as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('receptor/lookup')
  @SkipThrottle()
  @RequirePermission('invoicing', 'view')
  lookupReceptor(
    @CurrentTenant() tenantId: string,
    @Query('rut') rut: string,
  ) {
    return this.receptorLookup.lookup(tenantId, rut);
  }

  @Get(':id/pdf')
  @SkipThrottle()
  @RequirePermission('invoicing', 'view')
  async downloadPdf(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.dtePdfService.generatePdf(
      tenantId,
      id,
      format === 'thermal' ? 'thermal' : 'standard',
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="DTE-${id}.pdf"`,
    });
    res.send(pdfBuffer);
  }

  @Get(':id/xml')
  @SkipThrottle()
  @RequirePermission('invoicing', 'view')
  async downloadXml(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const dte = await this.dteService.getById(tenantId, id);
    if (!dte.xmlContent) {
      throw new BadRequestException('Este DTE aún no tiene XML generado');
    }
    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="DTE-${dte.folio}.xml"`,
    });
    res.send(dte.xmlContent);
  }

  @Post(':id/public-link')
  @RequirePermission('invoicing', 'view-dte')
  generatePublicLink(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.dteService.generatePublicLink(tenantId, id);
  }

  @Get(':id')
  @SkipThrottle()
  @RequirePermission('invoicing', 'view')
  getById(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.dteService.getById(tenantId, id);
  }
}
