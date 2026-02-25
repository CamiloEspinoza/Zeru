import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  createJournalEntrySchema,
  type CreateJournalEntrySchema,
} from '@zeru/shared';
import { JournalEntriesService } from '../services/journal-entries.service';

@Controller('accounting/journal-entries')
@UseGuards(JwtAuthGuard, TenantGuard)
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
  ) {
    const query = {
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status: status as 'DRAFT' | 'POSTED' | 'VOIDED' | undefined,
    };
    return this.journalEntriesService.findAll(tenantId, query);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.journalEntriesService.findById(id, tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createJournalEntrySchema))
    body: CreateJournalEntrySchema,
  ) {
    return this.journalEntriesService.create(tenantId, body, {
      createdById: userId,
      createdVia: 'MANUAL',
    });
  }

  @Patch(':id/post')
  post(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.journalEntriesService.post(id, tenantId);
  }

  @Patch(':id/void')
  void(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.journalEntriesService.void(id, tenantId);
  }
}
