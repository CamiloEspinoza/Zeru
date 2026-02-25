import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChartOfAccountsService } from '../../accounting/services/chart-of-accounts.service';
import { JournalEntriesService } from '../../accounting/services/journal-entries.service';
import { FiscalPeriodsService } from '../../accounting/services/fiscal-periods.service';
import { ReportsService } from '../../accounting/services/reports.service';
import { FilesService } from '../../files/files.service';
import { MemoryService } from '../services/memory.service';
import { SkillsService } from '../services/skills.service';
import { DocumentCategory, MemoryCategory } from '@prisma/client';

export interface ToolExecutionResult {
  success: boolean;
  data: unknown;
  summary: string;
}

@Injectable()
export class ToolExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chartOfAccounts: ChartOfAccountsService,
    private readonly journalEntries: JournalEntriesService,
    private readonly fiscalPeriods: FiscalPeriodsService,
    private readonly reports: ReportsService,
    private readonly files: FilesService,
    private readonly memory: MemoryService,
    private readonly skills: SkillsService,
  ) {}

  async execute(
    name: string,
    args: Record<string, unknown>,
    tenantId: string,
    userId?: string,
    options?: { conversationId?: string },
  ): Promise<ToolExecutionResult> {
    try {
      switch (name) {
        case 'list_accounts':
          return await this.listAccounts(tenantId);

        case 'create_account':
          return await this.createAccount(args, tenantId);

        case 'create_journal_entry':
          return await this.createJournalEntry(args, tenantId, userId, options?.conversationId);

        case 'create_fiscal_period':
          return await this.createFiscalPeriod(args, tenantId);

        case 'create_chart_of_accounts_template':
          return await this.createChartOfAccountsTemplate(tenantId);

        case 'list_fiscal_periods':
          return await this.listFiscalPeriods(tenantId);

        case 'list_journal_entries':
          return await this.listJournalEntries(args, tenantId);

        case 'post_journal_entry':
          return await this.postJournalEntry(args, tenantId);

        case 'get_trial_balance':
          return await this.getTrialBalance(args, tenantId);

        case 'tag_document':
          return await this.tagDocument(args, tenantId);

        case 'link_document_to_entry':
          return await this.linkDocumentToEntry(args, tenantId);

        case 'get_document_journal_entries':
          return await this.getDocumentJournalEntries(args, tenantId);

        case 'ask_user_question':
          // This tool is handled by the chat service directly (sends question event to client)
          return { success: true, data: null, summary: 'Pregunta enviada al usuario' };

        case 'memory_store':
          return await this.memoryStore(args, tenantId, userId ?? null);

        case 'memory_search':
          return await this.memorySearch(args, tenantId, userId ?? null);

        case 'memory_delete':
          return await this.memoryDelete(args, tenantId);

        case 'get_skill_reference':
          return await this.getSkillReference(args, tenantId);

        default:
          return {
            success: false,
            data: null,
            summary: `Herramienta desconocida: ${name}`,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return { success: false, data: { error: message }, summary: `Error: ${message}` };
    }
  }

  private async listAccounts(tenantId: string): Promise<ToolExecutionResult> {
    const accounts = await this.chartOfAccounts.findAll(tenantId);
    const flat = this.flattenAccounts(accounts as any[]);
    return {
      success: true,
      data: flat,
      summary: `Plan de cuentas: ${flat.length} cuentas`,
    };
  }

  private flattenAccounts(
    accounts: Array<{ id: string; code: string; name: string; type: string; children?: unknown[] }>,
    result: Array<{ id: string; code: string; name: string; type: string }> = [],
  ) {
    for (const account of accounts) {
      result.push({ id: account.id, code: account.code, name: account.name, type: account.type });
      if (account.children && account.children.length > 0) {
        this.flattenAccounts(account.children as any[], result);
      }
    }
    return result;
  }

  private async createAccount(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    // Resolve parentId from parentCode if provided
    let parentId: string | undefined;

    if (args.parentCode) {
      const parent = await this.prisma.account.findFirst({
        where: { code: String(args.parentCode), tenantId },
        select: { id: true },
      });
      if (parent) parentId = parent.id;
    }

    const account = await this.chartOfAccounts.create(tenantId, {
      code: String(args.code),
      name: String(args.name),
      type: args.type as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
      parentId,
    });

    return {
      success: true,
      data: account,
      summary: `Cuenta creada: ${account.code} - ${account.name}`,
    };
  }

  private async createJournalEntry(
    args: Record<string, unknown>,
    tenantId: string,
    userId?: string,
    conversationId?: string,
  ): Promise<ToolExecutionResult> {
    type LineArg = { accountCode: string; debit: number; credit: number; description?: string };
    const rawLines = args.lines as LineArg[];

    // Resolve accountId from accountCode for each line
    const lines: Array<{ accountId: string; debit: number; credit: number; description?: string }> = [];

    for (const line of rawLines) {
      const account = await this.prisma.account.findFirst({
        where: { code: line.accountCode, tenantId },
        select: { id: true },
      });

      if (!account) {
        return {
          success: false,
          data: { error: `Cuenta no encontrada: ${line.accountCode}` },
          summary: `Error: cuenta "${line.accountCode}" no existe en el plan de cuentas`,
        };
      }

      lines.push({
        accountId: account.id,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      });
    }

    const meta =
      userId !== undefined
        ? {
            createdById: userId,
            createdVia: 'ASSISTANT' as const,
            conversationId: conversationId ?? null,
          }
        : undefined;

    const entry = await this.journalEntries.create(
      tenantId,
      {
        date: String(args.date),
        description: String(args.description),
        fiscalPeriodId: String(args.fiscalPeriodId),
        lines,
      },
      meta,
    );

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    return {
      success: true,
      data: entry,
      summary: `Asiento #${entry.number} creado — ${entry.description} (Debe: $${totalDebit.toLocaleString('es-CL')})`,
    };
  }

  private async listFiscalPeriods(tenantId: string): Promise<ToolExecutionResult> {
    const periods = await this.fiscalPeriods.findAll(tenantId);
    return {
      success: true,
      data: periods,
      summary: `${periods.length} período(s) fiscal(es)`,
    };
  }

  private async tagDocument(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const doc = await this.files.updateMetadata(
      tenantId,
      String(args.documentId),
      String(args.category) as DocumentCategory,
      (args.tags as string[]) ?? [],
    );
    return {
      success: true,
      data: { id: doc.id, category: doc.category, tags: doc.tags },
      summary: `Documento clasificado como ${doc.category} con ${doc.tags.length} tag(s)`,
    };
  }

  private async linkDocumentToEntry(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    await this.files.linkToJournalEntry(
      tenantId,
      String(args.documentId),
      String(args.journalEntryId),
    );
    return {
      success: true,
      data: { documentId: args.documentId, journalEntryId: args.journalEntryId },
      summary: `Documento vinculado al asiento`,
    };
  }

  private async getDocumentJournalEntries(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const { entries } = await this.files.getJournalEntriesForDocument(
      tenantId,
      String(args.documentId),
    );
    const count = entries.length;
    const summary =
      count === 0
        ? 'El documento no tiene asientos vinculados; se puede crear uno nuevo.'
        : count === 1
          ? `El documento ya tiene 1 asiento vinculado (evitar duplicar).`
          : `El documento ya tiene ${count} asientos vinculados (evitar duplicar).`;
    return {
      success: true,
      data: { entries },
      summary,
    };
  }

  private async createFiscalPeriod(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const period = await this.fiscalPeriods.create(tenantId, {
      name: String(args.name),
      startDate: String(args.startDate),
      endDate: String(args.endDate),
    });

    return {
      success: true,
      data: period,
      summary: `Período fiscal creado: ${period.name} (${args.startDate} — ${args.endDate})`,
    };
  }

  private async createChartOfAccountsTemplate(
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const existing = await this.chartOfAccounts.findAll(tenantId);
    const flat = this.flattenAccounts(existing as any[]);
    if (flat.length > 0) {
      return {
        success: false,
        data: { error: 'El plan de cuentas ya tiene cuentas' },
        summary: `El plan de cuentas ya contiene ${flat.length} cuentas. No se creó la plantilla.`,
      };
    }

    // Standard Chilean chart of accounts aligned with IAS 1 (function method)
    // ifrsSection: marks the IFRS P&L section for this branch; inherited by all descendants
    type TemplateAccount = {
      code: string;
      name: string;
      type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
      parentCode: string | null;
      ifrsSection?: 'REVENUE' | 'OTHER_INCOME' | 'COST_OF_SALES' | 'OPERATING_EXPENSE' | 'FINANCE_INCOME' | 'FINANCE_COST' | 'TAX_EXPENSE';
    };

    const template: TemplateAccount[] = [
      // ── Balance Sheet ─────────────────────────────────────────
      { code: '1',     name: 'Activos',                          type: 'ASSET',     parentCode: null },
      { code: '1.1',   name: 'Activo Corriente',                 type: 'ASSET',     parentCode: '1' },
      { code: '1.2',   name: 'Activo No Corriente',              type: 'ASSET',     parentCode: '1' },
      { code: '2',     name: 'Pasivos',                          type: 'LIABILITY', parentCode: null },
      { code: '2.1',   name: 'Pasivo Corriente',                 type: 'LIABILITY', parentCode: '2' },
      { code: '2.2',   name: 'Pasivo No Corriente',              type: 'LIABILITY', parentCode: '2' },
      { code: '3',     name: 'Patrimonio',                       type: 'EQUITY',    parentCode: null },
      { code: '3.1',   name: 'Capital',                          type: 'EQUITY',    parentCode: '3' },

      // ── P&L — Revenue (IAS 1.82a) ─────────────────────────────
      { code: '4',     name: 'Ingresos',                         type: 'REVENUE',   parentCode: null },
      { code: '4.1',   name: 'Ingresos de Actividades Ordinarias', type: 'REVENUE', parentCode: '4',   ifrsSection: 'REVENUE' },
      { code: '4.2',   name: 'Otros Ingresos',                   type: 'REVENUE',   parentCode: '4',   ifrsSection: 'OTHER_INCOME' },
      { code: '4.3',   name: 'Ingresos Financieros',             type: 'REVENUE',   parentCode: '4',   ifrsSection: 'FINANCE_INCOME' },

      // ── P&L — Expenses (IAS 1.99 — function method) ───────────
      { code: '5',     name: 'Gastos',                           type: 'EXPENSE',   parentCode: null },
      { code: '5.1',   name: 'Costo de Ventas',                  type: 'EXPENSE',   parentCode: '5',   ifrsSection: 'COST_OF_SALES' },
      { code: '5.2',   name: 'Gastos de Administración y Ventas', type: 'EXPENSE',  parentCode: '5',   ifrsSection: 'OPERATING_EXPENSE' },
      { code: '5.3',   name: 'Gastos Financieros',               type: 'EXPENSE',   parentCode: '5',   ifrsSection: 'FINANCE_COST' },
      { code: '5.4',   name: 'Gasto por Impuesto a las Ganancias', type: 'EXPENSE', parentCode: '5',   ifrsSection: 'TAX_EXPENSE' },

      // ── Assets — Level 2 ──────────────────────────────────────
      { code: '1.1.01', name: 'Caja y Bancos',                   type: 'ASSET',     parentCode: '1.1' },
      { code: '1.1.02', name: 'Cuentas por Cobrar',              type: 'ASSET',     parentCode: '1.1' },
      { code: '1.1.03', name: 'Impuestos por Recuperar',         type: 'ASSET',     parentCode: '1.1' },
      { code: '1.1.04', name: 'Inventarios',                     type: 'ASSET',     parentCode: '1.1' },
      { code: '1.1.05', name: 'Otros Activos Corrientes',        type: 'ASSET',     parentCode: '1.1' },
      { code: '1.2.01', name: 'Activo Fijo (PPE)',               type: 'ASSET',     parentCode: '1.2' },
      { code: '1.2.02', name: 'Depreciación Acumulada',          type: 'ASSET',     parentCode: '1.2' },
      { code: '1.2.03', name: 'Activos Intangibles',             type: 'ASSET',     parentCode: '1.2' },

      // ── Liabilities — Level 2 ─────────────────────────────────
      { code: '2.1.01', name: 'Proveedores y Cuentas por Pagar', type: 'LIABILITY', parentCode: '2.1' },
      { code: '2.1.02', name: 'Impuestos por Pagar',             type: 'LIABILITY', parentCode: '2.1' },
      { code: '2.1.03', name: 'Remuneraciones por Pagar',        type: 'LIABILITY', parentCode: '2.1' },
      { code: '2.2.01', name: 'Obligaciones Financieras LP',     type: 'LIABILITY', parentCode: '2.2' },

      // ── Equity — Level 2 ──────────────────────────────────────
      { code: '3.1.01', name: 'Capital Pagado',                  type: 'EQUITY',    parentCode: '3.1' },
      { code: '3.1.02', name: 'Reservas',                        type: 'EQUITY',    parentCode: '3.1' },
      { code: '3.1.03', name: 'Resultados Acumulados',           type: 'EQUITY',    parentCode: '3.1' },
      { code: '3.1.04', name: 'Resultado del Período',           type: 'EQUITY',    parentCode: '3.1' },

      // ── Assets — Level 3 (leaf) ───────────────────────────────
      { code: '1.1.01.001', name: 'Caja',                                         type: 'ASSET', parentCode: '1.1.01' },
      { code: '1.1.01.002', name: 'Banco Cuenta Corriente',                       type: 'ASSET', parentCode: '1.1.01' },
      { code: '1.1.02.001', name: 'Clientes',                                     type: 'ASSET', parentCode: '1.1.02' },
      { code: '1.1.02.002', name: 'Documentos por Cobrar',                        type: 'ASSET', parentCode: '1.1.02' },
      { code: '1.1.02.003', name: 'Deudores Varios',                              type: 'ASSET', parentCode: '1.1.02' },
      { code: '1.1.03.001', name: 'IVA Crédito Fiscal',                           type: 'ASSET', parentCode: '1.1.03' },
      { code: '1.1.03.002', name: 'PPM por Recuperar',                            type: 'ASSET', parentCode: '1.1.03' },
      { code: '1.1.04.001', name: 'Inventario de Mercaderías',                    type: 'ASSET', parentCode: '1.1.04' },
      { code: '1.1.05.001', name: 'Accionistas por Cobrar',                       type: 'ASSET', parentCode: '1.1.05' },
      { code: '1.1.05.002', name: 'Gastos Pagados por Anticipado',                type: 'ASSET', parentCode: '1.1.05' },
      { code: '1.2.01.001', name: 'Maquinaria y Equipos',                         type: 'ASSET', parentCode: '1.2.01' },
      { code: '1.2.01.002', name: 'Muebles y Útiles',                             type: 'ASSET', parentCode: '1.2.01' },
      { code: '1.2.01.003', name: 'Equipos Computacionales',                      type: 'ASSET', parentCode: '1.2.01' },
      { code: '1.2.01.004', name: 'Vehículos',                                    type: 'ASSET', parentCode: '1.2.01' },
      { code: '1.2.02.001', name: 'Depreciación Acum. Maquinaria',                type: 'ASSET', parentCode: '1.2.02' },
      { code: '1.2.02.002', name: 'Depreciación Acum. Muebles',                   type: 'ASSET', parentCode: '1.2.02' },
      { code: '1.2.02.003', name: 'Depreciación Acum. Equipos',                   type: 'ASSET', parentCode: '1.2.02' },
      { code: '1.2.03.001', name: 'Software y Licencias',                         type: 'ASSET', parentCode: '1.2.03' },

      // ── Liabilities — Level 3 (leaf) ─────────────────────────
      { code: '2.1.01.001', name: 'Proveedores',                                  type: 'LIABILITY', parentCode: '2.1.01' },
      { code: '2.1.01.002', name: 'Documentos por Pagar',                         type: 'LIABILITY', parentCode: '2.1.01' },
      { code: '2.1.01.003', name: 'Acreedores Varios',                            type: 'LIABILITY', parentCode: '2.1.01' },
      { code: '2.1.02.001', name: 'IVA Débito Fiscal',                            type: 'LIABILITY', parentCode: '2.1.02' },
      { code: '2.1.02.002', name: 'Retenciones por Pagar',                        type: 'LIABILITY', parentCode: '2.1.02' },
      { code: '2.1.02.003', name: 'PPM por Pagar',                                type: 'LIABILITY', parentCode: '2.1.02' },
      { code: '2.1.02.004', name: 'Impuesto a la Renta por Pagar',                type: 'LIABILITY', parentCode: '2.1.02' },
      { code: '2.1.03.001', name: 'Remuneraciones por Pagar',                     type: 'LIABILITY', parentCode: '2.1.03' },
      { code: '2.1.03.002', name: 'Cotizaciones Previsionales por Pagar',         type: 'LIABILITY', parentCode: '2.1.03' },
      { code: '2.2.01.001', name: 'Préstamos Bancarios LP',                       type: 'LIABILITY', parentCode: '2.2.01' },

      // ── Revenue — Level 3 (leaf) ──────────────────────────────
      { code: '4.1.01.001', name: 'Ingresos por Ventas Afectas (IVA)',            type: 'REVENUE', parentCode: '4.1' },
      { code: '4.1.01.002', name: 'Ingresos por Ventas Exentas',                  type: 'REVENUE', parentCode: '4.1' },
      { code: '4.2.01.001', name: 'Otros Ingresos Operacionales',                 type: 'REVENUE', parentCode: '4.2' },
      { code: '4.2.01.002', name: 'Ganancias por Venta de Activos',               type: 'REVENUE', parentCode: '4.2' },
      { code: '4.3.01.001', name: 'Intereses Ganados',                            type: 'REVENUE', parentCode: '4.3' },
      { code: '4.3.01.002', name: 'Diferencias de Cambio Favorables',             type: 'REVENUE', parentCode: '4.3' },

      // ── Expenses — Level 3 (leaf) ─────────────────────────────
      // 5.1 Costo de ventas
      { code: '5.1.01.001', name: 'Costo de Ventas de Mercaderías',               type: 'EXPENSE', parentCode: '5.1' },
      { code: '5.1.01.002', name: 'Costo de Servicios Prestados',                 type: 'EXPENSE', parentCode: '5.1' },
      // 5.2 Gastos operativos (distribución + administración)
      { code: '5.2.01.001', name: 'Remuneraciones y Salarios',                    type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.01.002', name: 'Cotizaciones Previsionales Empleador',         type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.02.001', name: 'Arriendos de Inmuebles',                       type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.02.002', name: 'Servicios Básicos (luz, agua, gas)',           type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.03.001', name: 'Honorarios Profesionales',                     type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.04.001', name: 'Depreciación del Ejercicio (PPE)',             type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.04.002', name: 'Amortización de Intangibles',                  type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.05.001', name: 'Gastos Generales de Administración',           type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.06.001', name: 'Marketing y Publicidad',                       type: 'EXPENSE', parentCode: '5.2' },
      // 5.3 Gastos financieros
      { code: '5.3.01.001', name: 'Intereses sobre Préstamos Bancarios',          type: 'EXPENSE', parentCode: '5.3' },
      { code: '5.3.01.002', name: 'Diferencias de Cambio Desfavorables',          type: 'EXPENSE', parentCode: '5.3' },
      { code: '5.3.01.003', name: 'Otros Gastos Financieros',                     type: 'EXPENSE', parentCode: '5.3' },
      // 5.4 Impuesto a las ganancias
      { code: '5.4.01.001', name: 'Gasto por Impuesto a la Renta (Corriente)',    type: 'EXPENSE', parentCode: '5.4' },
      { code: '5.4.01.002', name: 'Gasto por Impuesto Diferido',                  type: 'EXPENSE', parentCode: '5.4' },
    ];

    // Create accounts in order (parents first); set ifrsSection from the template
    const codeToId = new Map<string, string>();
    let created = 0;

    for (const acc of template) {
      const parentId = acc.parentCode ? codeToId.get(acc.parentCode) : undefined;
      const account = await this.prisma.account.create({
        data: {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          parentId: parentId ?? null,
          tenantId,
          ifrsSection: acc.ifrsSection ?? null,
        },
      });
      codeToId.set(acc.code, account.id);
      created++;
    }

    return {
      success: true,
      data: { accountsCreated: created },
      summary: `Plan de cuentas estándar chileno (IAS 1 — método de función) creado con ${created} cuentas`,
    };
  }

  private async listJournalEntries(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const status = args.status && args.status !== 'null'
      ? (String(args.status) as 'DRAFT' | 'POSTED' | 'VOIDED')
      : undefined;
    const page = args.page ? Number(args.page) : 1;

    const result = await this.journalEntries.findAll(tenantId, { page, perPage: 10, status });
    const entries = (result.data as Array<{
      id: string;
      number: number;
      date: Date;
      description: string;
      status: string;
      lines?: Array<{
        debit: number;
        credit: number;
        description?: string | null;
        account?: { code: string; name: string };
      }>;
    }>).map((e) => ({
      id: e.id,
      number: e.number,
      date: e.date,
      description: e.description,
      status: e.status,
      lines: (e.lines ?? []).map((l) => ({
        accountCode: l.account?.code ?? '',
        accountName: l.account?.name ?? '',
        debit: Number(l.debit),
        credit: Number(l.credit),
        description: l.description ?? null,
      })),
    }));

    return {
      success: true,
      data: { entries, meta: result.meta },
      summary: `${entries.length} asiento(s) encontrado(s) (página ${result.meta.page}/${result.meta.totalPages}). Cada asiento incluye el detalle de líneas (cuenta, débito, crédito).`,
    };
  }

  private async postJournalEntry(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const entry = await this.journalEntries.post(String(args.journalEntryId), tenantId);
    return {
      success: true,
      data: entry,
      summary: `Asiento #${(entry as any).number} contabilizado (POSTED)`,
    };
  }

  private async getTrialBalance(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const balance = await this.reports.trialBalance(tenantId, String(args.fiscalPeriodId));
    return {
      success: true,
      data: balance,
      summary: `Balance de comprobación: ${(balance as unknown[]).length} cuentas`,
    };
  }

  private async memoryStore(
    args: Record<string, unknown>,
    tenantId: string,
    userId: string | null,
  ): Promise<ToolExecutionResult> {
    const scope = String(args.scope ?? 'tenant');
    const effectiveUserId = scope === 'user' ? userId : null;

    const rawDocId = args.documentId ? String(args.documentId).trim() : '';
    const documentId = rawDocId.length > 0 ? rawDocId : null;

    const memory = await this.memory.store({
      tenantId,
      userId: effectiveUserId,
      content: String(args.content),
      category: String(args.category) as MemoryCategory,
      importance: Number(args.importance ?? 5),
      documentId,
    });

    return {
      success: true,
      data: { id: memory.id, content: memory.content, category: memory.category, scope },
      summary: `Memoria guardada (${memory.category}, importancia ${memory.importance})`,
    };
  }

  private async memorySearch(
    args: Record<string, unknown>,
    tenantId: string,
    userId: string | null,
  ): Promise<ToolExecutionResult> {
    const scope = (String(args.scope ?? 'all')) as 'tenant' | 'user' | 'all';

    const results = await this.memory.search({
      tenantId,
      userId,
      query: String(args.query),
      scope,
      limit: 6,
    });

    return {
      success: true,
      data: results.map((m) => ({
        id: m.id,
        content: m.content,
        category: m.category,
        importance: m.importance,
        scope: m.userId ? 'user' : 'tenant',
        similarity: m.similarity,
        createdAt: m.createdAt,
      })),
      summary: `${results.length} memoria(s) encontrada(s)`,
    };
  }

  private async memoryDelete(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const deleted = await this.memory.delete(String(args.memoryId), tenantId);

    return {
      success: deleted,
      data: { memoryId: args.memoryId, deleted },
      summary: deleted ? 'Memoria eliminada' : 'Memoria no encontrada',
    };
  }

  private async getSkillReference(
    args: Record<string, unknown>,
    tenantId: string,
  ): Promise<ToolExecutionResult> {
    const content = await this.skills.getSkillReference(
      tenantId,
      String(args.skill_name),
      String(args.file_path),
    );

    const isError = content.startsWith('Error:');
    return {
      success: !isError,
      data: { content },
      summary: isError
        ? content
        : `Referencia cargada: ${args.file_path} (${content.length} caracteres)`,
    };
  }
}
