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

  async incomeStatement(tenantId: string, year: number) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year + 1}-01-01`);

    const result = await this.prisma.$queryRaw<IncomeStatementRow[]>(
      Prisma.sql`
        SELECT
          a.id AS account_id,
          a.code,
          a.name,
          a.type,
          a."parentId" AS parent_id,
          CASE
            WHEN a.type = 'REVENUE'
              THEN (SUM(COALESCE(jel.credit, 0)) - SUM(COALESCE(jel.debit, 0)))::numeric(18,2)::text
            ELSE
              (SUM(COALESCE(jel.debit, 0)) - SUM(COALESCE(jel.credit, 0)))::numeric(18,2)::text
          END AS balance
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalEntryId"
        JOIN accounts a ON a.id = jel."accountId"
        WHERE je."tenantId" = ${tenantId}
          AND je.status = 'POSTED'
          AND je.date >= ${startDate}
          AND je.date < ${endDate}
          AND a.type IN ('REVENUE', 'EXPENSE')
        GROUP BY a.id, a.code, a.name, a.type, a."parentId"
        ORDER BY a.code
      `,
    );

    return result;
  }

  async incomeStatementAccountEntries(
    tenantId: string,
    accountId: string,
    year: number,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      throw new NotFoundException(`Account with id ${accountId} not found`);
    }

    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year + 1}-01-01`);

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

    const result = await this.prisma.$queryRaw<
      Array<{
        entry_date: Date;
        entry_number: number;
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
            je.description,
            jel.debit::numeric(18,2) AS debit,
            jel.credit::numeric(18,2) AS credit
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.id = jel."journalEntryId"
          WHERE je."tenantId" = ${tenantId}
            AND je.status = 'POSTED'
            AND jel."accountId" = ${accountId}
            AND je.date >= ${new Date(startDate)}::date
            AND je.date < (${new Date(endDate)}::date + INTERVAL '1 day')
        )
        SELECT
          entry_date,
          entry_number,
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
