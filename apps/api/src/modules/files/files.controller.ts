import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from './files.service';
import { DocumentCategory } from '@prisma/client';

@Controller('files')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Upload a single file via multipart/form-data.
   * Returns the created Document record (without conversationId at this point).
   * The frontend should then pass documentIds when sending the chat message.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');

    const doc = await this.filesService.create(tenantId, userId, {
      name: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      sizeBytes: file.size,
    });

    return {
      id: doc.id,
      name: doc.name,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      category: doc.category,
    };
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.filesService.findAll(tenantId, {
      category: category as DocumentCategory | undefined,
      tag,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
    });
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.filesService.findById(tenantId, id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.filesService.remove(tenantId, id);
  }
}
