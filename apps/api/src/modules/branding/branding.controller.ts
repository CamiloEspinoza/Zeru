import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BrandingService } from './branding.service';
import {
  updateBrandingDto,
  generatePaletteDto,
  suggestColorDto,
  UpdateBrandingDto,
  GeneratePaletteDto,
  SuggestColorDto,
} from './dto';

@Controller('tenants/current/branding')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  async getBranding(@CurrentTenant() tenantId: string) {
    return this.brandingService.getBranding(tenantId);
  }

  @Patch()
  @RequirePermission('settings', 'manage-org')
  async updateColors(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateBrandingDto)) body: UpdateBrandingDto,
  ) {
    return this.brandingService.updateColors(tenantId, body);
  }

  @Post('logo')
  @RequirePermission('settings', 'manage-org')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandingService.uploadImage(tenantId, 'logo', file);
  }

  @Post('isotipo')
  @RequirePermission('settings', 'manage-org')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1 * 1024 * 1024 } }))
  async uploadIsotipo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandingService.uploadImage(tenantId, 'isotipo', file);
  }

  @Delete('logo')
  @RequirePermission('settings', 'manage-org')
  async deleteLogo(@CurrentTenant() tenantId: string) {
    return this.brandingService.deleteImage(tenantId, 'logo');
  }

  @Delete('isotipo')
  @RequirePermission('settings', 'manage-org')
  async deleteIsotipo(@CurrentTenant() tenantId: string) {
    return this.brandingService.deleteImage(tenantId, 'isotipo');
  }

  @Post('favicon')
  @RequirePermission('settings', 'manage-org')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1 * 1024 * 1024 } }))
  async uploadFavicon(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandingService.uploadImage(tenantId, 'favicon', file);
  }

  @Delete('favicon')
  @RequirePermission('settings', 'manage-org')
  async deleteFavicon(@CurrentTenant() tenantId: string) {
    return this.brandingService.deleteImage(tenantId, 'favicon');
  }

  @Post('favicon/from-isotipo')
  @RequirePermission('settings', 'manage-org')
  async setFaviconFromIsotipo(@CurrentTenant() tenantId: string) {
    return this.brandingService.setFaviconFromIsotipo(tenantId);
  }

  @Post('favicon/generate')
  @RequirePermission('settings', 'manage-org')
  async generateFavicon(@CurrentTenant() tenantId: string) {
    return this.brandingService.generateFavicon(tenantId);
  }

  @Post('generate-palette')
  @RequirePermission('settings', 'manage-org')
  async generatePalette(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(generatePaletteDto)) body: GeneratePaletteDto,
  ) {
    return this.brandingService.generatePalette(tenantId, body);
  }

  @Post('suggest-color')
  @RequirePermission('settings', 'manage-org')
  async suggestColor(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(suggestColorDto)) body: SuggestColorDto,
  ) {
    return this.brandingService.suggestColor(tenantId, body.description);
  }
}
