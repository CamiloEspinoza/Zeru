import { z } from 'zod';

// ---------------------------------------------------------------------------
// Pass 1: Basic entities (roles, departments, systems)
// ---------------------------------------------------------------------------

export const ExtractionP1Schema = z.object({
  roles: z.array(
    z.object({
      canonicalName: z.string(),
      aliases: z.array(z.string()),
      department: z.string().nullable(),
      responsibilities: z.array(z.string()),
      reportsTo: z.string().nullable(),
      confidence: z.number(),
    }),
  ),
  departments: z.array(
    z.object({
      name: z.string(),
      aliases: z.array(z.string()),
      parentDepartment: z.string().nullable(),
      headRole: z.string().nullable(),
      confidence: z.number(),
    }),
  ),
  systems: z.array(
    z.object({
      name: z.string(),
      aliases: z.array(z.string()),
      type: z.enum([
        'ERP',
        'CRM',
        'SPREADSHEET',
        'EMAIL',
        'MESSAGING',
        'DATABASE',
        'CUSTOM_SOFTWARE',
        'DOCUMENT_MANAGEMENT',
        'OTHER',
      ]),
      usedBy: z.array(z.string()),
      purpose: z.string().nullable(),
      confidence: z.number(),
    }),
  ),
});

export type ExtractionP1 = z.infer<typeof ExtractionP1Schema>;

// ---------------------------------------------------------------------------
// Pass 2: Processes and activities
// ---------------------------------------------------------------------------

export const ExtractionP2Schema = z.object({
  processes: z.array(
    z.object({
      name: z.string(),
      aliases: z.array(z.string()),
      owner: z.string().nullable(),
      department: z.string().nullable(),
      frequency: z
        .enum([
          'DAILY',
          'WEEKLY',
          'BIWEEKLY',
          'MONTHLY',
          'QUARTERLY',
          'YEARLY',
          'ON_DEMAND',
          'CONTINUOUS',
        ])
        .nullable(),
      trigger: z.string().nullable(),
      output: z.string().nullable(),
      confidence: z.number(),
      activities: z.array(
        z.object({
          name: z.string(),
          executor: z.string().nullable(),
          systems: z.array(z.string()),
          documents: z.array(z.string()),
          order: z.number(),
          estimatedDuration: z.string().nullable(),
          isManual: z.boolean(),
          description: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export type ExtractionP2 = z.infer<typeof ExtractionP2Schema>;

// ---------------------------------------------------------------------------
// Pass 3: Problems and inefficiencies
// ---------------------------------------------------------------------------

export const ExtractionP3Schema = z.object({
  problems: z.array(
    z.object({
      description: z.string(),
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
      category: z.enum([
        'BOTTLENECK',
        'REDUNDANCY',
        'MANUAL_WORK',
        'LACK_OF_INFORMATION',
        'COORDINATION_FAILURE',
        'SYSTEM_LIMITATION',
        'ROLE_AMBIGUITY',
        'DEPENDENCY_RISK',
        'QUALITY_ISSUE',
        'COMPLIANCE_GAP',
        'OTHER',
      ]),
      affectedProcesses: z.array(z.string()),
      affectedRoles: z.array(z.string()),
      affectedSystems: z.array(z.string()),
      evidence: z.string(),
      speakerRole: z.string().nullable(),
      suggestedImprovement: z.string().nullable(),
      frequency: z
        .enum(['ALWAYS', 'OFTEN', 'SOMETIMES', 'RARELY'])
        .nullable(),
      confidence: z.number(),
    }),
  ),
});

export type ExtractionP3 = z.infer<typeof ExtractionP3Schema>;

// ---------------------------------------------------------------------------
// Pass 4: Dependencies between processes/areas
// ---------------------------------------------------------------------------

export const ExtractionP4Schema = z.object({
  dependencies: z.array(
    z.object({
      from: z.string(),
      fromType: z.enum(['PROCESS', 'DEPARTMENT', 'ROLE', 'SYSTEM']),
      to: z.string(),
      toType: z.enum(['PROCESS', 'DEPARTMENT', 'ROLE', 'SYSTEM']),
      type: z.enum([
        'INFORMATION',
        'APPROVAL',
        'MATERIAL',
        'TRIGGER',
        'DATA',
        'RESOURCE',
        'COORDINATION',
      ]),
      description: z.string().nullable(),
      isCritical: z.boolean(),
      evidence: z.string().nullable(),
      confidence: z.number(),
    }),
  ),
});

export type ExtractionP4 = z.infer<typeof ExtractionP4Schema>;

// ---------------------------------------------------------------------------
// Pass 5: Factual claims and metrics
// ---------------------------------------------------------------------------

export const ExtractionP5Schema = z.object({
  claims: z.array(
    z.object({
      subject: z.string(),
      predicate: z.string(),
      value: z.string(),
      valueType: z.enum(['QUANTITATIVE', 'QUALITATIVE', 'RELATIONAL']),
      unit: z.string().nullable(),
      numericValue: z.number().nullable(),
      speakerRole: z.string().nullable(),
      hedging: z.enum(['CERTAIN', 'PROBABLE', 'UNCERTAIN', 'SPECULATIVE']),
      evidence: z.string(),
      confidence: z.number(),
    }),
  ),
});

export type ExtractionP5 = z.infer<typeof ExtractionP5Schema>;

// ---------------------------------------------------------------------------
// Combined extraction result
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  pass1: ExtractionP1 | null;
  pass2: ExtractionP2 | null;
  pass3: ExtractionP3 | null;
  pass4: ExtractionP4 | null;
  pass5: ExtractionP5 | null;
  metadata: {
    completedPasses: number[];
    failedPasses: number[];
    totalInputTokens: number;
    totalOutputTokens: number;
    processedAt: string;
  };
}
