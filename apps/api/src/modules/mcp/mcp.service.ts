import { Injectable } from '@nestjs/common';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { Request, Response } from 'express';
import { DOCS, ALL_ENDPOINTS } from './mcp-docs.service';

const RESOURCE_KEYS = ['overview', 'authentication', 'accounts', 'journal-entries', 'fiscal-periods', 'reports', 'errors', 'rate-limits'] as const;
type ResourceKey = typeof RESOURCE_KEYS[number];

@Injectable()
export class ZeruMcpService {
  /** Active SSE transports by session ID */
  private readonly transports = new Map<string, SSEServerTransport>();

  /** Create a fully-configured McpServer instance */
  private buildServer(): McpServer {
    const server = new McpServer({ name: 'zeru-api-docs', version: '1.0.0' });

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

    return server;
  }

  /** Handle an incoming SSE connection request */
  async handleSse(req: Request, res: Response): Promise<void> {
    const server = this.buildServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transport = new SSEServerTransport('/api/mcp/messages', res as any);
    const sessionId = transport.sessionId;
    this.transports.set(sessionId, transport);

    res.on('close', () => {
      this.transports.delete(sessionId);
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
