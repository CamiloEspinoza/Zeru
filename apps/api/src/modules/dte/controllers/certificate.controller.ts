import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CertificateService } from '../certificate/certificate.service';

@Controller('dte/certificates')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  @Get()
  @RequirePermission('invoicing', 'view-config')
  list(@CurrentTenant() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post()
  @RequirePermission('invoicing', 'manage-config')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('password') password: string,
    @Body('isPrimary') isPrimary: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No se recibió el archivo de certificado (.p12)',
      );
    }
    return this.service.upload(
      tenantId,
      file.buffer,
      password,
      isPrimary === 'true',
    );
  }

  @Delete(':id')
  @RequirePermission('invoicing', 'manage-config')
  delete(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }
}
