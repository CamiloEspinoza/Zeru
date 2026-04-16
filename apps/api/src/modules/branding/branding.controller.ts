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
@UseGuards(JwtAuthGuard, TenantGuard)
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  async getBranding(@CurrentTenant() tenantId: string) {
    return this.brandingService.getBranding(tenantId);
  }

  @Patch()
  async updateColors(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateBrandingDto)) body: UpdateBrandingDto,
  ) {
    return this.brandingService.updateColors(tenantId, body);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandingService.uploadImage(tenantId, 'logo', file);
  }

  @Post('isotipo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1 * 1024 * 1024 } }))
  async uploadIsotipo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandingService.uploadImage(tenantId, 'isotipo', file);
  }

  @Delete('logo')
  async deleteLogo(@CurrentTenant() tenantId: string) {
    return this.brandingService.deleteImage(tenantId, 'logo');
  }

  @Delete('isotipo')
  async deleteIsotipo(@CurrentTenant() tenantId: string) {
    return this.brandingService.deleteImage(tenantId, 'isotipo');
  }

  @Post('favicon')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1 * 1024 * 1024 } }))
  async uploadFavicon(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandingService.uploadImage(tenantId, 'favicon', file);
  }

  @Delete('favicon')
  async deleteFavicon(@CurrentTenant() tenantId: string) {
    return this.brandingService.deleteImage(tenantId, 'favicon');
  }

  @Post('favicon/from-isotipo')
  async setFaviconFromIsotipo(@CurrentTenant() tenantId: string) {
    return this.brandingService.setFaviconFromIsotipo(tenantId);
  }

  @Post('favicon/generate')
  async generateFavicon(@CurrentTenant() tenantId: string) {
    return this.brandingService.generateFavicon(tenantId);
  }

  @Post('generate-palette')
  async generatePalette(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(generatePaletteDto)) body: GeneratePaletteDto,
  ) {
    return this.brandingService.generatePalette(tenantId, body);
  }

  @Post('suggest-color')
  async suggestColor(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(suggestColorDto)) body: SuggestColorDto,
  ) {
    return this.brandingService.suggestColor(tenantId, body.description);
  }
}
