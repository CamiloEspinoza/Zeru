import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CertificateService } from '../certificate/certificate.service';

/** Max allowed size for .p12 files (50 KB). Typical P12 certs are 2-5 KB. */
const MAX_P12_SIZE = 50 * 1024;

/**
 * PFX/P12 files start with a SEQUENCE tag (0x30) followed by length bytes,
 * then version INTEGER (0x02 0x01 0x03 for PKCS#12 v3).
 * We check the ASN.1 SEQUENCE header as a lightweight magic-byte validation.
 */
function isP12Buffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // ASN.1 SEQUENCE tag
  return buffer[0] === 0x30;
}

@Controller('dte/certificates')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard, ThrottlerGuard)
export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  @Get()
  @SkipThrottle()
  @RequirePermission('invoicing', 'view-dte')
  list(@CurrentTenant() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post()
  @RequirePermission('invoicing', 'manage-certificate')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_P12_SIZE } }),
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

    // Size validation
    if (file.size > MAX_P12_SIZE) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido (${MAX_P12_SIZE / 1024} KB). Los certificados .p12 típicos pesan entre 2-5 KB.`,
      );
    }

    // Magic-byte validation (P12/PFX ASN.1 format)
    if (!isP12Buffer(file.buffer)) {
      throw new BadRequestException(
        'El archivo no tiene formato P12/PFX válido. Suba un certificado .p12 válido.',
      );
    }

    // Password validation
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      throw new BadRequestException(
        'La contraseña del certificado es obligatoria.',
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
  @RequirePermission('invoicing', 'manage-certificate')
  delete(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }

  @Patch(':id/set-primary')
  @RequirePermission('invoicing', 'manage-certificate')
  setPrimary(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.setPrimary(tenantId, id);
  }
}
