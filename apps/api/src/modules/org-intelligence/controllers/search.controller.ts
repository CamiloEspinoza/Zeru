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
  search(
    @CurrentTenant() tenantId: string,
    @Body() body: { projectId: string; query: string; limit?: number },
  ) {
    return this.searchService.search(
      tenantId,
      body.projectId,
      body.query,
      body.limit,
    );
  }

  @Post('entities')
  searchEntities(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      projectId: string;
      query: string;
      type?: string;
      limit?: number;
    },
  ) {
    return this.searchService.searchEntities(
      tenantId,
      body.projectId,
      body.query,
      body.type,
      body.limit,
    );
  }
}
