import {
  ForbiddenException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyScopeGuard } from '../../common/guards/api-key-scope.guard';
import { RequireScope } from '../../common/decorators/require-scope.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JournalEntriesService } from '../accounting/services/journal-entries.service';
import { ApiKeyThrottlerGuard } from './api-key-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createBatchJournalEntriesSchema,
  type CreateBatchJournalEntriesSchema,
  createJournalEntrySchema,
  type CreateJournalEntrySchema,
} from '@zeru/shared';

@Controller('v1/journal-entries')
@UseGuards(ApiKeyGuard, ApiKeyScopeGuard, ApiKeyThrottlerGuard)
@Throttle({ default: { ttl: 60_000, limit: 100 } })
export class V1JournalEntriesController {
  constructor(private readonly journalEntries: JournalEntriesService) {}

  @Get()
  @RequireScope('journal-entries:read')
  async list(
    @CurrentTenant() tenantId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.journalEntries.findAll(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status: status as 'DRAFT' | 'POSTED' | 'VOIDED' | undefined,
    });
    return {
      object: 'list',
      data: result.data,
      total: result.meta.total,
      has_more: result.meta.page * result.meta.perPage < result.meta.total,
    };
  }

  @Get(':id')
  @RequireScope('journal-entries:read')
  async getOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const data = await this.journalEntries.findById(id, tenantId);
    return { object: 'journal_entry', ...data };
  }

  @Post()
  @RequireScope('journal-entries:write')
  async create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createJournalEntrySchema))
    body: CreateJournalEntrySchema,
  ) {
    const data = await this.journalEntries.create(tenantId, body, {
      createdVia: 'MANUAL',
    });
    return { object: 'journal_entry', ...data };
  }

  @Post('batch')
  @RequireScope('journal-entries:write')
  async createBatch(
    @CurrentTenant() tenantId: string,
    @Request() req: { apiKeyScopes?: string[] },
    @Body(new ZodValidationPipe(createBatchJournalEntriesSchema))
    body: CreateBatchJournalEntriesSchema,
  ) {
    if (body.auto_post && !(req.apiKeyScopes ?? []).includes('journal-entries:manage')) {
      throw new ForbiddenException(
        'Se requiere el scope journal-entries:manage para usar auto_post=true',
      );
    }

    const result = await this.journalEntries.createBatch(tenantId, body.entries, {
      autoPost: body.auto_post ?? false,
      meta: { createdVia: 'MANUAL' },
    });

    return { object: 'batch_result', ...result };
  }

  @Post(':id/post')
  @HttpCode(200)
  @RequireScope('journal-entries:manage')
  async post(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const data = await this.journalEntries.post(id, tenantId);
    return { object: 'journal_entry', ...data };
  }

  @Post(':id/void')
  @HttpCode(200)
  @RequireScope('journal-entries:manage')
  async void(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const data = await this.journalEntries.void(id, tenantId);
    return { object: 'journal_entry', ...data };
  }
}
