import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { MemoryService } from '../services/memory.service';
import { updateMemorySchema, type UpdateMemoryDto } from '../dto';

@Controller('ai/memory')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  /**
   * GET /api/ai/memory
   * Lists all active memories for the current tenant.
   * Optional query param `scope=user` to filter only personal memories.
   */
  @Get()
  async list(
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
    @Query('scope') scope?: 'tenant' | 'user' | 'all',
  ) {
    const userId = req.user.userId;

    const effectiveIncludeUser = scope !== 'tenant';
    const effectiveUserId = scope === 'tenant' ? null : userId;

    return this.memoryService.list({
      tenantId,
      userId: effectiveUserId,
      includeUserScope: effectiveIncludeUser,
      limit: 100,
    });
  }

  /**
   * PATCH /api/ai/memory/:id
   * Updates the content, category, or importance of a memory.
   */
  @Patch(':id')
  async update(
    @Param('id') memoryId: string,
    @Body(new ZodValidationPipe(updateMemorySchema)) body: UpdateMemoryDto,
    @CurrentTenant() tenantId: string,
  ) {
    const updated = await this.memoryService.update({
      memoryId,
      tenantId,
      content: body.content,
      category: body.category as any,
      importance: body.importance,
    });

    if (!updated) throw new NotFoundException('Memoria no encontrada');
    return updated;
  }

  /**
   * DELETE /api/ai/memory/:id
   * Soft-deletes a memory (sets isActive=false).
   */
  @Delete(':id')
  async delete(
    @Param('id') memoryId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const deleted = await this.memoryService.delete(memoryId, tenantId);
    if (!deleted) throw new NotFoundException('Memoria no encontrada');
    return { deleted: true };
  }
}
