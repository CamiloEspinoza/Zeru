import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiConfigService } from '../../ai/services/ai-config.service';
import { AiUsageService } from '../../ai/services/ai-usage.service';
import {
  ExtractionP1Schema,
  ExtractionP2Schema,
  ExtractionP3Schema,
  ExtractionP4Schema,
  ExtractionP5Schema,
  type ExtractionP1,
  type ExtractionP2,
  type ExtractionP3,
  type ExtractionP4,
  type ExtractionP5,
  type ExtractionResult,
} from './extraction-schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_MINI = 'gpt-4.1-mini';
const MODEL_FULL = 'gpt-4.1';
const MAX_OUTPUT_TOKENS = 8192;

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_P1 =
  'Eres un analista organizacional experto. Extrae todas las personas, roles, departamentos y sistemas mencionados en esta entrevista. Para cada entidad, incluye todos los nombres alternativos usados. Asigna confianza 1.0 si se menciona explícitamente, 0.5 si es inferido.';

const SYSTEM_P2_TEMPLATE =
  'Eres un analista de procesos. Extrae todos los procesos de negocio y sus actividades. Cada actividad debe tener un orden secuencial. Vincula actividades a roles y sistemas ya identificados:\n\n{P1_SUMMARY}';

const SYSTEM_P3_TEMPLATE =
  'Eres un consultor de mejora continua. Identifica todos los problemas, ineficiencias, quejas y riesgos mencionados. Incluye la cita textual exacta como evidencia. Sé riguroso con la severidad. Roles y procesos identificados:\n\n{P1P2_SUMMARY}';

const SYSTEM_P4_TEMPLATE =
  'Eres un analista de dependencias organizacionales. Identifica todas las dependencias entre procesos, áreas, roles y sistemas. Marca como crítica si su fallo detendría operaciones. Contexto:\n\n{P1P2P3_SUMMARY}';

