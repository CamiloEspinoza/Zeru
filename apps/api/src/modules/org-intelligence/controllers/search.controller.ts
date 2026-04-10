import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { OrgSearchService } from '../services/org-search.service';

@Controller('org-intelligence/search')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SearchController {
  constructor(private readonly searchService: OrgSearchService) {}

  @Post()
  async search(
    @CurrentTenant() tenantId: string,
    @Body() body: { projectId: string; query: string; limit?: number },
  ) {
    const query = (body.query ?? '').trim();
    if (!query) {
      return { data: [] };
    }
    const safeLimit = Math.min(Math.max(body.limit ?? 10, 1), 50);
    const results = await this.searchService.search(
      tenantId,
      body.projectId,
      query,
      safeLimit,
    );
    return { data: results };
  }

  @Post('entities')
  async searchEntities(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      projectId: string;
      query: string;
      type?: string;
      limit?: number;
    },
  ) {
    const query = (body.query ?? '').trim();
    if (!query) {
      return { data: [] };
    }
    const safeLimit = Math.min(Math.max(body.limit ?? 20, 1), 50);
    const results = await this.searchService.searchEntities(
      tenantId,
      body.projectId,
      query,
      body.type,
      safeLimit,
    );
    return { data: results };
  }
}
