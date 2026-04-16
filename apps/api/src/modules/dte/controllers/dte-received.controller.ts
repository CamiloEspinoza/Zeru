import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { DteReceivedService } from '../services/dte-received.service';
import { ImapPollingService } from '../exchange/imap-polling.service';
import { SiiReclamoService, ReclamoAction } from '../sii/sii-reclamo.service';
import { DteStatus } from '@prisma/client';

@Controller('dte/received')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard, ThrottlerGuard)
export class DteReceivedController {
  constructor(
    private readonly receivedService: DteReceivedService,
    private readonly imapPolling: ImapPollingService,
    private readonly siiReclamo: SiiReclamoService,
  ) {}

  // ─── Bandeja (inbox) ──────────────────────────────────────

  @Get()
  @SkipThrottle()
  @RequirePermission('invoicing', 'view')
  list(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('pending') pending?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.receivedService.listReceived(tenantId, {
      status: status as DteStatus | undefined,
      pending: pending === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ─── Accept / Reject ─────────────────────────────────────

  @Post(':id/accept')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-received')
  accept(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.receivedService.acceptDte(tenantId, id, userId);
  }

  @Post(':id/reject')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-received')
  reject(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.receivedService.rejectDte(tenantId, id, userId, body.reason);
  }

  // ─── SII Reclamo (formal claim via SII WS) ───────────────

  @Post(':id/reclamo')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-received')
  async registerReclamo(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { action: ReclamoAction; emisorRut: string; tipoDte: number; folio: number },
  ) {
    const validActions: ReclamoAction[] = ['ACD', 'RCD', 'ERM', 'RFP', 'RFT'];
    if (!validActions.includes(body.action)) {
      throw new BadRequestException(
        `Acción de reclamo inválida: ${body.action}. Opciones: ${validActions.join(', ')}`,
      );
    }

    return this.siiReclamo.registrarReclamo(
      tenantId,
      body.emisorRut,
      body.tipoDte,
      body.folio,
      body.action,
    );
  }

  @Get(':id/reclamo-status')
  @SkipThrottle()
  @RequirePermission('invoicing', 'view')
  async getReclamoStatus(
    @CurrentTenant() tenantId: string,
    @Query('emisorRut') emisorRut: string,
    @Query('tipoDte') tipoDte: string,
    @Query('folio') folio: string,
  ) {
    if (!emisorRut || !tipoDte || !folio) {
      throw new BadRequestException(
        'Se requieren emisorRut, tipoDte y folio',
      );
    }

    return this.siiReclamo.consultarEstado(
      tenantId,
      emisorRut,
      parseInt(tipoDte, 10),
      parseInt(folio, 10),
    );
  }

  // ─── Manual Upload ────────────────────────────────────────

  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-received')
  upload(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: { xmlContent: string },
  ) {
    if (!body.xmlContent) {
      throw new BadRequestException('Se requiere xmlContent con el XML del DTE');
    }
    return this.receivedService.uploadManual(tenantId, body.xmlContent, userId);
  }

  // ─── IMAP Poll Trigger ────────────────────────────────────

  @Post('poll')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-received')
  triggerPoll(@CurrentTenant() tenantId: string) {
    return this.imapPolling.pollForNewDtes(tenantId);
  }
}