const SYSTEM_P5 =
  'Extrae todos los claims fácticos cuantitativos y cualitativos: duraciones, frecuencias, volúmenes, costos, cantidades. Incluye la cita textual como evidencia. Marca el nivel de certeza del hablante.';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ExtractionPipelineService {
  private readonly logger = new Logger(ExtractionPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  /**
   * Run the 5-pass extraction pipeline on an interview transcription.
   * Each pass builds on previous results. Failures on individual passes
   * are logged but do not prevent subsequent passes from running.
   */
  async extract(
    tenantId: string,
    interviewId: string,
    onProgress?: (pass: number, total: number, summary: string) => void,
  ): Promise<ExtractionResult> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 1. Load interview with transcription
    const interview = await client.interview.findFirst({
      where: { id: interviewId, deletedAt: null },
    });

    if (!interview) {
      throw new NotFoundException(
        `Entrevista con id ${interviewId} no encontrada`,
      );
    }

    if (!interview.transcriptionText) {
      throw new NotFoundException(
        `La entrevista ${interviewId} no tiene transcripción`,
      );
    }

    // 2. Get OpenAI client
    const apiKey = await this.aiConfig.getDecryptedApiKey(tenantId);
    if (!apiKey) {
      throw new Error(
        `No hay API key de OpenAI configurada para el tenant ${tenantId}`,
      );
    }
    const openai = new OpenAI({ apiKey });

    const transcription = interview.transcriptionText;
    const completedPasses: number[] = [];
    const failedPasses: number[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // 2.5. Load known persons and departments for context injection
    const knownContext = await this.buildKnownEntitiesContext(
      tenantId,
      client,
    );

    // 3. Run 5 passes sequentially
    // Pass 1: Entities (roles, departments, systems)
    let pass1: ExtractionP1 | null = null;
    try {
      // Augment Pass 1 system prompt with known persons/departments context
      const systemP1WithContext = knownContext
        ? `${SYSTEM_P1}\n\n${knownContext}`
        : SYSTEM_P1;

      const p1 = await this.runPass(
        openai,
        transcription,
        '',
        ExtractionP1Schema,
        'extraction_p1',
        MODEL_MINI,
        systemP1WithContext,
      );
      pass1 = p1.result;
      totalInputTokens += p1.usage.inputTokens;
      totalOutputTokens += p1.usage.outputTokens;
      await this.logUsage(tenantId, MODEL_MINI, 1, p1.usage);
      completedPasses.push(1);
      const p1Summary = `${pass1.roles.length} roles, ${pass1.departments.length} departamentos, ${pass1.systems.length} sistemas`;
      this.logger.log(`[${interviewId}] Pass 1 complete: ${p1Summary}`);
      onProgress?.(1, 5, p1Summary);
    } catch (err) {
      failedPasses.push(1);
      this.logger.error(
        `[${interviewId}] Pass 1 failed: ${(err as Error).message}`,
      );
    }

    // Pass 2: Processes
    let pass2: ExtractionP2 | null = null;
    try {
      const p1Summary = this.summarizeP1(pass1);
      const systemP2 = SYSTEM_P2_TEMPLATE.replace('{P1_SUMMARY}', p1Summary);
      const p2 = await this.runPass(
        openai,
        transcription,
        p1Summary ? `Entidades identificadas previamente:\n${p1Summary}` : '',
        ExtractionP2Schema,
        'extraction_p2',
        MODEL_MINI,
        systemP2,
      );
      pass2 = p2.result;
      totalInputTokens += p2.usage.inputTokens;
      totalOutputTokens += p2.usage.outputTokens;
      await this.logUsage(tenantId, MODEL_MINI, 2, p2.usage);
      completedPasses.push(2);
      const p2Summary = `${pass2.processes.length} procesos`;
      this.logger.log(`[${interviewId}] Pass 2 complete: ${p2Summary}`);
      onProgress?.(2, 5, p2Summary);
    } catch (err) {
      failedPasses.push(2);
      this.logger.error(
        `[${interviewId}] Pass 2 failed: ${(err as Error).message}`,
      );
    }

    // Pass 3: Problems (uses full model for reasoning)
    let pass3: ExtractionP3 | null = null;
    try {
      const p1p2Summary = this.summarizeP1P2(pass1, pass2);
      const systemP3 = SYSTEM_P3_TEMPLATE.replace(
        '{P1P2_SUMMARY}',
        p1p2Summary,
      );
      const p3 = await this.runPass(
        openai,
        transcription,
        p1p2Summary
          ? `Entidades y procesos identificados previamente:\n${p1p2Summary}`
          : '',
        ExtractionP3Schema,
        'extraction_p3',
        MODEL_FULL,
        systemP3,
      );
      pass3 = p3.result;
      totalInputTokens += p3.usage.inputTokens;
      totalOutputTokens += p3.usage.outputTokens;
      await this.logUsage(tenantId, MODEL_FULL, 3, p3.usage);
      completedPasses.push(3);
      const p3Summary = `${pass3.problems.length} problemas`;
      this.logger.log(`[${interviewId}] Pass 3 complete: ${p3Summary}`);
      onProgress?.(3, 5, p3Summary);
    } catch (err) {
      failedPasses.push(3);
      this.logger.error(
        `[${interviewId}] Pass 3 failed: ${(err as Error).message}`,
      );
    }

    // Pass 4: Dependencies (uses full model for reasoning)
    let pass4: ExtractionP4 | null = null;
    try {
      const p1p2p3Summary = this.summarizeP1P2P3(pass1, pass2, pass3);
      const systemP4 = SYSTEM_P4_TEMPLATE.replace(
        '{P1P2P3_SUMMARY}',
        p1p2p3Summary,
      );
      const p4 = await this.runPass(
        openai,
        transcription,
        p1p2p3Summary
          ? `Contexto de entidades, procesos y problemas:\n${p1p2p3Summary}`
          : '',
        ExtractionP4Schema,
        'extraction_p4',
        MODEL_FULL,
        systemP4,
      );
      pass4 = p4.result;
      totalInputTokens += p4.usage.inputTokens;
      totalOutputTokens += p4.usage.outputTokens;
      await this.logUsage(tenantId, MODEL_FULL, 4, p4.usage);
      completedPasses.push(4);
      const p4Summary = `${pass4.dependencies.length} dependencias`;
      this.logger.log(`[${interviewId}] Pass 4 complete: ${p4Summary}`);
      onProgress?.(4, 5, p4Summary);
    } catch (err) {
      failedPasses.push(4);
      this.logger.error(
        `[${interviewId}] Pass 4 failed: ${(err as Error).message}`,
      );
    }

    // Pass 5: Factual claims
    let pass5: ExtractionP5 | null = null;
    try {
      const p5 = await this.runPass(
        openai,
        transcription,
        '',
        ExtractionP5Schema,
        'extraction_p5',
        MODEL_MINI,
        SYSTEM_P5,
      );
      pass5 = p5.result;
      totalInputTokens += p5.usage.inputTokens;
      totalOutputTokens += p5.usage.outputTokens;
      await this.logUsage(tenantId, MODEL_MINI, 5, p5.usage);
      completedPasses.push(5);
      const p5Summary = `${pass5.claims.length} claims factuales`;
      this.logger.log(`[${interviewId}] Pass 5 complete: ${p5Summary}`);
      onProgress?.(5, 5, p5Summary);
    } catch (err) {
      failedPasses.push(5);
      this.logger.error(
        `[${interviewId}] Pass 5 failed: ${(err as Error).message}`,
      );
    }

    // 4. Build combined result
    const result: ExtractionResult = {
      pass1,
      pass2,
      pass3,
      pass4,
      pass5,
      metadata: {
        completedPasses,
        failedPasses,
        totalInputTokens,
        totalOutputTokens,
        processedAt: new Date().toISOString(),
      },
    };

    // 5. Save extraction result to interview
    await client.interview.update({
      where: { id: interviewId },
      data: {
        extractionResult: result as unknown as Record<string, unknown>,
      },
    });

    this.logger.log(
      `[${interviewId}] Extraction pipeline complete. Passed: [${completedPasses.join(',')}], Failed: [${failedPasses.join(',')}]`,
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Generic pass runner using OpenAI Responses API + Structured Outputs
  // -------------------------------------------------------------------------

  private async runPass<T>(
    openai: OpenAI,
    transcription: string,
    previousContext: string,
    schema: z.ZodType<T>,
    schemaName: string,
    model: string,
    systemPrompt: string,
  ): Promise<{ result: T; usage: { inputTokens: number; outputTokens: number } }> {
    const userContent = previousContext
      ? `${previousContext}\n\n--- TRANSCRIPCIÓN ---\n\n${transcription}`
      : `--- TRANSCRIPCIÓN ---\n\n${transcription}`;

    const response = await openai.responses.create({
      model,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      text: {
        format: zodTextFormat(schema, schemaName),
      },
      max_output_tokens: MAX_OUTPUT_TOKENS,
    });

    const outputText = response.output_text;
    if (!outputText) {
      throw new Error(`Pass ${schemaName}: empty response from OpenAI`);
    }

    const parsed = JSON.parse(outputText) as T;

    const usage = response.usage;
    return {
      result: parsed,
      usage: {
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Usage logging
  // -------------------------------------------------------------------------

  private async logUsage(
    tenantId: string,
    model: string,
    passNumber: number,
    usage: { inputTokens: number; outputTokens: number },
  ): Promise<void> {
    try {
      await this.aiUsageService.logUsage({
        provider: 'OPENAI',
        model,
        feature: `org-extraction-pass-${passNumber}`,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        tenantId,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to log AI usage for extraction pass ${passNumber}: ${(err as Error).message}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Summarizers — compress previous pass results for context injection
  // -------------------------------------------------------------------------

  private summarizeP1(p1: ExtractionP1 | null): string {
    if (!p1) return '';

    const lines: string[] = [];

    if (p1.roles.length > 0) {
      lines.push('ROLES:');
      for (const r of p1.roles) {
        const dept = r.department ? ` (${r.department})` : '';
        lines.push(`- ${r.canonicalName}${dept}`);
      }
    }

    if (p1.departments.length > 0) {
      lines.push('DEPARTAMENTOS:');
      for (const d of p1.departments) {
        const parent = d.parentDepartment ? ` → ${d.parentDepartment}` : '';
        lines.push(`- ${d.name}${parent}`);
      }
    }

    if (p1.systems.length > 0) {
      lines.push('SISTEMAS:');
      for (const s of p1.systems) {
        lines.push(`- ${s.name} (${s.type})`);
      }
    }

    return lines.join('\n');
  }

  private summarizeP1P2(
    p1: ExtractionP1 | null,
    p2: ExtractionP2 | null,
  ): string {
    const parts: string[] = [];
    const p1Sum = this.summarizeP1(p1);
    if (p1Sum) parts.push(p1Sum);

    if (p2 && p2.processes.length > 0) {
      const processLines = ['PROCESOS:'];
      for (const p of p2.processes) {
        const owner = p.owner ? ` (owner: ${p.owner})` : '';
        const actCount = p.activities.length;
        processLines.push(
          `- ${p.name}${owner} — ${actCount} actividades`,
        );
      }
      parts.push(processLines.join('\n'));
    }

    return parts.join('\n\n');
  }

  private summarizeP1P2P3(
    p1: ExtractionP1 | null,
    p2: ExtractionP2 | null,
    p3: ExtractionP3 | null,
  ): string {
    const parts: string[] = [];
    const p1p2Sum = this.summarizeP1P2(p1, p2);
    if (p1p2Sum) parts.push(p1p2Sum);

    if (p3 && p3.problems.length > 0) {
      const problemLines = ['PROBLEMAS:'];
      for (const prob of p3.problems) {
        problemLines.push(
          `- [${prob.severity}] ${prob.description.slice(0, 120)}`,
        );
      }
      parts.push(problemLines.join('\n'));
    }

    return parts.join('\n\n');
  }

  // -------------------------------------------------------------------------
  // Known entities context — inject PersonProfile & Department info into prompts
  // -------------------------------------------------------------------------

  /**
   * Build a context block with known persons and departments for the tenant.
   * This context is injected into the extraction prompts so the LLM can
   * match extracted roles/departments to existing records.
   */
  private async buildKnownEntitiesContext(
    tenantId: string,
    client: PrismaClient,
  ): Promise<string> {
    try {
      const [knownPersons, knownDepartments] = await Promise.all([
        client.personProfile.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            name: true,
            role: true,
            department: { select: { name: true } },
          },
          take: 100,
          orderBy: { name: 'asc' },
        }),
        client.department.findMany({
          where: { tenantId, deletedAt: null },
          select: { name: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      if (knownPersons.length === 0 && knownDepartments.length === 0) {
        return '';
      }

      const lines: string[] = [];

      if (knownPersons.length > 0) {
        lines.push('Personas conocidas en la organización:');
        for (const p of knownPersons) {
          const role = p.role ?? 'sin cargo';
          const dept = p.department?.name ?? 'sin departamento';
          lines.push(`- ${p.name} — ${role} — ${dept}`);
        }
      }

      if (knownDepartments.length > 0) {
        lines.push('');
        lines.push('Departamentos existentes:');
        for (const d of knownDepartments) {
          lines.push(`- ${d.name}`);
        }
      }

      lines.push('');
      lines.push(
        'Cuando identifiques roles o personas, intenta vincularlos con las personas conocidas usando los mismos nombres. Cuando identifiques departamentos, usa los nombres exactos de los departamentos existentes si coinciden.',
      );

      return lines.join('\n');
    } catch (err) {
      this.logger.warn(
        `Failed to build known entities context: ${(err as Error).message}`,
      );
      return '';
    }
  }
}
