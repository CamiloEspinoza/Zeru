import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChartOfAccountsService } from '../../accounting/services/chart-of-accounts.service';
import { JournalEntriesService } from '../../accounting/services/journal-entries.service';
import { FiscalPeriodsService } from '../../accounting/services/fiscal-periods.service';
import { ReportsService } from '../../accounting/services/reports.service';
import { FilesService } from '../../files/files.service';
import { MemoryService } from '../services/memory.service';
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
  ) {}

  async execute(
    name: string,
    args: Record<string, unknown>,
    tenantId: string,
    userId?: string,
  ): Promise<ToolExecutionResult> {
    try {
      switch (name) {
        case 'list_accounts':
          return await this.listAccounts(tenantId);

        case 'create_account':
          return await this.createAccount(args, tenantId);

        case 'create_journal_entry':
          return await this.createJournalEntry(args, tenantId);

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

        case 'ask_user_question':
          // This tool is handled by the chat service directly (sends question event to client)
          return { success: true, data: null, summary: 'Pregunta enviada al usuario' };

        case 'memory_store':
          return await this.memoryStore(args, tenantId, userId ?? null);

        case 'memory_search':
          return await this.memorySearch(args, tenantId, userId ?? null);

        case 'memory_delete':
          return await this.memoryDelete(args, tenantId);

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

    const entry = await this.journalEntries.create(tenantId, {
      date: String(args.date),
      description: String(args.description),
      fiscalPeriodId: String(args.fiscalPeriodId),
      lines,
    });

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

    // Standard Chilean chart of accounts — hierarchical structure
    const template: Array<{ code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; parentCode: string | null }> = [
      // Level 1 — Group headers
      { code: '1', name: 'Activos', type: 'ASSET', parentCode: null },
      { code: '1.1', name: 'Activo Corriente', type: 'ASSET', parentCode: '1' },
      { code: '1.2', name: 'Activo No Corriente', type: 'ASSET', parentCode: '1' },
      { code: '2', name: 'Pasivos', type: 'LIABILITY', parentCode: null },
      { code: '2.1', name: 'Pasivo Corriente', type: 'LIABILITY', parentCode: '2' },
      { code: '2.2', name: 'Pasivo No Corriente', type: 'LIABILITY', parentCode: '2' },
      { code: '3', name: 'Patrimonio', type: 'EQUITY', parentCode: null },
      { code: '3.1', name: 'Capital', type: 'EQUITY', parentCode: '3' },
      { code: '4', name: 'Ingresos', type: 'REVENUE', parentCode: null },
      { code: '4.1', name: 'Ingresos Operacionales', type: 'REVENUE', parentCode: '4' },
      { code: '4.2', name: 'Otros Ingresos', type: 'REVENUE', parentCode: '4' },
      { code: '5', name: 'Gastos', type: 'EXPENSE', parentCode: null },
      { code: '5.1', name: 'Costos', type: 'EXPENSE', parentCode: '5' },
      { code: '5.2', name: 'Gastos de Administración y Ventas', type: 'EXPENSE', parentCode: '5' },

      // Level 2 — ASSET sub-groups
      { code: '1.1.01', name: 'Caja y Bancos', type: 'ASSET', parentCode: '1.1' },
      { code: '1.1.02', name: 'Cuentas por Cobrar', type: 'ASSET', parentCode: '1.1' },
      { code: '1.1.03', name: 'Impuestos por Recuperar', type: 'ASSET', parentCode: '1.1' },
      { code: '1.1.04', name: 'Inventarios', type: 'ASSET', parentCode: '1.1' },
      { code: '1.1.05', name: 'Otros Activos Corrientes', type: 'ASSET', parentCode: '1.1' },
      { code: '1.2.01', name: 'Activo Fijo', type: 'ASSET', parentCode: '1.2' },
      { code: '1.2.02', name: 'Depreciación Acumulada', type: 'ASSET', parentCode: '1.2' },
      { code: '1.2.03', name: 'Intangibles', type: 'ASSET', parentCode: '1.2' },

      // Level 2 — LIABILITY sub-groups
      { code: '2.1.01', name: 'Proveedores y Cuentas por Pagar', type: 'LIABILITY', parentCode: '2.1' },
      { code: '2.1.02', name: 'Impuestos por Pagar', type: 'LIABILITY', parentCode: '2.1' },
      { code: '2.1.03', name: 'Remuneraciones por Pagar', type: 'LIABILITY', parentCode: '2.1' },
      { code: '2.2.01', name: 'Obligaciones Financieras LP', type: 'LIABILITY', parentCode: '2.2' },

      // Level 2 — EQUITY
      { code: '3.1.01', name: 'Capital Pagado', type: 'EQUITY', parentCode: '3.1' },
      { code: '3.1.02', name: 'Reservas', type: 'EQUITY', parentCode: '3.1' },
      { code: '3.1.03', name: 'Resultados Acumulados', type: 'EQUITY', parentCode: '3.1' },
      { code: '3.1.04', name: 'Resultado del Ejercicio', type: 'EQUITY', parentCode: '3.1' },

      // Level 3 — Leaf accounts: ASSETS
      { code: '1.1.01.001', name: 'Caja', type: 'ASSET', parentCode: '1.1.01' },
      { code: '1.1.01.002', name: 'Banco Cuenta Corriente', type: 'ASSET', parentCode: '1.1.01' },
      { code: '1.1.02.001', name: 'Clientes', type: 'ASSET', parentCode: '1.1.02' },
      { code: '1.1.02.002', name: 'Documentos por Cobrar', type: 'ASSET', parentCode: '1.1.02' },
      { code: '1.1.02.003', name: 'Deudores Varios', type: 'ASSET', parentCode: '1.1.02' },
      { code: '1.1.03.001', name: 'IVA Crédito Fiscal', type: 'ASSET', parentCode: '1.1.03' },
      { code: '1.1.03.002', name: 'PPM por Recuperar', type: 'ASSET', parentCode: '1.1.03' },
      { code: '1.1.04.001', name: 'Inventario Mercaderías', type: 'ASSET', parentCode: '1.1.04' },
      { code: '1.1.05.001', name: 'Accionistas por Cobrar', type: 'ASSET', parentCode: '1.1.05' },
      { code: '1.1.05.002', name: 'Gastos Pagados por Anticipado', type: 'ASSET', parentCode: '1.1.05' },
      { code: '1.2.01.001', name: 'Maquinaria y Equipos', type: 'ASSET', parentCode: '1.2.01' },
      { code: '1.2.01.002', name: 'Muebles y Útiles', type: 'ASSET', parentCode: '1.2.01' },
      { code: '1.2.01.003', name: 'Equipos Computacionales', type: 'ASSET', parentCode: '1.2.01' },
      { code: '1.2.01.004', name: 'Vehículos', type: 'ASSET', parentCode: '1.2.01' },
      { code: '1.2.02.001', name: 'Depreciación Acum. Maquinaria', type: 'ASSET', parentCode: '1.2.02' },
      { code: '1.2.02.002', name: 'Depreciación Acum. Muebles', type: 'ASSET', parentCode: '1.2.02' },
      { code: '1.2.02.003', name: 'Depreciación Acum. Equipos', type: 'ASSET', parentCode: '1.2.02' },
      { code: '1.2.03.001', name: 'Software y Licencias', type: 'ASSET', parentCode: '1.2.03' },

      // Level 3 — Leaf accounts: LIABILITIES
      { code: '2.1.01.001', name: 'Proveedores', type: 'LIABILITY', parentCode: '2.1.01' },
      { code: '2.1.01.002', name: 'Documentos por Pagar', type: 'LIABILITY', parentCode: '2.1.01' },
      { code: '2.1.01.003', name: 'Acreedores Varios', type: 'LIABILITY', parentCode: '2.1.01' },
      { code: '2.1.02.001', name: 'IVA Débito Fiscal', type: 'LIABILITY', parentCode: '2.1.02' },
      { code: '2.1.02.002', name: 'Retenciones por Pagar', type: 'LIABILITY', parentCode: '2.1.02' },
      { code: '2.1.02.003', name: 'PPM por Pagar', type: 'LIABILITY', parentCode: '2.1.02' },
      { code: '2.1.02.004', name: 'Impuesto Renta por Pagar', type: 'LIABILITY', parentCode: '2.1.02' },
      { code: '2.1.03.001', name: 'Remuneraciones por Pagar', type: 'LIABILITY', parentCode: '2.1.03' },
      { code: '2.1.03.002', name: 'Cotizaciones Previsionales por Pagar', type: 'LIABILITY', parentCode: '2.1.03' },
      { code: '2.2.01.001', name: 'Préstamos Bancarios LP', type: 'LIABILITY', parentCode: '2.2.01' },

      // Level 3 — Leaf accounts: REVENUE
      { code: '4.1.01.001', name: 'Ingresos por Ventas Afectas', type: 'REVENUE', parentCode: '4.1' },
      { code: '4.1.01.002', name: 'Ingresos por Ventas Exentas', type: 'REVENUE', parentCode: '4.1' },
      { code: '4.2.01.001', name: 'Ingresos Financieros', type: 'REVENUE', parentCode: '4.2' },
      { code: '4.2.01.002', name: 'Otros Ingresos No Operacionales', type: 'REVENUE', parentCode: '4.2' },

      // Level 3 — Leaf accounts: EXPENSES
      { code: '5.1.01.001', name: 'Costo de Ventas', type: 'EXPENSE', parentCode: '5.1' },
      { code: '5.2.01.001', name: 'Remuneraciones', type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.01.002', name: 'Cotizaciones Previsionales Empleador', type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.02.001', name: 'Arriendos', type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.02.002', name: 'Servicios Básicos', type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.03.001', name: 'Honorarios Profesionales', type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.04.001', name: 'Depreciación del Ejercicio', type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.05.001', name: 'Gastos Generales de Administración', type: 'EXPENSE', parentCode: '5.2' },
      { code: '5.2.06.001', name: 'Gastos Financieros', type: 'EXPENSE', parentCode: '5.2' },
    ];

    // Create accounts in order (parents first) to resolve parentId correctly
    const codeToId = new Map<string, string>();
    let created = 0;

    for (const acc of template) {
      const parentId = acc.parentCode ? codeToId.get(acc.parentCode) : undefined;
      const account = await this.chartOfAccounts.create(tenantId, {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        parentId,
      });
      codeToId.set(acc.code, account.id);
      created++;
    }

    return {
      success: true,
      data: { accountsCreated: created },
      summary: `Plan de cuentas estándar chileno creado con ${created} cuentas`,
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
    const entries = (result.data as Array<{ number: number; date: Date; description: string; status: string }>)
      .map((e) => ({
        id: (e as any).id,
        number: e.number,
        date: e.date,
        description: e.description,
        status: e.status,
      }));

    return {
      success: true,
      data: { entries, meta: result.meta },
      summary: `${entries.length} asiento(s) encontrado(s) (página ${result.meta.page}/${result.meta.totalPages})`,
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

    const memory = await this.memory.store({
      tenantId,
      userId: effectiveUserId,
      content: String(args.content),
      category: String(args.category) as MemoryCategory,
      importance: Number(args.importance ?? 5),
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
}
