import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

@Injectable()
export class LabDashboardService {
  private readonly logger = new Logger(LabDashboardService.name);
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  private async cached<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    const data = await fetcher();
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  }

  // ── Status Summary ──

  async getStatusSummary(tenantId: string, dateFrom?: string, dateTo?: string) {
    const cacheKey = `status:${tenantId}:${dateFrom}:${dateTo}`;
    return this.cached(cacheKey, 30_000, () =>
      this._getStatusSummary(tenantId, dateFrom, dateTo),
    );
  }

  private async _getStatusSummary(
    tenantId: string,
    _dateFrom?: string,
    _dateTo?: string,
  ) {
    // Query 1: Report counts by status + category (current state — no date filter)
    const byStatusAndCategory: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT dr.status, sr.category, COUNT(*)::int AS count
       FROM mod_lab.lab_diagnostic_reports dr
       JOIN mod_lab.lab_service_requests sr ON sr.id = dr."serviceRequestId"
       WHERE dr."tenantId" = $1
         AND dr."deletedAt" IS NULL
       GROUP BY dr.status, sr.category`,
      tenantId,
    );

    // Query 2: Today vs yesterday vs day-before comparison
    const [comparison]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
         COUNT(*) FILTER (WHERE sr."receivedAt" >= (NOW() AT TIME ZONE 'America/Santiago')::date)::int AS "receivedToday",
         COUNT(*) FILTER (WHERE sr."receivedAt" >= ((NOW() AT TIME ZONE 'America/Santiago')::date - 1)
                                AND sr."receivedAt" < (NOW() AT TIME ZONE 'America/Santiago')::date)::int AS "receivedYesterday",
         COUNT(*) FILTER (WHERE sr."receivedAt" >= ((NOW() AT TIME ZONE 'America/Santiago')::date - 2)
                                AND sr."receivedAt" < ((NOW() AT TIME ZONE 'America/Santiago')::date - 1))::int AS "receivedDayBefore",
         COUNT(*) FILTER (WHERE dr."validatedAt" >= (NOW() AT TIME ZONE 'America/Santiago')::date)::int AS "validatedToday",
         COUNT(*) FILTER (WHERE dr."validatedAt" >= ((NOW() AT TIME ZONE 'America/Santiago')::date - 1)
                                AND dr."validatedAt" < (NOW() AT TIME ZONE 'America/Santiago')::date)::int AS "validatedYesterday",
         COUNT(*) FILTER (WHERE dr."deliveredAt" >= (NOW() AT TIME ZONE 'America/Santiago')::date)::int AS "deliveredToday",
         COUNT(*) FILTER (WHERE dr."deliveredAt" >= ((NOW() AT TIME ZONE 'America/Santiago')::date - 1)
                                AND dr."deliveredAt" < (NOW() AT TIME ZONE 'America/Santiago')::date)::int AS "deliveredYesterday"
       FROM mod_lab.lab_diagnostic_reports dr
       JOIN mod_lab.lab_service_requests sr ON sr.id = dr."serviceRequestId"
       WHERE dr."tenantId" = $1 AND dr."deletedAt" IS NULL`,
      tenantId,
    );

    // Query 3: Alert counts
    const [alerts]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
         COUNT(*) FILTER (WHERE dr."isUrgent" = true
           AND dr.status NOT IN ('DELIVERED','DOWNLOADED','CANCELLED_REPORT'))::int AS "urgentActive",
         COUNT(*) FILTER (WHERE dr."isAlteredOrCritical" = true AND dr."criticalNotified" = false
           AND dr.status NOT IN ('CANCELLED_REPORT'))::int AS "criticalUnnotified",
         COUNT(*) FILTER (WHERE dr.status NOT IN ('DELIVERED','DOWNLOADED','CANCELLED_REPORT'))::int AS "inProgress"
       FROM mod_lab.lab_diagnostic_reports dr
       WHERE dr."tenantId" = $1 AND dr."deletedAt" IS NULL`,
      tenantId,
    );

    return {
      byStatusAndCategory,
      todayVsYesterday: {
        received: {
          today: comparison.receivedToday,
          yesterday: comparison.receivedYesterday,
          dayBefore: comparison.receivedDayBefore,
        },
        validated: {
          today: comparison.validatedToday,
          yesterday: comparison.validatedYesterday,
        },
        delivered: {
          today: comparison.deliveredToday,
          yesterday: comparison.deliveredYesterday,
        },
      },
      alerts: {
        urgentActive: alerts.urgentActive,
        criticalUnnotified: alerts.criticalUnnotified,
        inProgress: alerts.inProgress,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Volume Trends ──

  async getVolumeTrends(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    granularity: string = 'day',
  ) {
    const cacheKey = `volume:${tenantId}:${dateFrom}:${dateTo}:${granularity}`;
    return this.cached(cacheKey, 60_000, () =>
      this._getVolumeTrends(tenantId, dateFrom, dateTo, granularity),
    );
  }

  private async _getVolumeTrends(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    granularity: string,
  ) {
    const gran = ['day', 'week', 'month'].includes(granularity)
      ? granularity
      : 'day';

    const series: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
         date_trunc($1, sr."receivedAt")::date AS period,
         sr.category,
         COUNT(*)::int AS received,
         COUNT(*) FILTER (WHERE dr.status IN ('VALIDATED_REPORT','SIGNED','DELIVERED','DOWNLOADED'))::int AS completed
       FROM mod_lab.lab_service_requests sr
       JOIN mod_lab.lab_diagnostic_reports dr ON dr."serviceRequestId" = sr.id
       WHERE sr."tenantId" = $2
         AND sr."receivedAt" >= $3::timestamptz
         AND sr."receivedAt" <= $4::timestamptz
         AND sr."deletedAt" IS NULL
         AND dr."deletedAt" IS NULL
       GROUP BY period, sr.category
       ORDER BY period ASC`,
      gran,
      tenantId,
      dateFrom,
      dateTo,
    );

    return { series, generatedAt: new Date().toISOString() };
  }

  // ── Turnaround ──

  async getTurnaround(tenantId: string, dateFrom?: string, dateTo?: string) {
    const cacheKey = `tat:${tenantId}:${dateFrom}:${dateTo}`;
    return this.cached(cacheKey, 300_000, () =>
      this._getTurnaround(tenantId, dateFrom, dateTo),
    );
  }

  private async _getTurnaround(
    tenantId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const df = dateFrom ?? null;
    const dt = dateTo ?? null;

    const byCategory: any[] = await this.prisma.$queryRawUnsafe(
      `WITH completed AS (
         SELECT
           sr.category,
           EXTRACT(EPOCH FROM (dr."validatedAt" - sr."receivedAt")) / 3600.0 AS tat_hours
         FROM mod_lab.lab_diagnostic_reports dr
         JOIN mod_lab.lab_service_requests sr ON sr.id = dr."serviceRequestId"
         WHERE dr."tenantId" = $1
           AND dr."validatedAt" IS NOT NULL
           AND sr."receivedAt" IS NOT NULL
           AND dr."deletedAt" IS NULL
           AND ($2::timestamptz IS NULL OR dr."validatedAt" >= $2::timestamptz)
           AND ($3::timestamptz IS NULL OR dr."validatedAt" <= $3::timestamptz)
       )
       SELECT
         category,
         COUNT(*)::int AS "sampleSize",
         ROUND(AVG(tat_hours)::numeric, 1) AS "avgHours",
         ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY tat_hours))::numeric, 1) AS "medianHours",
         ROUND((percentile_cont(0.9) WITHIN GROUP (ORDER BY tat_hours))::numeric, 1) AS "p90Hours"
       FROM completed
       GROUP BY category`,
      tenantId,
      df,
      dt,
    );

    const byStage: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
         we."eventType",
         sr.category,
         COUNT(*)::int AS "sampleSize",
         ROUND(AVG(EXTRACT(EPOCH FROM (we."occurredAt" - sr."receivedAt")) / 3600.0)::numeric, 1) AS "avgHoursFromReception"
       FROM mod_lab.lab_exam_workflow_events we
       JOIN mod_lab.lab_diagnostic_reports dr ON dr.id = we."diagnosticReportId"
       JOIN mod_lab.lab_service_requests sr ON sr.id = dr."serviceRequestId"
       WHERE we."tenantId" = $1
         AND sr."receivedAt" IS NOT NULL
         AND dr."deletedAt" IS NULL
         AND ($2::timestamptz IS NULL OR we."occurredAt" >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR we."occurredAt" <= $3::timestamptz)
         AND we."eventType" IN (
           'RECEIVED_AT_LAB','MACROSCOPY','EMBEDDING','CUTTING_STAINING',
           'HISTOLOGY_REPORTING','VALIDATION','APPROVAL','DELIVERY'
         )
       GROUP BY we."eventType", sr.category`,
      tenantId,
      df,
      dt,
    );

    return { byCategory, byStage, generatedAt: new Date().toISOString() };
  }

  // ── Financial Summary ──

  async getFinancialSummary(tenantId: string, dateFrom?: string, dateTo?: string) {
    const cacheKey = `financial:${tenantId}:${dateFrom}:${dateTo}`;
    return this.cached(cacheKey, 60_000, () =>
      this._getFinancialSummary(tenantId, dateFrom, dateTo),
    );
  }

  private async _getFinancialSummary(
    tenantId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const df = dateFrom ?? null;
    const dt = dateTo ?? null;

    // Charges by status
    const chargesByStatus: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
         status,
         COUNT(*)::int AS count,
         COALESCE(SUM(amount), 0)::numeric AS "totalAmount"
       FROM mod_lab.lab_exam_charges
       WHERE "tenantId" = $1
         AND "deletedAt" IS NULL
         AND ($2::timestamptz IS NULL OR "enteredAt" >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR "enteredAt" <= $3::timestamptz)
       GROUP BY status`,
      tenantId,
      df,
      dt,
    );

    const grandTotal = chargesByStatus.reduce(
      (sum, r) => sum + Number(r.totalAmount),
      0,
    );
    const grandCount = chargesByStatus.reduce((sum, r) => sum + r.count, 0);

    // Top 10 origins by revenue
    const topOrigins: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
         "labOriginCodeSnapshot" AS "originCode",
         COUNT(*)::int AS "chargeCount",
         COALESCE(SUM(amount), 0)::numeric AS "totalAmount"
       FROM mod_lab.lab_exam_charges
       WHERE "tenantId" = $1
         AND "deletedAt" IS NULL
         AND status != 'CANCELLED_CHARGE'
         AND ($2::timestamptz IS NULL OR "enteredAt" >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR "enteredAt" <= $3::timestamptz)
       GROUP BY "labOriginCodeSnapshot"
       ORDER BY "totalAmount" DESC
       LIMIT 10`,
      tenantId,
      df,
      dt,
    );

    // Liquidation status
    const liquidations: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT
         status,
         COUNT(*)::int AS count,
         COALESCE(SUM("totalAmount"), 0)::numeric AS "totalAmount"
       FROM mod_lab.lab_liquidations
       WHERE "tenantId" = $1
         AND "deletedAt" IS NULL
         AND ($2::timestamptz IS NULL OR period >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR period <= $3::timestamptz)
       GROUP BY status`,
      tenantId,
      df,
      dt,
    );

    return {
      charges: {
        byStatus: chargesByStatus,
        grandTotal,
        grandCount,
      },
      topOrigins,
      liquidations,
      generatedAt: new Date().toISOString(),
    };
  }
}
