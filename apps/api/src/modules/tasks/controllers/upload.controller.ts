import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TaskAttachmentsService } from '../services/task-attachments.service';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

@Controller('uploads')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UploadController {
  constructor(
    private readonly attachmentsService: TaskAttachmentsService,
  ) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, WebP, SVG).',
      );
    }
    return this.attachmentsService.uploadInlineImage(tenantId, userId, file);
  }
}
