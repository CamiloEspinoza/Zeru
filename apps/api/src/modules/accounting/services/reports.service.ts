import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IncomeStatementRow, IncomeStatementEntryRow } from '@zeru/shared';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async trialBalance(tenantId: string, fiscalPeriodId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: fiscalPeriodId, tenantId },
    });

    if (!period) {
      throw new NotFoundException(
        `Fiscal period with id ${fiscalPeriodId} not found`,
      );
    }

    const result = await this.prisma.$queryRaw<
      Array<{
        account_id: string;
        code: string;
        name: string;
        type: string;
        period_debits: string;
        period_credits: string;
        balance: string;
      }>
    >(
      Prisma.sql`
        WITH movements AS (
          SELECT
            a.id AS account_id,
            a.code,
            a.name,
            a.type,
            SUM(COALESCE(jel.debit, 0))::numeric(18,2) AS period_debits,
            SUM(COALESCE(jel.credit, 0))::numeric(18,2) AS period_credits
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.id = jel."journalEntryId"
          JOIN accounts a ON a.id = jel."accountId"
          WHERE je."tenantId" = ${tenantId}
            AND je.status = 'POSTED'
            AND je."fiscalPeriodId" = ${fiscalPeriodId}
          GROUP BY a.id, a.code, a.name, a.type
        )
        SELECT
          account_id,
          code,
          name,
          type,
          period_debits::text,
          period_credits::text,
          CASE
            WHEN type IN ('ASSET', 'EXPENSE')
              THEN (period_debits - period_credits)::numeric(18,2)::text
            ELSE
              (period_credits - period_debits)::numeric(18,2)::text
          END AS balance
        FROM movements
        ORDER BY code
      `,
    );

    return result;
  }

  async incomeStatement(
    tenantId: string,
    opts: { fiscalPeriodId?: string; year?: number },
  ) {
    let startDate: Date;
    let endDate: Date;

    if (opts.fiscalPeriodId) {
      const period = await this.prisma.fiscalPeriod.findFirst({
        where: { id: opts.fiscalPeriodId, tenantId },
      });
      if (!period)
        throw new NotFoundException(
          `Fiscal period ${opts.fiscalPeriodId} not found`,
        );
      startDate = period.startDate;
      endDate = new Date(period.endDate);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      const year = opts.year ?? new Date().getFullYear();
      startDate = new Date(`${year}-01-01`);
      endDate = new Date(`${year + 1}-01-01`);
    }

    // Recursive CTE to inherit ifrsSection from the nearest ancestor that has it set.
    // This allows leaf accounts (with ifrsSection=NULL) to inherit from their parent branch.
    const result = await this.prisma.$queryRaw<IncomeStatementRow[]>(
      Prisma.sql`
        WITH RECURSIVE account_ancestors AS (
          -- Base: every REVENUE/EXPENSE account in this tenant
          SELECT
            a.id,
            a.code,
            a.name,
            a.type,
            a."parentId",
            a."ifrsSection"
          FROM accounts a
          WHERE a."tenantId" = ${tenantId}
            AND a.type IN ('REVENUE', 'EXPENSE')
          UNION ALL
          -- Walk up to parent to find the nearest set ifrsSection
          SELECT
            child.id,
            child.code,
            child.name,
            child.type,
            parent.id AS "parentId",
            parent."ifrsSection"
          FROM accounts child
          JOIN accounts parent ON parent.id = child."parentId"
          JOIN account_ancestors aa ON aa.id = child.id
          WHERE aa."ifrsSection" IS NULL
            AND parent."tenantId" = ${tenantId}
        ),
        -- Deduplicate: for each account keep the row that has ifrsSection (prefer non-null)
        resolved_sections AS (
          SELECT DISTINCT ON (id)
            id,
            "ifrsSection"
          FROM account_ancestors
          ORDER BY id, "ifrsSection" NULLS LAST
        ),
        movements AS (
          SELECT
            a.id AS account_id,
            a.code,
            a.name,
            a.type,
            a."parentId" AS parent_id,
            rs."ifrsSection" AS ifrs_section,
            CASE
              WHEN a.type = 'REVENUE'
                THEN (SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0)))
              ELSE
                (SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0)))
            END AS balance_num
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.id = jel."journalEntryId"
          JOIN accounts a ON a.id = jel."accountId"
          LEFT JOIN resolved_sections rs ON rs.id = a.id
          WHERE je."tenantId" = ${tenantId}
            AND je.status = 'POSTED'
            AND je.date >= ${startDate}
            AND je.date < ${endDate}
            AND a.type IN ('REVENUE', 'EXPENSE')
          GROUP BY a.id, a.code, a.name, a.type, a."parentId", rs."ifrsSection"
        )
        SELECT
          account_id,
          code,
          name,
          type,
          parent_id,
          COALESCE(ifrs_section::text, '') AS ifrs_section,
          balance_num::numeric(18,2)::text AS balance
        FROM movements
        ORDER BY code
      `,
    );

    return result;
  }

  /** Estado de resultados con un mes/período por columna para el año dado */
  async incomeStatementByMonth(tenantId: string, year: number) {
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);

    const periods = await this.prisma.fiscalPeriod.findMany({
      where: {
        tenantId,
        startDate: { gte: startOfYear, lte: endOfYear },
      },
      orderBy: { startDate: 'asc' },
      select: { id: true, name: true },
    });

    if (periods.length === 0) {
      return { periods: [], rows: [] };
    }

    const periodIds = periods.map((p) => p.id);
    const rowsByPeriod: IncomeStatementRow[][] = [];

    for (const period of periods) {
      const rows = await this.incomeStatement(tenantId, {
        fiscalPeriodId: period.id,
      });
      rowsByPeriod.push(rows);
    }

    const accountMap = new Map<
      string,
      { account_id: string; code: string; name: string; type: string; parent_id: string | null; ifrs_section: string; balances: string[] }
    >();

    for (let p = 0; p < periods.length; p++) {
      for (const row of rowsByPeriod[p]) {
        if (!accountMap.has(row.account_id)) {
          accountMap.set(row.account_id, {
            account_id: row.account_id,
            code: row.code,
            name: row.name,
            type: row.type,
            parent_id: row.parent_id,
            ifrs_section: row.ifrs_section ?? '',
            balances: new Array(periods.length).fill('0'),
          });
        }
        accountMap.get(row.account_id)!.balances[p] = row.balance;
      }
    }

    const rows = Array.from(accountMap.values()).sort(
      (a, b) => (a.code < b.code ? -1 : 1),
    );

    return {
      periods: periods.map((p) => ({ id: p.id, name: p.name })),
      rows,
    };
  }

  async incomeStatementAccountEntries(
    tenantId: string,
    accountId: string,
    opts: { fiscalPeriodId?: string; year?: number },
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account with id ${accountId} not found`);
    }

    let startDate: Date;
    let endDate: Date;

    if (opts.fiscalPeriodId) {
      const period = await this.prisma.fiscalPeriod.findFirst({
        where: { id: opts.fiscalPeriodId, tenantId },
      });
      if (!period)
        throw new NotFoundException(
          `Fiscal period ${opts.fiscalPeriodId} not found`,
        );
      startDate = period.startDate;
      endDate = new Date(period.endDate);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      const year = opts.year ?? new Date().getFullYear();
      startDate = new Date(`${year}-01-01`);
      endDate = new Date(`${year + 1}-01-01`);
    }

    const result = await this.prisma.$queryRaw<IncomeStatementEntryRow[]>(
      Prisma.sql`
        SELECT
          je.id AS journal_entry_id,
          je.date AS entry_date,
          je.number AS entry_number,
          je.description,
          jel.debit::numeric(18,2)::text AS debit,
          jel.credit::numeric(18,2)::text AS credit,
          SUM(jel.debit - jel.credit) OVER (ORDER BY je.date, je.number)::numeric(18,2)::text AS balance
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalEntryId"
        WHERE je."tenantId" = ${tenantId}
          AND je.status = 'POSTED'
          AND jel."accountId" = ${accountId}
          AND je.date >= ${startDate}
          AND je.date < ${endDate}
        ORDER BY je.date, je.number
      `,
    );

    return result;
  }

  /**
   * Returns the given account id plus all descendant account ids (recursive by parentId).
   */
  private getAccountAndDescendantIds(
    accounts: Array<{ id: string; parentId: string | null }>,
    rootId: string,
  ): string[] {
    const byParent = new Map<string, Array<{ id: string; parentId: string | null }>>();
    for (const a of accounts) {
      const key = a.parentId ?? '__root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(a);
    }
    const ids: string[] = [];
    function collect(id: string) {
      ids.push(id);
      const children = byParent.get(id) ?? [];
      for (const c of children) collect(c.id);
    }
    collect(rootId);
    return ids;
  }

  async generalLedger(
    tenantId: string,
    accountId: string,
    startDate: string,
    endDate: string,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account with id ${accountId} not found`);
    }

    const accounts = await this.prisma.account.findMany({
      where: { tenantId },
      select: { id: true, parentId: true },
    });
    const accountIds = this.getAccountAndDescendantIds(accounts, accountId);

    const result = await this.prisma.$queryRaw<
      Array<{
        entry_date: Date;
        entry_number: number;
        account_code: string;
        account_name: string;
        description: string;
        debit: string;
        credit: string;
        running_balance: string;
      }>
    >(
      Prisma.sql`
        WITH lines AS (
          SELECT
            je.date AS entry_date,
            je.number AS entry_number,
            a.code AS account_code,
            a.name AS account_name,
            je.description,
            jel.debit::numeric(18,2) AS debit,
            jel.credit::numeric(18,2) AS credit
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.id = jel."journalEntryId"
          JOIN accounts a ON a.id = jel."accountId"
          WHERE je."tenantId" = ${tenantId}
            AND je.status = 'POSTED'
            AND jel."accountId" IN (${Prisma.join(accountIds)})
            AND je.date >= ${new Date(startDate)}::date
            AND je.date < (${new Date(endDate)}::date + INTERVAL '1 day')
        )
        SELECT
          entry_date,
          entry_number,
          account_code,
          account_name,
          description,
          debit::text,
          credit::text,
          SUM(debit - credit) OVER (ORDER BY entry_date, entry_number)::text AS running_balance
        FROM lines
        ORDER BY entry_date, entry_number
      `,
    );

    return result;
  }
}
