import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  async getEvents(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('sources') sources: string | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    const sourceList = sources
      ? sources.split(',').map((s) => s.trim())
      : ['linkedin', 'interviews', 'accounting'];

    const events = await this.calendarService.getEvents(
      tenantId,
      new Date(from),
      new Date(to),
      sourceList,
    );

    return { data: events };
  }
}
