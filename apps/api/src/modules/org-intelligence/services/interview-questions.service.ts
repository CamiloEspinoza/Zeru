import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiConfigService } from '../../ai/services/ai-config.service';
import { AiUsageService } from '../../ai/services/ai-usage.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'gpt-4.1-mini';
const MAX_OUTPUT_TOKENS = 8192;

// ---------------------------------------------------------------------------
// Structured output schema
// ---------------------------------------------------------------------------

const QuestionsOutputSchema = z.object({
  introText: z.string(),
  sections: z.array(
    z.object({
      theme: z.string(),
      questions: z.array(
        z.object({
          text: z.string(),
          rationale: z.string(),
          priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
        }),
      ),
    }),
  ),
});

type QuestionsOutput = z.infer<typeof QuestionsOutputSchema>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class InterviewQuestionsService {
  private readonly logger = new Logger(InterviewQuestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  /**
   * Genera preguntas de entrevista personalizadas usando OpenAI.
   * Toma en cuenta el contexto del proyecto (entidades, problemas, relaciones)
   * y los datos del entrevistado.
   */
  async generateQuestions(tenantId: string, interviewId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 1. Cargar la entrevista con speakers y proyecto
    const interview = await client.interview.findFirst({
      where: { id: interviewId, deletedAt: null },
      include: {
        speakers: true,
        project: true,
      },
    });

    if (!interview) {
      throw new NotFoundException(`Entrevista con id ${interviewId} no encontrada`);
    }

    // 2. Obtener API key
    const apiKey = await this.aiConfig.getDecryptedApiKey(tenantId);
    if (!apiKey) {
      throw new Error(`No hay API key de OpenAI configurada para el tenant ${tenantId}`);
    }
    const openai = new OpenAI({ apiKey });

    // 3. Construir contexto del proyecto
    const knowledgeContext = await this.buildProjectContext(tenantId, client, interview.projectId);

    // 4. Construir el prompt
    const interviewee = interview.speakers.find((s) => !s.isInterviewer);
    const intervieweeName = interviewee?.name ?? 'el/la entrevistado/a';
    const intervieweeRole = interviewee?.role ?? 'sin cargo definido';
    const intervieweeDept = interviewee?.department ?? 'departamento no especificado';

    const projectName = (interview.project as { name?: string })?.name ?? 'proyecto';
    const objective = interview.objective ?? '';

    const systemPrompt = `Eres un consultor organizacional experto en levantamiento de procesos y diagnóstico organizacional en empresas chilenas. Tu tarea es generar una guía de entrevista personalizada y profesional.

Debes generar:
1. Un texto introductorio ("introText") personalizado para el entrevistado. Debe ser cálido, profesional y explicar el propósito del levantamiento organizacional. Incluir el nombre y cargo del entrevistado. Extensión: 3-4 párrafos.
2. Un conjunto de secciones de preguntas ("sections") adaptadas al entrevistado y al contexto del proyecto.

Las secciones OBLIGATORIAS son:
- "Apertura y contexto": preguntas para romper el hielo y entender el rol del entrevistado
- "Procesos y flujos de trabajo": preguntas sobre cómo realiza su trabajo diario
- "Herramientas y sistemas": preguntas sobre las herramientas que utiliza
- "Desafíos y problemas": preguntas sobre dificultades, cuellos de botella e ineficiencias
- "Mejoras y oportunidades": preguntas sobre qué mejoraría y cómo visualiza el futuro

Si hay conocimiento previo del proyecto (entidades, problemas identificados), agrega una sección adicional:
- "Profundización": preguntas específicas para clarificar o ampliar gaps del conocimiento existente

Cada pregunta debe tener:
- "text": la pregunta en español, en tono conversacional y cercano
- "rationale": por qué es importante hacerle esta pregunta a este entrevistado
- "priority": HIGH si es crítica para el levantamiento, MEDIUM si es relevante, LOW si es complementaria

Incluye entre 3 y 6 preguntas por sección. Prioriza preguntas abiertas que inviten a la reflexión.
El lenguaje debe ser en español chileno, profesional pero cercano.`;

    const userContent = `Proyecto: ${projectName}
Entrevistado: ${intervieweeName}
Cargo: ${intervieweeRole}
Departamento/Área: ${intervieweeDept}
${objective ? `\nObjetivo específico de la entrevista: ${objective}` : ''}

${knowledgeContext}`;

    // 5. Llamar a OpenAI con structured output
    const response = await openai.responses.create({
      model: MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      text: {
        format: zodTextFormat(QuestionsOutputSchema, 'questions_output'),
      },
      max_output_tokens: MAX_OUTPUT_TOKENS,
    });

    const outputText = response.output_text;
    if (!outputText) {
      throw new Error('Respuesta vacía de OpenAI al generar preguntas');
    }

    const parsed = JSON.parse(outputText) as QuestionsOutput;

    const usage = response.usage;
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;

    // 6. Guardar resultado en la entrevista
    const updatedInterview = await client.interview.update({
      where: { id: interviewId },
      data: {
        generatedIntro: parsed.introText,
        generatedQuestions: parsed.sections as unknown as Record<string, unknown>[],
        questionsGeneratedAt: new Date(),
      },
    });

    // 7. Registrar uso en AiUsageLog
    await this.logUsage(tenantId, { inputTokens, outputTokens });

    this.logger.log(
      `[${interviewId}] Preguntas generadas: ${parsed.sections.length} secciones, ${parsed.sections.reduce((acc, s) => acc + s.questions.length, 0)} preguntas`,
    );

    return {
      interviewId,
      introText: parsed.introText,
      sections: parsed.sections,
      questionsGeneratedAt: updatedInterview.questionsGeneratedAt,
      usage: { inputTokens, outputTokens },
    };
  }

  /**
   * Actualiza manualmente las preguntas generadas (edición por el usuario).
   */
  async updateQuestions(tenantId: string, interviewId: string, sections: unknown) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const interview = await client.interview.findFirst({
      where: { id: interviewId, deletedAt: null },
    });

    if (!interview) {
      throw new NotFoundException(`Entrevista con id ${interviewId} no encontrada`);
    }

    return client.interview.update({
      where: { id: interviewId },
      data: {
        generatedQuestions: sections as unknown as Record<string, unknown>[],
      },
      select: {
        id: true,
        generatedQuestions: true,
        questionsGeneratedAt: true,
      },
    });
  }

  /**
   * Retorna un resumen del conocimiento acumulado del proyecto:
   * entidades agrupadas por tipo, problemas y conteo de entrevistas.
   */
  async getKnowledgeSummary(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const [entities, problems, interviewCount] = await Promise.all([
      client.orgEntity.findMany({
        where: { projectId, tenantId, deletedAt: null },
        select: { id: true, name: true, type: true, description: true },
        orderBy: { name: 'asc' },
      }),
      client.problem.findMany({
        where: { projectId, tenantId, deletedAt: null },
        select: { id: true, title: true, description: true, severity: true, category: true },
        orderBy: { severity: 'desc' },
      }),
      client.interview.count({
        where: { projectId, deletedAt: null },
      }),
    ]);

    const byType = (type: string) =>
      entities
        .filter((e) => e.type === type)
        .map((e) => ({ id: e.id, name: e.name, description: e.description }));

    return {
      departments: byType('DEPARTMENT'),
      roles: byType('ROLE'),
      processes: byType('PROCESS'),
      systems: byType('SYSTEM'),
      problems: problems.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        severity: p.severity,
        category: p.category,
      })),
      totalInterviews: interviewCount,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Construye un bloque de contexto con el conocimiento previo del proyecto
   * para inyectar en el prompt de generación de preguntas.
   */
  private async buildProjectContext(
    tenantId: string,
    client: PrismaClient,
    projectId: string,
  ): Promise<string> {
    try {
      const summary = await this.getKnowledgeSummary(tenantId, projectId);
      const lines: string[] = [];

      if (summary.totalInterviews > 0) {
        lines.push(`Contexto del proyecto (${summary.totalInterviews} entrevista(s) completada(s) hasta ahora):`);
      } else {
        lines.push('Contexto del proyecto (primera entrevista del proyecto — sin conocimiento previo):');
      }

      if (summary.departments.length > 0) {
        lines.push('\nDepartamentos identificados:');
        for (const d of summary.departments) {
          lines.push(`- ${d.name}${d.description ? `: ${d.description}` : ''}`);
        }
      }

      if (summary.roles.length > 0) {
        lines.push('\nRoles identificados:');
        for (const r of summary.roles) {
          lines.push(`- ${r.name}${r.description ? `: ${r.description}` : ''}`);
        }
      }

      if (summary.processes.length > 0) {
        lines.push('\nProcesos identificados:');
        for (const p of summary.processes) {
          lines.push(`- ${p.name}${p.description ? `: ${p.description}` : ''}`);
        }
      }

      if (summary.systems.length > 0) {
        lines.push('\nSistemas y herramientas identificados:');
        for (const s of summary.systems) {
          lines.push(`- ${s.name}${s.description ? `: ${s.description}` : ''}`);
        }
      }

      if (summary.problems.length > 0) {
        lines.push('\nProblemas y desafíos ya detectados:');
        for (const p of summary.problems) {
          lines.push(`- [${p.severity}] ${p.title}: ${p.description.slice(0, 150)}`);
        }
      }

      if (lines.length === 1) {
        return 'No hay conocimiento previo del proyecto. Esta es la primera entrevista.';
      }

      return lines.join('\n');
    } catch (err) {
      this.logger.warn(`No se pudo construir contexto del proyecto: ${(err as Error).message}`);
      return 'No hay conocimiento previo disponible del proyecto.';
    }
  }

  private async logUsage(
    tenantId: string,
    usage: { inputTokens: number; outputTokens: number },
  ): Promise<void> {
    try {
      await this.aiUsageService.logUsage({
        provider: 'OPENAI',
        model: MODEL,
        feature: 'interview-question-generation',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        tenantId,
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo registrar el uso de AI: ${(err as Error).message}`,
      );
    }
  }
}
