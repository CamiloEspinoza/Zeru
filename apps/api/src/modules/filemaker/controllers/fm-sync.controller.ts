import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FmSyncService } from '../services/fm-sync.service';

@Controller('filemaker/sync')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FmSyncController {
  constructor(private readonly sync: FmSyncService) {}

  @Get('stats')
  async getStats(@CurrentTenant() tenantId: string) {
    return this.sync.getStats(tenantId);
  }

  @Get('errors')
  async getErrors(@CurrentTenant() tenantId: string) {
    return this.sync.getErrors(tenantId);
  }

  @Get('logs')
  async getLogs(@CurrentTenant() tenantId: string) {
    return this.sync.getRecentLogs(tenantId);
  }

  @Post('retry/:id')
  async retrySingle(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    // Reset error status to pending for manual retry
    const record = await this.sync['prisma'].fmSyncRecord.updateMany({
      where: { id, tenantId, syncStatus: 'ERROR' },
      data: { syncStatus: 'PENDING_TO_FM', retryCount: 0, syncError: null },
    });
    return { updated: record.count };
  }
}
