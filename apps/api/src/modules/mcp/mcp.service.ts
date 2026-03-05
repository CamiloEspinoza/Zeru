import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { Request, Response } from 'express';
import { DOCS, ALL_ENDPOINTS } from './mcp-docs.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { JournalEntriesService } from '../accounting/services/journal-entries.service';
import { ChartOfAccountsService } from '../accounting/services/chart-of-accounts.service';
import { FiscalPeriodsService } from '../accounting/services/fiscal-periods.service';
import { ReportsService } from '../accounting/services/reports.service';

const RESOURCE_KEYS = ['overview', 'authentication', 'accounts', 'journal-entries', 'fiscal-periods', 'reports', 'errors', 'rate-limits'] as const;
type ResourceKey = typeof RESOURCE_KEYS[number];

interface AuthenticatedSession {
  transport: SSEServerTransport;
  tenantId: string;
  scopes: string[];
}

@Injectable()
export class ZeruMcpService {
  /** Active SSE transports by session ID */
  private readonly transports = new Map<string, SSEServerTransport>();
  /** Authenticated sessions with tenant context */
  private readonly authenticatedSessions = new Map<string, AuthenticatedSession>();

  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly journalEntries: JournalEntriesService,
    private readonly chartOfAccounts: ChartOfAccountsService,
    private readonly fiscalPeriods: FiscalPeriodsService,
    private readonly reports: ReportsService,
  ) {}

  /** Register documentation-only tools and resources */
  private registerDocTools(server: McpServer): void {
    server.tool(
      'list_endpoints',
      'Lista todos los endpoints disponibles de la API pública de Zeru con su método HTTP, ruta, scope requerido y descripción.',
      {},
      async () => {
        const lines = ALL_ENDPOINTS.map(
          (e) => `${e.method.padEnd(6)} ${e.path.padEnd(50)} [${e.scope}] — ${e.description}`,
        );
        return {
          content: [{ type: 'text' as const, text: `# Endpoints de la API Zeru (v1)\n\n${lines.join('\n')}` }],
        };
      },
    );

    (server as unknown as { tool: (...a: unknown[]) => void }).tool(
      'get_docs',
      'Retorna la documentación detallada de un recurso de la API Zeru. Incluye endpoints, parámetros, ejemplos de request/response y notas.',
      { resource: z.string() },
      async (params: { resource: string }) => {
        const text =
          DOCS[params.resource as ResourceKey] ??
          `Recurso "${params.resource}" no encontrado. Opciones válidas: ${RESOURCE_KEYS.join(', ')}`;
        return { content: [{ type: 'text' as const, text }] };
      },
    );

    for (const [key, content] of Object.entries(DOCS)) {
      const name = `docs-${key}`;
      const capturedContent = content;
      server.resource(
        name,
        `${name}://docs`,
        { description: `Documentación Zeru API: ${key}` },
        async (uri) => ({ contents: [{ uri: uri.href, text: capturedContent, mimeType: 'text/markdown' }] }),
      );
    }
  }

  /** Register operational tools that require authentication */
  private registerOperationalTools(
    server: McpServer,
    tenantId: string,
    scopes: string[],
  ): void {
    const hasScope = (scope: string) => scopes.includes(scope);
    const castServer = server as unknown as { tool: (...a: unknown[]) => void };

    // ─── Accounts ─────────────────────────────────────────────
    if (hasScope('accounts:read')) {
      server.tool(
        'list_accounts',
        'Lista el plan de cuentas completo del tenant como árbol jerárquico.',
        {},
        async () => {
          const data = await this.chartOfAccounts.findAll(tenantId);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ object: 'list', data }, null, 2) }],
          };
        },
      );
    }

    // ─── Fiscal Periods ───────────────────────────────────────
    if (hasScope('fiscal-periods:read')) {
      server.tool(
        'list_fiscal_periods',
        'Lista los períodos fiscales del tenant. Necesitas el ID de un período OPEN para crear asientos.',
        {},
        async () => {
          const data = await this.fiscalPeriods.findAll(tenantId);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ object: 'list', data }, null, 2) }],
          };
        },
      );
    }

    // ─── Journal Entries: Read ────────────────────────────────
    if (hasScope('journal-entries:read')) {
      castServer.tool(
        'list_journal_entries',
        'Lista asientos contables con paginación y filtro por estado.',
        {
          status: z.enum(['DRAFT', 'POSTED', 'VOIDED']).optional(),
          page: z.number().int().min(1).optional(),
          perPage: z.number().int().min(1).max(100).optional(),
        },
        async (params: { status?: 'DRAFT' | 'POSTED' | 'VOIDED'; page?: number; perPage?: number }) => {
          const result = await this.journalEntries.findAll(tenantId, params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                object: 'list',
                data: result.data,
                total: result.meta.total,
                has_more: result.meta.page * result.meta.perPage < result.meta.total,
              }, null, 2),
            }],
          };
        },
      );

      castServer.tool(
        'get_journal_entry',
        'Obtiene el detalle completo de un asiento contable por su ID, incluyendo líneas y cuentas.',
        { id: z.string().uuid() },
        async (params: { id: string }) => {
          try {
            const data = await this.journalEntries.findById(params.id, tenantId);
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ object: 'journal_entry', ...data }, null, 2) }],
            };
          } catch {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Journal entry not found' }) }],
              isError: true,
            };
          }
        },
      );
    }

    // ─── Journal Entries: Write ───────────────────────────────
    if (hasScope('journal-entries:write')) {
      castServer.tool(
        'create_journal_entry',
        'Crea un nuevo asiento contable en estado DRAFT. Las líneas deben estar balanceadas (suma debit == suma credit). Requiere un fiscalPeriodId de un período OPEN.',
        {
          date: z.string().describe('Fecha del asiento (YYYY-MM-DD)'),
          description: z.string().describe('Descripción del asiento'),
          fiscalPeriodId: z.string().uuid().describe('ID del período fiscal (debe estar OPEN)'),
          lines: z.array(z.object({
            accountId: z.string().uuid().describe('ID de la cuenta contable'),
            debit: z.number().min(0).describe('Monto al debe (0 si es haber)'),
            credit: z.number().min(0).describe('Monto al haber (0 si es debe)'),
            description: z.string().optional().describe('Descripción de la línea'),
          })).min(2).describe('Mínimo 2 líneas balanceadas'),
        },
        async (params: {
          date: string;
          description: string;
          fiscalPeriodId: string;
          lines: Array<{ accountId: string; debit: number; credit: number; description?: string }>;
        }) => {
          // Validate balance
          const totalDebit = params.lines.reduce((sum, l) => sum + l.debit, 0);
          const totalCredit = params.lines.reduce((sum, l) => sum + l.credit, 0);
          if (Math.abs(totalDebit - totalCredit) >= 0.01) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Debe y Haber deben ser iguales', totalDebit, totalCredit }) }],
              isError: true,
            };
          }

          try {
            const data = await this.journalEntries.create(tenantId, params, {
              createdVia: 'MANUAL',
            });
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ object: 'journal_entry', ...data }, null, 2) }],
            };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error creating journal entry';
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
              isError: true,
            };
          }
        },
      );
    }

    // ─── Journal Entries: Manage (post/void) ──────────────────
    if (hasScope('journal-entries:manage')) {
      castServer.tool(
        'post_journal_entry',
        'Postea un asiento DRAFT. Una vez posteado, el asiento queda inmutable y afecta los reportes.',
        { id: z.string().uuid().describe('ID del asiento a postear') },
        async (params: { id: string }) => {
          try {
            const data = await this.journalEntries.post(params.id, tenantId);
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ object: 'journal_entry', ...data }, null, 2) }],
            };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error posting journal entry';
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
              isError: true,
            };
          }
        },
      );

      castServer.tool(
        'void_journal_entry',
        'Anula un asiento POSTED. El asiento queda en estado VOIDED y ya no afecta los reportes.',
        { id: z.string().uuid().describe('ID del asiento a anular') },
        async (params: { id: string }) => {
          try {
            const data = await this.journalEntries.void(params.id, tenantId);
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ object: 'journal_entry', ...data }, null, 2) }],
            };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error voiding journal entry';
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
              isError: true,
            };
          }
        },
      );
    }

    // ─── Reports ──────────────────────────────────────────────
    if (hasScope('reports:read')) {
      castServer.tool(
        'get_trial_balance',
        'Obtiene el balance de comprobación para un período fiscal.',
        { fiscalPeriodId: z.string().uuid().describe('ID del período fiscal') },
        async (params: { fiscalPeriodId: string }) => {
          const data = await this.reports.trialBalance(tenantId, params.fiscalPeriodId);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ object: 'list', data }, null, 2) }],
          };
        },
      );

      castServer.tool(
        'get_general_ledger',
        'Obtiene el libro mayor de una cuenta en un rango de fechas.',
        {
          accountId: z.string().uuid().describe('ID de la cuenta'),
          startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
          endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
        },
        async (params: { accountId: string; startDate: string; endDate: string }) => {
          const data = await this.reports.generalLedger(tenantId, params.accountId, params.startDate, params.endDate);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ object: 'list', data }, null, 2) }],
          };
        },
      );
    }
  }

  /** Create a fully-configured McpServer instance */
  private buildServer(auth?: { tenantId: string; scopes: string[] }): McpServer {
    const serverName = auth ? 'zeru-accounting' : 'zeru-api-docs';
    const server = new McpServer({ name: serverName, version: '1.0.0' });

    this.registerDocTools(server);

    if (auth) {
      this.registerOperationalTools(server, auth.tenantId, auth.scopes);
    }

    return server;
  }

  /** Extract and validate API key from request */
  private async authenticateRequest(
    req: Request,
  ): Promise<{ tenantId: string; scopes: string[] } | null> {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer zk_')) return null;

    const rawKey = authHeader.slice('Bearer '.length).trim();
    const result = await this.apiKeysService.validate(rawKey);
    if (!result) return null;

    void this.apiKeysService.touch(result.id);
    return { tenantId: result.tenantId, scopes: result.scopes };
  }

  /** Handle an incoming SSE connection request */
  async handleSse(req: Request, res: Response): Promise<void> {
    const auth = await this.authenticateRequest(req);
    const server = this.buildServer(auth ?? undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transport = new SSEServerTransport('/api/mcp/messages', res as any);
    const sessionId = transport.sessionId;
    this.transports.set(sessionId, transport);

    if (auth) {
      this.authenticatedSessions.set(sessionId, {
        transport,
        tenantId: auth.tenantId,
        scopes: auth.scopes,
      });
    }

    res.on('close', () => {
      this.transports.delete(sessionId);
      this.authenticatedSessions.delete(sessionId);
    });

    await server.connect(transport);
  }

  /** Handle an incoming POST message to an existing SSE session */
  async handleMessage(req: Request, res: Response): Promise<void> {
    const sessionId = req.query['sessionId'] as string;

    if (!sessionId || !this.transports.has(sessionId)) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const transport = this.transports.get(sessionId)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transport.handlePostMessage(req as any, res as any, (req as any).body);
  }
}
