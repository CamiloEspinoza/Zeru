import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, PrismaClient } from '@prisma/client';

@Controller('dte/reports')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard, ThrottlerGuard)
export class DteReportsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Get a tenant-scoped Prisma client. */
  private tenantDb(tenantId: string): PrismaClient {
    return this.prisma.forTenant(tenantId) as unknown as PrismaClient;
  }

  /**
   * GET /dte/reports/iva-summary?from=YYYY-MM&to=YYYY-MM
   *
   * Returns IVA summary: IVA Debito (ventas) - IVA Credito (compras) = IVA por pagar
   */
  @Get('iva-summary')
  @SkipThrottle()
  @RequirePermission('invoicing', 'view-reports')
  async ivaSummary(
    @CurrentTenant() tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const { startDate, endDate } = this.parseMonthRange(from, to);
    const db = this.tenantDb(tenantId);

    const result = await db.$queryRaw<
      Array<{
        direction: string;
        total_neto: string;
        total_exento: string;
        total_iva: string;
        total_monto: string;
        doc_count: string;
      }>
    >(
      Prisma.sql`
        SELECT
          direction::text,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoNeto"
            ELSE "montoNeto"
          END), 0)::text AS total_neto,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoExento"
            ELSE "montoExento"
          END), 0)::text AS total_exento,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -iva
            ELSE iva
          END), 0)::text AS total_iva,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoTotal"
            ELSE "montoTotal"
          END), 0)::text AS total_monto,
          COUNT(*)::text AS doc_count
        FROM dtes
        WHERE "tenantId" = ${tenantId}
          AND "fechaEmision" >= ${startDate}::date
          AND "fechaEmision" < ${endDate}::date
          AND status IN ('SIGNED', 'SENT', 'ACCEPTED', 'ACCEPTED_WITH_OBJECTION')
          AND "deletedAt" IS NULL
        GROUP BY direction
      `,
    );

    const emitted = result.find((r: (typeof result)[number]) => r.direction === 'EMITTED');
    const received = result.find((r: (typeof result)[number]) => r.direction === 'RECEIVED');

    const ivaDebito = Number(emitted?.total_iva ?? 0);
    const ivaCredito = Number(received?.total_iva ?? 0);

    return {
      period: { from, to },
      emitted: {
        neto: Number(emitted?.total_neto ?? 0),
        exento: Number(emitted?.total_exento ?? 0),
        iva: ivaDebito,
        total: Number(emitted?.total_monto ?? 0),
        count: Number(emitted?.doc_count ?? 0),
      },
      received: {
        neto: Number(received?.total_neto ?? 0),
        exento: Number(received?.total_exento ?? 0),
        iva: ivaCredito,
        total: Number(received?.total_monto ?? 0),
        count: Number(received?.doc_count ?? 0),
      },
      ivaDebito,
      ivaCredito,
      ivaPorPagar: ivaDebito - ivaCredito,
    };
  }

  /**
   * GET /dte/reports/sales-book?month=YYYY-MM
   *
   * Libro de ventas: all emitted DTEs for the month, grouped by type.
   */
  @Get('sales-book')
  @SkipThrottle()
  @RequirePermission('invoicing', 'view-reports')
  async salesBook(
    @CurrentTenant() tenantId: string,
    @Query('month') month: string,
  ) {
    const { startDate, endDate } = this.parseMonth(month);
    const db = this.tenantDb(tenantId);

    const entries = await db.$queryRaw<
      Array<{
        id: string;
        dte_type: string;
        folio: number;
        fecha_emision: Date;
        receptor_rut: string | null;
        receptor_razon: string | null;
        monto_exento: string;
        monto_neto: string;
        iva: string;
        monto_total: string;
      }>
    >(
      Prisma.sql`
        SELECT
          id,
          "dteType"::text AS dte_type,
          folio,
          "fechaEmision" AS fecha_emision,
          "receptorRut" AS receptor_rut,
          "receptorRazon" AS receptor_razon,
          "montoExento"::text AS monto_exento,
          "montoNeto"::text AS monto_neto,
          iva::text,
          "montoTotal"::text AS monto_total
        FROM dtes
        WHERE "tenantId" = ${tenantId}
          AND direction = 'EMITTED'
          AND "fechaEmision" >= ${startDate}::date
          AND "fechaEmision" < ${endDate}::date
          AND status IN ('SIGNED', 'SENT', 'ACCEPTED', 'ACCEPTED_WITH_OBJECTION')
          AND "deletedAt" IS NULL
        ORDER BY "fechaEmision", folio
      `,
    );

    const summary = await db.$queryRaw<
      Array<{
        dte_type: string;
        doc_count: string;
        total_exento: string;
        total_neto: string;
        total_iva: string;
        total_monto: string;
      }>
    >(
      Prisma.sql`
        SELECT
          "dteType"::text AS dte_type,
          COUNT(*)::text AS doc_count,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoExento"
            ELSE "montoExento"
          END), 0)::text AS total_exento,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoNeto"
            ELSE "montoNeto"
          END), 0)::text AS total_neto,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -iva
            ELSE iva
          END), 0)::text AS total_iva,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoTotal"
            ELSE "montoTotal"
          END), 0)::text AS total_monto
        FROM dtes
        WHERE "tenantId" = ${tenantId}
          AND direction = 'EMITTED'
          AND "fechaEmision" >= ${startDate}::date
          AND "fechaEmision" < ${endDate}::date
          AND status IN ('SIGNED', 'SENT', 'ACCEPTED', 'ACCEPTED_WITH_OBJECTION')
          AND "deletedAt" IS NULL
        GROUP BY "dteType"
        ORDER BY "dteType"
      `,
    );

    return {
      month,
      entries: entries.map((e: (typeof entries)[number]) => ({
        ...e,
        monto_exento: Number(e.monto_exento),
        monto_neto: Number(e.monto_neto),
        iva: Number(e.iva),
        monto_total: Number(e.monto_total),
      })),
      summary: summary.map((s: (typeof summary)[number]) => ({
        dteType: s.dte_type,
        count: Number(s.doc_count),
        exento: Number(s.total_exento),
        neto: Number(s.total_neto),
        iva: Number(s.total_iva),
        total: Number(s.total_monto),
      })),
    };
  }

  /**
   * GET /dte/reports/purchase-book?month=YYYY-MM
   *
   * Libro de compras: all received DTEs for the month, grouped by type.
   */
  @Get('purchase-book')
  @SkipThrottle()
  @RequirePermission('invoicing', 'view-reports')
  async purchaseBook(
    @CurrentTenant() tenantId: string,
    @Query('month') month: string,
  ) {
    const { startDate, endDate } = this.parseMonth(month);
    const db = this.tenantDb(tenantId);

    const entries = await db.$queryRaw<
      Array<{
        id: string;
        dte_type: string;
        folio: number;
        fecha_emision: Date;
        emisor_rut: string;
        emisor_razon: string;
        monto_exento: string;
        monto_neto: string;
        iva: string;
        monto_total: string;
      }>
    >(
      Prisma.sql`
        SELECT
          id,
          "dteType"::text AS dte_type,
          folio,
          "fechaEmision" AS fecha_emision,
          "emisorRut" AS emisor_rut,
          "emisorRazon" AS emisor_razon,
          "montoExento"::text AS monto_exento,
          "montoNeto"::text AS monto_neto,
          iva::text,
          "montoTotal"::text AS monto_total
        FROM dtes
        WHERE "tenantId" = ${tenantId}
          AND direction = 'RECEIVED'
          AND "fechaEmision" >= ${startDate}::date
          AND "fechaEmision" < ${endDate}::date
          AND status IN ('SIGNED', 'SENT', 'ACCEPTED', 'ACCEPTED_WITH_OBJECTION')
          AND "deletedAt" IS NULL
        ORDER BY "fechaEmision", folio
      `,
    );

    const summary = await db.$queryRaw<
      Array<{
        dte_type: string;
        doc_count: string;
        total_exento: string;
        total_neto: string;
        total_iva: string;
        total_monto: string;
      }>
    >(
      Prisma.sql`
        SELECT
          "dteType"::text AS dte_type,
          COUNT(*)::text AS doc_count,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoExento"
            ELSE "montoExento"
          END), 0)::text AS total_exento,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoNeto"
            ELSE "montoNeto"
          END), 0)::text AS total_neto,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -iva
            ELSE iva
          END), 0)::text AS total_iva,
          COALESCE(SUM(CASE
            WHEN "dteType" = 'NOTA_CREDITO_ELECTRONICA' THEN -"montoTotal"
            ELSE "montoTotal"
          END), 0)::text AS total_monto
        FROM dtes
        WHERE "tenantId" = ${tenantId}
          AND direction = 'RECEIVED'
          AND "fechaEmision" >= ${startDate}::date
          AND "fechaEmision" < ${endDate}::date
          AND status IN ('SIGNED', 'SENT', 'ACCEPTED', 'ACCEPTED_WITH_OBJECTION')
          AND "deletedAt" IS NULL
        GROUP BY "dteType"
        ORDER BY "dteType"
      `,
    );

    return {
      month,
      entries: entries.map((e: (typeof entries)[number]) => ({
        ...e,
        monto_exento: Number(e.monto_exento),
        monto_neto: Number(e.monto_neto),
        iva: Number(e.iva),
        monto_total: Number(e.monto_total),
      })),
      summary: summary.map((s: (typeof summary)[number]) => ({
        dteType: s.dte_type,
        count: Number(s.doc_count),
        exento: Number(s.total_exento),
        neto: Number(s.total_neto),
        iva: Number(s.total_iva),
        total: Number(s.total_monto),
      })),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private parseMonth(month: string): { startDate: string; endDate: string } {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'El parametro "month" es requerido y debe tener formato YYYY-MM',
      );
    }
    const [year, m] = month.split('-').map(Number);
    const startDate = `${year}-${String(m).padStart(2, '0')}-01`;
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    return { startDate, endDate };
  }

  private parseMonthRange(
    from: string,
    to: string,
  ): { startDate: string; endDate: string } {
    if (!from || !/^\d{4}-\d{2}$/.test(from)) {
      throw new BadRequestException(
        'El parametro "from" es requerido y debe tener formato YYYY-MM',
      );
    }
    if (!to || !/^\d{4}-\d{2}$/.test(to)) {
      throw new BadRequestException(
        'El parametro "to" es requerido y debe tener formato YYYY-MM',
      );
    }

    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);

    const startDate = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`;
    const nextMonth = toMonth === 12 ? 1 : toMonth + 1;
    const nextYear = toMonth === 12 ? toYear + 1 : toYear;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    return { startDate, endDate };
  }
}
