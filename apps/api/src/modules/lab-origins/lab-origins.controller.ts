import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as XLSX from 'xlsx';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import {
  createLabOriginSchema, updateLabOriginSchema,
  type CreateLabOriginSchema, type UpdateLabOriginSchema,
} from '@zeru/shared';
import { LabOriginsService } from './lab-origins.service';

@Controller('lab-origins')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabOriginsController {
  constructor(private readonly service: LabOriginsService) {}

  @Get()
  @RequirePermission('lab-origins', 'view')
  list(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get('export')
  @RequirePermission('lab-origins', 'export')
  async export(
    @CurrentTenant() tenantId: string,
    @Query('format') format: string = 'xlsx',
    @Res() res: Response,
  ) {
    const origins = await this.service.findAll(tenantId);

    const rows = origins.map((o: any) => ({
      Código: o.code,
      Nombre: o.name,
      Categoría: o.category,
      Cliente: o.legalEntity?.legalName ?? '',
      'RUT Cliente': o.legalEntity?.rut ?? '',
      Convenio: o.billingAgreement?.name ?? '',
      'Código Convenio': o.billingAgreement?.code ?? '',
      Procedencia_Padre: o.parent?.name ?? '',
      Comuna: o.commune ?? '',
      Ciudad: o.city ?? '',
      Teléfono: o.phone ?? '',
      Email: o.email ?? '',
      'Modo Recepción': o.sampleReceptionMode ?? '',
      'Entrega Informe': (o.reportDeliveryMethods ?? []).join(', '),
      'Días Biopsia': o.deliveryDaysBiopsy ?? '',
      'Días PAP': o.deliveryDaysPap ?? '',
      'Envía QC': o.sendsQualityReports ? 'Sí' : 'No',
      Estado: o.isActive ? 'Activa' : 'Inactiva',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Procedencias');

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="procedencias.csv"');
      res.send(csv);
      return;
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="procedencias.xlsx"');
    res.send(buf);
  }

  @Get(':id')
  @RequirePermission('lab-origins', 'view')
  getOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  @RequirePermission('lab-origins', 'write')
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createLabOriginSchema)) body: CreateLabOriginSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  @RequirePermission('lab-origins', 'write')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateLabOriginSchema)) body: UpdateLabOriginSchema,
  ) {
    return this.service.update(id, tenantId, body);
  }

  @Delete(':id')
  @RequirePermission('lab-origins', 'write')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.delete(id, tenantId);
  }
}
