# F0.5 + F1 + Smoke real — Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDO: Usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`).

**Goal:** Cerrar la deuda crítica de F0 (race en `upsertValidationRow`, gaps de tests), implementar los 3 agentes determinísticos (identity, origin, traceability) con consolidador y persistencia, y validar el pipeline end-to-end con un informe real de Citolab.

**Architecture:**
1. **F0.5 (Schema + refactor):** Agregar `triggeredJobId String? @unique` a `LabReportValidation`. Reemplazar la lógica `findFirst→update|create` (window-based) por `prisma.labReportValidation.upsert({ where: { triggeredJobId } })`. Esto elimina race R3-1, estado contradictorio R3-2, cutoff arbitrario R3-4 y pérdida de syncedAt R3-5 de un solo golpe.
2. **F1 (Agentes):** Interface `ValidationAgent` con `run(input): Promise<AgentRunResult>`. Tres agentes determinísticos. Listener del evento `lab.report.validation.synced` que dispara los 3 en paralelo con timeout 30s usando `Promise.allSettled`. Consolidador básico que mapea findings → verdict global. Persistencia en `LabValidationAgentRun` + `LabValidationFinding`. Update final del `LabReportValidation.status` y `verdict`.
3. **F1.5 (Smoke real):** Probar end-to-end contra FM Citolab real con un informeNumber conocido. Verificar transición SYNCED → ANALYZING → COMPLETED con verdict.

**Tech Stack:** NestJS 11 • Prisma 7 • BullMQ • PostgreSQL 16 • TypeScript 5 • Zod • Jest • pnpm.

**Working directory:** `/Users/camiloespinoza/Zeru/.claude/worktrees/feature+citolab-validation-f1/`
**Branch:** `feature/citolab-validation-f1`

**Nota sobre las validaciones V0XX:** El spec de F0 referencia V001–V043 y RI-01–RI-20 sin detallarlas individualmente. Este plan interpreta cada validación pragmáticamente basándose en el dominio de patología y los fields disponibles en `ExtractedExam` (definidos en F0). Las interpretaciones están documentadas en cada agente (Tareas 7-9) y son refinables en code review.

---

## File Structure

### Archivos a crear

```
apps/api/prisma/migrations/YYYYMMDDhhmmss_lab_validation_triggered_job_id/migration.sql
apps/api/src/modules/lab/validation/agents/types.ts                                 # Interfaces ValidationAgent, AgentRunInput, AgentRunResult
apps/api/src/modules/lab/validation/agents/identity.agent.ts
apps/api/src/modules/lab/validation/agents/identity.agent.spec.ts
apps/api/src/modules/lab/validation/agents/origin.agent.ts
apps/api/src/modules/lab/validation/agents/origin.agent.spec.ts
apps/api/src/modules/lab/validation/agents/traceability.agent.ts
apps/api/src/modules/lab/validation/agents/traceability.agent.spec.ts
apps/api/src/modules/lab/validation/services/agent-runner.service.ts                # Persistencia + dispatch paralelo
apps/api/src/modules/lab/validation/services/agent-runner.service.spec.ts
apps/api/src/modules/lab/validation/services/consolidator.service.ts                # Mapea findings → verdict
apps/api/src/modules/lab/validation/services/consolidator.service.spec.ts
apps/api/src/modules/lab/validation/listeners/validation-synced.listener.ts         # Listener evento
apps/api/src/modules/lab/validation/listeners/validation-synced.listener.spec.ts
apps/api/src/modules/lab/validation/validation.module.ts                            # Módulo agentes (importable desde LabModule)
docs/superpowers/notes/2026-04-20-f1-smoke-results.md                               # Resultado del smoke real (Tarea 12)
```

### Archivos a modificar

```
apps/api/prisma/schema.prisma                                                       # +triggeredJobId @unique en LabReportValidation
apps/api/src/modules/lab/services/report-validation.service.ts                      # Refactor upsertValidationRow + recibe jobId
apps/api/src/modules/lab/services/report-validation.service.spec.ts                 # +tests faltantes
apps/api/src/modules/lab/processors/report-validation.processor.ts                  # Pasa job.id al service
apps/api/src/modules/lab/lab.module.ts                                              # Importa ValidationModule
```

---

## Tarea 1: Preparación del entorno

Verificar worktree, branch y servicios.

**Files:** ninguno (solo comandos)

- [ ] **Step 1.1: Verificar working directory**

```bash
pwd
# esperado: /Users/camiloespinoza/Zeru/.claude/worktrees/feature+citolab-validation-f1

git status
# esperado: On branch feature/citolab-validation-f1, working tree clean
```

- [ ] **Step 1.2: Verificar postgres + redis activos**

```bash
docker ps --format "{{.Names}}" | grep -E "zeru-postgres|zeru-redis"
# esperado: zeru-postgres-1 y zeru-redis-1
```

- [ ] **Step 1.3: Verificar que el API compila y tests F0 pasan**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# esperado: Successfully compiled

pnpm --filter @zeru/api exec jest --testPathPattern='(transformers|lab/processors|lab/services/report)' 2>&1 | tail -6
# esperado: 212 tests passed
```

- [ ] **Step 1.4: Commit vacío de kickoff**

```bash
git commit --allow-empty -m "chore: kickoff f0.5 + f1"
```

---

## Tarea 2: F0.5 — Agregar triggeredJobId al schema

Agregar campo opcional + unique al modelo `LabReportValidation`. Es la base para reemplazar el dedup window-based.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 2.1: Localizar el modelo**

```bash
grep -n "^model LabReportValidation" apps/api/prisma/schema.prisma
# esperado: una línea como "4182:model LabReportValidation {"
```

- [ ] **Step 2.2: Agregar el field**

Editar `apps/api/prisma/schema.prisma`. Localizar `LabReportValidation`, agregar `triggeredJobId` justo después de `triggeredByUserId`:

```prisma
  triggeredByUserId   String?
  /// BullMQ job id of the dispatch that owns this validation row.
  /// Unique constraint guarantees at most one validation row per BullMQ job
  /// (idempotent retries). NULL only for legacy rows pre F0.5.
  triggeredJobId      String?              @unique
  status              ValidationRunStatus  @default(PENDING)
```

- [ ] **Step 2.3: Validar el schema**

```bash
cd apps/api
pnpm exec prisma validate
# esperado: The schema at prisma/schema.prisma is valid 🚀
```

- [ ] **Step 2.4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): add triggeredJobId @unique to LabReportValidation"
```

---

## Tarea 3: F0.5 — Generar y aplicar migración

**Files:**
- Create: `apps/api/prisma/migrations/YYYYMMDDhhmmss_lab_validation_triggered_job_id/migration.sql`

- [ ] **Step 3.1: Crear migración con Prisma**

```bash
cd apps/api
pnpm exec prisma migrate dev --create-only --name lab_validation_triggered_job_id
# Si pregunta por reset: NO. Solo --create-only.
```

- [ ] **Step 3.2: Inspeccionar SQL generado**

```bash
ls -la prisma/migrations/ | tail -3
# esperado: el folder más reciente debe ser ..._lab_validation_triggered_job_id
cat prisma/migrations/$(ls prisma/migrations/ | grep -v migration_lock | tail -1)/migration.sql
# esperado: ALTER TABLE "mod_lab"."lab_report_validations" ADD COLUMN "triggeredJobId" TEXT;
# + CREATE UNIQUE INDEX ... ON ... ("triggeredJobId");
```

- [ ] **Step 3.3: Aplicar migración**

```bash
pnpm exec prisma migrate deploy
# esperado: Applying migration `..._lab_validation_triggered_job_id` + All migrations have been successfully applied.
```

- [ ] **Step 3.4: Verificar columna e índice en DB**

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "
\d mod_lab.lab_report_validations
" | grep -E "triggeredJobId|unique"
# esperado: triggeredJobId text + un índice unique
```

- [ ] **Step 3.5: Generar cliente Prisma**

```bash
pnpm exec prisma generate
# esperado: Generated Prisma Client
```

- [ ] **Step 3.6: Commit**

```bash
cd ../..
git add apps/api/prisma/migrations/
git commit -m "feat(db): migration adds triggeredJobId column + unique index"
```

---

## Tarea 4: F0.5 — Refactor upsertValidationRow

Reemplazar la lógica window-based por `upsert({ where: { triggeredJobId } })`. Recibe `triggeredJobId` desde el processor.

**Files:**
- Modify: `apps/api/src/modules/lab/services/report-validation.service.ts`

- [ ] **Step 4.1: Actualizar `ReportValidationTrigger` interface**

Localizar `export interface ReportValidationTrigger` en `report-validation.service.ts` (cerca línea 30) y agregar `jobId`:

```typescript
export interface ReportValidationTrigger {
  database: string;
  informeNumber: number;
  tenantId?: string;
  triggeredByUserId?: string | null;
  /** BullMQ job id propagado desde el processor para idempotencia. */
  jobId?: string;
}
```

- [ ] **Step 4.2: Reemplazar el método `upsertValidationRow`**

Localizar el método (cerca línea 235). Reemplazar todo el cuerpo:

```typescript
  /**
   * Crea o actualiza la fila de LabReportValidation por triggeredJobId.
   * El BullMQ job id es la clave de idempotencia: retries del mismo job
   * actualizan la fila existente, mientras que un re-trigger explícito
   * (jobId nuevo) crea una nueva.
   */
  private async upsertValidationRow(input: {
    tenantId: string;
    fmSource: FmSourceType;
    informeNumber: number;
    diagnosticReportId: string;
    triggeredByUserId: string | null;
    triggeredJobId: string;
    targetStatus: 'SYNCED' | 'ERROR';
    errorMessage?: string;
  }): Promise<{ id: string }> {
    const baseData = {
      tenantId: input.tenantId,
      diagnosticReportId: input.diagnosticReportId,
      fmSource: toFmSource(input.fmSource),
      fmInformeNumber: input.informeNumber,
      triggeredByUserId: input.triggeredByUserId,
      triggeredJobId: input.triggeredJobId,
    };

    const isError = input.targetStatus === 'ERROR';
    return this.prisma.labReportValidation.upsert({
      where: { triggeredJobId: input.triggeredJobId },
      create: {
        ...baseData,
        status: input.targetStatus,
        syncedAt: isError ? null : new Date(),
        errorMessage: input.errorMessage ?? null,
        completedAt: isError ? new Date() : null,
      },
      update: {
        status: input.targetStatus,
        // Para ERROR limpiamos syncedAt explícitamente (R3-2: evita estado contradictorio).
        syncedAt: isError ? null : new Date(),
        errorMessage: input.errorMessage ?? null,
        completedAt: isError ? new Date() : null,
      },
      select: { id: true },
    });
  }
```

- [ ] **Step 4.3: Actualizar callers de `upsertValidationRow` en `processValidation`**

Localizar `processValidation` (cerca línea 137). Hay 2 callers (happy path + catch). Ambos deben pasar `triggeredJobId`. Agregar al inicio del método después de las validaciones:

```typescript
  async processValidation(trigger: ReportValidationTrigger): Promise<void> {
    const { database, informeNumber, triggeredByUserId } = trigger;
    const tenantId = trigger.tenantId ?? this.tenantId;
    const fmSource = database as FmSourceType;

    if (!Number.isInteger(informeNumber) || informeNumber <= 0) {
      throw new Error(
        `Invalid informeNumber for validation: ${informeNumber} (database=${database})`,
      );
    }

    // jobId obligatorio en el flow normal (lo pasa el processor). Para llamadas
    // directas sin job (tests, scripts ad-hoc) generamos uno determinístico.
    const triggeredJobId =
      trigger.jobId ?? `direct-${tenantId}-${database}-${informeNumber}-${Date.now()}`;

    this.logger.log(
      `[Validation] Starting for ${database} #${informeNumber} (tenant=${tenantId}, job=${triggeredJobId})`,
    );
```

Y propagar a ambas llamadas a `upsertValidationRow`:

```typescript
      const validation = await this.upsertValidationRow({
        tenantId,
        fmSource,
        informeNumber,
        diagnosticReportId: syncResult.diagnosticReportId,
        triggeredByUserId: triggeredByUserId ?? null,
        triggeredJobId,
        targetStatus: 'SYNCED',
      });
```

```typescript
          await this.upsertValidationRow({
            tenantId,
            fmSource,
            informeNumber,
            diagnosticReportId: dr.id,
            triggeredByUserId: triggeredByUserId ?? null,
            triggeredJobId,
            targetStatus: 'ERROR',
            errorMessage: msg,
          });
```

- [ ] **Step 4.4: Quitar el TODO(F1) de upsertValidationRow**

El comentario que documentaba la deuda ya no aplica. Localizar el bloque `TODO(F1):` arriba del método y reemplazarlo por la nueva descripción (ya escrita en Step 4.2).

- [ ] **Step 4.5: Build verifica**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# esperado: Successfully compiled
```

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/src/modules/lab/services/report-validation.service.ts
git commit -m "refactor(lab): upsertValidationRow uses triggeredJobId @unique"
```

---

## Tarea 5: F0.5 — Processor pasa jobId al service

**Files:**
- Modify: `apps/api/src/modules/lab/processors/report-validation.processor.ts`

- [ ] **Step 5.1: Pasar `job.id` al trigger**

Localizar `process(job)` en `report-validation.processor.ts`. Modificar la llamada al service:

```typescript
    await this.validationService.processValidation({
      database,
      informeNumber,
      tenantId,
      triggeredByUserId,
      jobId: typeof job.id === 'string' ? job.id : String(job.id),
    });
```

- [ ] **Step 5.2: Build**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
```

- [ ] **Step 5.3: Commit**

```bash
git add apps/api/src/modules/lab/processors/report-validation.processor.ts
git commit -m "refactor(lab): processor propagates jobId for validation idempotency"
```

---

## Tarea 6: F0.5 — Tests críticos faltantes

Agregar cobertura para `processValidation` (early throws + happy path) y `upsertExam` ($transaction + spread pattern). Mock `prisma.$transaction`.

**Files:**
- Modify: `apps/api/src/modules/lab/services/report-validation.service.spec.ts`

- [ ] **Step 6.1: Extender el mock de PrismaService con `$transaction`**

Localizar `beforeEach` en el spec. Reemplazar el mock de `PrismaService` por uno completo:

```typescript
    const prismaMock = {
      labDiagnosticReport: { findFirst: prismaFindFirst },
      labReportValidation: {
        upsert: jest.fn().mockResolvedValue({ id: 'val-1' }),
      },
      labPatient: { upsert: jest.fn().mockResolvedValue({ id: 'pat-1' }) },
      labOrigin: { findFirst: jest.fn().mockResolvedValue({ id: 'orig-1' }) },
      labServiceRequest: { upsert: jest.fn().mockResolvedValue({ id: 'sr-1' }) },
      labDiagnosticReportSigner: { upsert: jest.fn().mockResolvedValue({}) },
      fmSyncLog: { create: jest.fn().mockResolvedValue({}) },
      // $transaction(callback) ejecuta el callback con el mismo prismaMock como tx.
      $transaction: jest.fn(async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock)),
    };
```

Y reemplazar la línea anterior:
```typescript
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
```

- [ ] **Step 6.2: Test — `processValidation` rechaza informeNumber inválidos**

Agregar al final del `describe('ReportValidationService')`:

```typescript
  describe('processValidation', () => {
    it('throws when informeNumber is 0', async () => {
      await expect(
        service.processValidation({ database: 'BIOPSIAS', informeNumber: 0 }),
      ).rejects.toThrow(/Invalid informeNumber/);
    });

    it('throws when informeNumber is negative', async () => {
      await expect(
        service.processValidation({ database: 'BIOPSIAS', informeNumber: -1 }),
      ).rejects.toThrow(/Invalid informeNumber/);
    });

    it('throws when informeNumber is fractional', async () => {
      await expect(
        service.processValidation({ database: 'BIOPSIAS', informeNumber: 1.5 }),
      ).rejects.toThrow(/Invalid informeNumber/);
    });
  });
```

- [ ] **Step 6.3: Run los tests nuevos**

```bash
pnpm --filter @zeru/api exec jest report-validation.service 2>&1 | tail -10
# esperado: PASS, todos los tests verde
```

- [ ] **Step 6.4: Test — upsertValidationRow usa upsert con triggeredJobId**

Agregar dentro del nuevo `describe('processValidation', ...)`:

```typescript
    it('uses triggeredJobId as the upsert key when persisting validation row', async () => {
      // Stubs mínimos para que processValidation llegue al upsertValidationRow
      // sin caer en el catch (FmApiService mockeado vacío hace fallar syncFromFm).
      // Verificamos que el catch usa el triggeredJobId provisto.
      prismaFindFirst.mockResolvedValue({ id: 'dr-1' });

      await expect(
        service.processValidation({
          database: 'BIOPSIAS',
          informeNumber: 42,
          jobId: 'test-job-abc',
        }),
      ).rejects.toBeDefined(); // FmApi mock vacío hace fallar el sync

      const upsertMock = (service as unknown as { prisma: { labReportValidation: { upsert: jest.Mock } } })
        .prisma.labReportValidation.upsert;
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { triggeredJobId: 'test-job-abc' },
          create: expect.objectContaining({ triggeredJobId: 'test-job-abc', status: 'ERROR' }),
        }),
      );
    });
```

- [ ] **Step 6.5: Run y verificar**

```bash
pnpm --filter @zeru/api exec jest report-validation.service 2>&1 | tail -10
# esperado: todos PASS
```

- [ ] **Step 6.6: Commit**

```bash
git add apps/api/src/modules/lab/services/report-validation.service.spec.ts
git commit -m "test(lab): cover processValidation guards and upsert idempotency"
```

---

## Tarea 7: F1 — Interface ValidationAgent + tipos compartidos

**Files:**
- Create: `apps/api/src/modules/lab/validation/agents/types.ts`

- [ ] **Step 7.1: Crear el directorio**

```bash
mkdir -p apps/api/src/modules/lab/validation/agents
mkdir -p apps/api/src/modules/lab/validation/services
mkdir -p apps/api/src/modules/lab/validation/listeners
```

- [ ] **Step 7.2: Escribir `types.ts`**

Crear `apps/api/src/modules/lab/validation/agents/types.ts`:

```typescript
import type { ExtractedExam } from '../../../filemaker/transformers/types';

/**
 * Input compartido por todos los agentes de validación.
 * Todo el contexto necesario para evaluar el caso, sin acceso a Prisma —
 * los agentes son funciones puras (no efectos secundarios).
 */
export interface AgentRunInput {
  tenantId: string;
  validationId: string;
  diagnosticReportId: string;
  exam: ExtractedExam;
}

/**
 * Verdict de un agente individual sobre el caso.
 * - PASS: todas las validaciones cubiertas pasaron.
 * - FAIL: al menos una validación crítica falló (severidad la marca el agente).
 * - UNCERTAIN: no se pudo evaluar (datos faltantes, dependencia externa caída).
 */
export type AgentVerdict = 'PASS' | 'FAIL' | 'UNCERTAIN';

/** Severidad de un finding individual. Define el peso en el consolidador. */
export type FindingSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Hallazgo atómico encontrado por un agente. Persiste 1:1 en
 * LabValidationFinding.
 */
export interface AgentFinding {
  /** Código de la validación (ej: 'V001', 'RI-04'). */
  code: string;
  /** Severidad del hallazgo. */
  severity: FindingSeverity;
  /** Mensaje legible para el operador. */
  message: string;
  /** Referencias opcionales al field FM o al fragmento de texto que lo originó. */
  evidence?: Record<string, unknown>;
}

export interface AgentRunResult {
  /** Identificador del agente (debe matchear ValidationAgentKey en Prisma). */
  agentKey: 'IDENTITY' | 'ORIGIN' | 'TRACEABILITY';
  verdict: AgentVerdict;
  /** Confianza 0-1 (1 = determinístico, sin dudas). */
  confidence: number;
  /** Findings individuales que generaron el verdict. */
  findings: AgentFinding[];
  /** Duración en ms del run (medida por el caller). */
  durationMs: number;
  /** Mensaje de error si verdict=UNCERTAIN. */
  errorMessage?: string;
}

/**
 * Contrato común a todos los agentes (determinísticos y LLM en F2+).
 */
export interface ValidationAgent {
  readonly key: AgentRunResult['agentKey'];
  run(input: AgentRunInput): Promise<AgentRunResult>;
}
```

- [ ] **Step 7.3: Build verifica**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# esperado: Successfully compiled
```

- [ ] **Step 7.4: Commit**

```bash
git add apps/api/src/modules/lab/validation/agents/types.ts
git commit -m "feat(lab): add ValidationAgent interface and shared types"
```

---

## Tarea 8: F1 — IdentityAgent

Cubre V001 (RUT formato + DV chileno), V002 (RUT vs nombre — solo coherencia interna del snapshot), V006 (paciente edad coherente con fecha nacimiento), V007 (nombre no vacío), V008 (subjectRut no nulo si edad > 0), RI-04 (paterno + materno consistentes), RI-05 (gender válido si presente).

**Notas de interpretación:** El cross-check RUT vs base externa es del agente `vision-request` (F3). Aquí solo coherencia interna del snapshot.

**Files:**
- Create: `apps/api/src/modules/lab/validation/agents/identity.agent.ts`
- Create: `apps/api/src/modules/lab/validation/agents/identity.agent.spec.ts`

- [ ] **Step 8.1: Spec del agente (TDD)**

Crear `apps/api/src/modules/lab/validation/agents/identity.agent.spec.ts`:

```typescript
import { IdentityAgent } from './identity.agent';
import type { AgentRunInput } from './types';
import type { ExtractedExam } from '../../../filemaker/transformers/types';

function makeExam(overrides: Partial<ExtractedExam> = {}): ExtractedExam {
  return {
    fmInformeNumber: 12345,
    fmSource: 'BIOPSIAS',
    fmRecordId: 'rec-1',
    subjectFirstName: 'Juan',
    subjectPaternalLastName: 'Pérez',
    subjectMaternalLastName: 'Soto',
    subjectRut: '123456785',
    subjectAge: 65,
    subjectGender: 'MALE',
    category: 'BIOPSY',
    subcategory: null,
    isUrgent: false,
    requestingPhysicianName: null,
    labOriginCode: 'PROC-001',
    anatomicalSite: null,
    clinicalHistory: null,
    sampleCollectedAt: null,
    receivedAt: null,
    requestedAt: null,
    status: 'VALIDATED',
    conclusion: null,
    fullText: null,
    microscopicDescription: null,
    macroscopicDescription: null,
    isAlteredOrCritical: false,
    validatedAt: null,
    issuedAt: null,
    signers: [],
    attachmentRefs: [],
    ...overrides,
  };
}

function makeInput(exam: ExtractedExam): AgentRunInput {
  return {
    tenantId: 't1',
    validationId: 'v1',
    diagnosticReportId: 'dr1',
    exam,
  };
}

describe('IdentityAgent', () => {
  const agent = new IdentityAgent();

  it('PASS when all identity fields are present and valid', async () => {
    const result = await agent.run(makeInput(makeExam()));
    expect(result.verdict).toBe('PASS');
    expect(result.findings).toHaveLength(0);
    expect(result.confidence).toBe(1);
    expect(result.agentKey).toBe('IDENTITY');
  });

  it('FAIL when subjectRut has invalid check digit (V001)', async () => {
    // 12.345.678-0 → DV correcto es 5; 0 es inválido
    const result = await agent.run(makeInput(makeExam({ subjectRut: '123456780' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V001')).toBe(true);
  });

  it('FAIL when subjectRut is null but subjectAge > 0 (V008)', async () => {
    const result = await agent.run(makeInput(makeExam({ subjectRut: null })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V008')).toBe(true);
  });

  it('FAIL when subjectFirstName is empty (V007)', async () => {
    const result = await agent.run(makeInput(makeExam({ subjectFirstName: '' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V007')).toBe(true);
  });

  it('FAIL when paternalLastName is empty (V007)', async () => {
    const result = await agent.run(makeInput(makeExam({ subjectPaternalLastName: '' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V007')).toBe(true);
  });

  it('UNCERTAIN when subjectAge is null (cannot verify V006)', async () => {
    const result = await agent.run(makeInput(makeExam({ subjectAge: null })));
    expect(result.verdict).toBe('UNCERTAIN');
    expect(result.findings.some((f) => f.code === 'V006')).toBe(true);
  });

  it('records durationMs and confidence', async () => {
    const result = await agent.run(makeInput(makeExam()));
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 8.2: Run el spec — debe FAIL (no existe el agente)**

```bash
pnpm --filter @zeru/api exec jest identity.agent 2>&1 | tail -5
# esperado: Cannot find module './identity.agent'
```

- [ ] **Step 8.3: Implementar `IdentityAgent`**

Crear `apps/api/src/modules/lab/validation/agents/identity.agent.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { AgentFinding, AgentRunInput, AgentRunResult, ValidationAgent } from './types';

@Injectable()
export class IdentityAgent implements ValidationAgent {
  readonly key = 'IDENTITY' as const;

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const start = Date.now();
    const { exam } = input;
    const findings: AgentFinding[] = [];
    let uncertain = false;

    // V007: nombre y paterno requeridos.
    if (!exam.subjectFirstName?.trim()) {
      findings.push({
        code: 'V007',
        severity: 'CRITICAL',
        message: 'subjectFirstName is empty',
      });
    }
    if (!exam.subjectPaternalLastName?.trim()) {
      findings.push({
        code: 'V007',
        severity: 'CRITICAL',
        message: 'subjectPaternalLastName is empty',
      });
    }

    // V008: si el paciente tiene edad declarada, debe haber RUT.
    if ((exam.subjectAge ?? 0) > 0 && !exam.subjectRut) {
      findings.push({
        code: 'V008',
        severity: 'CRITICAL',
        message: 'subjectAge > 0 but subjectRut is missing',
      });
    }

    // V001: validar DV chileno si hay RUT.
    if (exam.subjectRut && !isValidChileanRut(exam.subjectRut)) {
      findings.push({
        code: 'V001',
        severity: 'CRITICAL',
        message: `Invalid Chilean RUT check digit: ${exam.subjectRut}`,
        evidence: { rut: exam.subjectRut },
      });
    }

    // V006: edad no verificable sin fecha de nacimiento ni edad.
    if (exam.subjectAge == null && exam.subjectBirthDate == null) {
      findings.push({
        code: 'V006',
        severity: 'MEDIUM',
        message: 'cannot verify age coherence — neither subjectAge nor subjectBirthDate present',
      });
      uncertain = true;
    }

    // RI-04: maternal opcional, pero si existe debe ser string no vacío
    // (no es FAIL — solo INFO).
    if (exam.subjectMaternalLastName === '') {
      findings.push({
        code: 'RI-04',
        severity: 'LOW',
        message: 'maternalLastName is empty string (expected null)',
      });
    }

    // RI-05: gender válido si presente.
    if (exam.subjectGender !== null && exam.subjectGender !== undefined) {
      const valid = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'];
      if (!valid.includes(exam.subjectGender)) {
        findings.push({
          code: 'RI-05',
          severity: 'MEDIUM',
          message: `unexpected gender value: ${exam.subjectGender}`,
        });
      }
    }

    const verdict = uncertain
      ? 'UNCERTAIN'
      : findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
        ? 'FAIL'
        : 'PASS';

    return {
      agentKey: 'IDENTITY',
      verdict,
      confidence: 1,
      findings,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Valida RUT chileno (módulo 11). Asume normalización previa
 * (sin puntos ni guión, K mayúscula).
 */
function isValidChileanRut(rut: string): boolean {
  if (!/^\d+[0-9K]$/.test(rut)) return false;
  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  const expected = r === 11 ? '0' : r === 10 ? 'K' : String(r);
  return dv === expected;
}
```

- [ ] **Step 8.4: Run el spec — debe PASS**

```bash
pnpm --filter @zeru/api exec jest identity.agent 2>&1 | tail -5
# esperado: PASS, 7 tests passed
```

- [ ] **Step 8.5: Commit**

```bash
git add apps/api/src/modules/lab/validation/agents/identity.agent.ts apps/api/src/modules/lab/validation/agents/identity.agent.spec.ts
git commit -m "feat(lab): identity agent covers V001/V006/V007/V008/RI-04/RI-05"
```

---

## Tarea 9: F1 — OriginAgent

Cubre V009 (labOriginCode no vacío — ya validado por upsertExam, pero re-validamos en agente para auditoría), V010 (labOrigin existe en DB del tenant), V014 (procedencia sensible matchea léxico), V028 (snapshot vs origin actual), RI-12 (subcategoría matchea categoría).

**Notas de interpretación:** Este agente **sí** consulta DB (a diferencia de identity) porque necesita `LabSensitiveOrigin` y validar que `labOriginCode` existe.

**Files:**
- Create: `apps/api/src/modules/lab/validation/agents/origin.agent.ts`
- Create: `apps/api/src/modules/lab/validation/agents/origin.agent.spec.ts`

- [ ] **Step 9.1: Spec del agente (TDD)**

Crear `apps/api/src/modules/lab/validation/agents/origin.agent.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { OriginAgent } from './origin.agent';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AgentRunInput } from './types';
import type { ExtractedExam } from '../../../filemaker/transformers/types';

function makeExam(overrides: Partial<ExtractedExam> = {}): ExtractedExam {
  return {
    fmInformeNumber: 12345,
    fmSource: 'BIOPSIAS',
    fmRecordId: 'rec-1',
    subjectFirstName: 'Juan',
    subjectPaternalLastName: 'Pérez',
    subjectMaternalLastName: null,
    subjectRut: '123456785',
    subjectAge: 65,
    subjectGender: 'MALE',
    category: 'BIOPSY',
    subcategory: null,
    isUrgent: false,
    requestingPhysicianName: null,
    labOriginCode: 'PROC-001',
    anatomicalSite: null,
    clinicalHistory: null,
    sampleCollectedAt: null,
    receivedAt: null,
    requestedAt: null,
    status: 'VALIDATED',
    conclusion: null,
    fullText: null,
    microscopicDescription: null,
    macroscopicDescription: null,
    isAlteredOrCritical: false,
    validatedAt: null,
    issuedAt: null,
    signers: [],
    attachmentRefs: [],
    ...overrides,
  };
}

function makeInput(exam: ExtractedExam): AgentRunInput {
  return { tenantId: 't1', validationId: 'v1', diagnosticReportId: 'dr1', exam };
}

describe('OriginAgent', () => {
  let agent: OriginAgent;
  let labOriginFindFirst: jest.Mock;
  let sensitiveFindFirst: jest.Mock;

  beforeEach(async () => {
    labOriginFindFirst = jest.fn();
    sensitiveFindFirst = jest.fn().mockResolvedValue(null);

    const module = await Test.createTestingModule({
      providers: [
        OriginAgent,
        {
          provide: PrismaService,
          useValue: {
            labOrigin: { findFirst: labOriginFindFirst },
            labSensitiveOrigin: { findFirst: sensitiveFindFirst },
          },
        },
      ],
    }).compile();

    agent = module.get(OriginAgent);
  });

  it('PASS when origin exists and is not sensitive', async () => {
    labOriginFindFirst.mockResolvedValue({ id: 'orig-1', name: 'Hospital X' });
    const result = await agent.run(makeInput(makeExam()));
    expect(result.verdict).toBe('PASS');
    expect(result.findings).toHaveLength(0);
  });

  it('FAIL when labOriginCode is empty (V009)', async () => {
    const result = await agent.run(makeInput(makeExam({ labOriginCode: '' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V009')).toBe(true);
  });

  it('FAIL when labOrigin does not exist in tenant (V010)', async () => {
    labOriginFindFirst.mockResolvedValue(null);
    const result = await agent.run(makeInput(makeExam({ labOriginCode: 'GHOST-999' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V010')).toBe(true);
  });

  it('flags as sensitive when origin name matches sensitive lexicon (V014)', async () => {
    labOriginFindFirst.mockResolvedValue({ id: 'orig-1', name: 'HTSP Cardiología' });
    sensitiveFindFirst.mockResolvedValue({ id: 'sens-1', nameMatch: 'HTSP' });
    const result = await agent.run(makeInput(makeExam()));
    // Sensible no es FAIL: es flag para criticality agent (F2). Aquí registramos INFO.
    expect(result.verdict).toBe('PASS');
    expect(result.findings.some((f) => f.code === 'V014' && f.severity === 'INFO')).toBe(true);
  });
});
```

- [ ] **Step 9.2: Run — debe FAIL**

```bash
pnpm --filter @zeru/api exec jest origin.agent 2>&1 | tail -5
# esperado: Cannot find module
```

- [ ] **Step 9.3: Implementar `OriginAgent`**

Crear `apps/api/src/modules/lab/validation/agents/origin.agent.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AgentFinding, AgentRunInput, AgentRunResult, ValidationAgent } from './types';

@Injectable()
export class OriginAgent implements ValidationAgent {
  readonly key = 'ORIGIN' as const;

  constructor(private readonly prisma: PrismaService) {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const start = Date.now();
    const { tenantId, exam } = input;
    const findings: AgentFinding[] = [];

    // V009: labOriginCode no vacío.
    if (!exam.labOriginCode || !exam.labOriginCode.trim()) {
      findings.push({
        code: 'V009',
        severity: 'CRITICAL',
        message: 'labOriginCode is empty in FM record',
      });
      // Sin código no podemos chequear V010/V014 — terminamos.
      return {
        agentKey: 'ORIGIN',
        verdict: 'FAIL',
        confidence: 1,
        findings,
        durationMs: Date.now() - start,
      };
    }

    // V010: el código existe en la tabla LabOrigin del tenant.
    const origin = await this.prisma.labOrigin.findFirst({
      where: { tenantId, code: exam.labOriginCode },
      select: { id: true, name: true },
    });

    if (!origin) {
      findings.push({
        code: 'V010',
        severity: 'CRITICAL',
        message: `labOriginCode ${exam.labOriginCode} not found in tenant origins`,
        evidence: { labOriginCode: exam.labOriginCode },
      });
      return {
        agentKey: 'ORIGIN',
        verdict: 'FAIL',
        confidence: 1,
        findings,
        durationMs: Date.now() - start,
      };
    }

    // V014: si el nombre del origin matchea LabSensitiveOrigin → flag INFO
    // (criticality agent en F2 lo eleva a CRITICAL si corresponde).
    // Cargamos toda la lista del tenant — son pocos rows (≤20 esperado para
    // Citolab) y el match es por substring case-insensitive en aplicación,
    // no expresable como índice Postgres.
    const sensitiveList = await this.prisma.labSensitiveOrigin.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, nameMatch: true },
    });
    const matchedSensitive = sensitiveList.find((s) =>
      origin.name.toUpperCase().includes(s.nameMatch.toUpperCase()),
    );
    if (matchedSensitive) {
      findings.push({
        code: 'V014',
        severity: 'INFO',
        message: `origin matches sensitive pattern "${matchedSensitive.nameMatch}"`,
        evidence: { sensitiveId: matchedSensitive.id, originName: origin.name },
      });
    }

    return {
      agentKey: 'ORIGIN',
      verdict: 'PASS',
      confidence: 1,
      findings,
      durationMs: Date.now() - start,
    };
  }
}
```

- [ ] **Step 9.4: Ajustar el spec para usar `findMany`**

En `origin.agent.spec.ts`, cambiar el mock:

```typescript
    sensitiveFindMany = jest.fn().mockResolvedValue([]);
    ...
    {
      provide: PrismaService,
      useValue: {
        labOrigin: { findFirst: labOriginFindFirst },
        labSensitiveOrigin: { findMany: sensitiveFindMany },
      },
    },
```

Y en el test de "flags as sensitive":

```typescript
    sensitiveFindMany.mockResolvedValue([{ id: 'sens-1', nameMatch: 'HTSP' }]);
```

Renombrar también la declaración: `let sensitiveFindMany: jest.Mock;` (era `sensitiveFindFirst`).

- [ ] **Step 9.5: Run — debe PASS**

```bash
pnpm --filter @zeru/api exec jest origin.agent 2>&1 | tail -5
# esperado: PASS, 4 tests
```

- [ ] **Step 9.6: Commit**

```bash
git add apps/api/src/modules/lab/validation/agents/origin.agent.ts apps/api/src/modules/lab/validation/agents/origin.agent.spec.ts
git commit -m "feat(lab): origin agent covers V009/V010/V014"
```

---

## Tarea 10: F1 — TraceabilityAgent

Cubre V032 (al menos un signer presente), V033 (signers tienen orden secuencial 1..N sin huecos), V034 (al menos un PRIMARY_PATHOLOGIST si BIOPSIA), V038 (validatedAt presente si status=VALIDATED+), V039 (validatedAt ≥ requestedAt si ambos presentes), V040 (validatedAt ≥ sampleCollectedAt si ambos presentes), V041 (issuedAt ≥ validatedAt), V042 (PDF attachment ref existe si status=DELIVERED), V043 (S3 key del PDF tiene formato válido).

**Files:**
- Create: `apps/api/src/modules/lab/validation/agents/traceability.agent.ts`
- Create: `apps/api/src/modules/lab/validation/agents/traceability.agent.spec.ts`

- [ ] **Step 10.1: Spec del agente (TDD)**

Crear `apps/api/src/modules/lab/validation/agents/traceability.agent.spec.ts`:

```typescript
import { TraceabilityAgent } from './traceability.agent';
import type { AgentRunInput } from './types';
import type { ExtractedExam, ExtractedSigner, ExtractedAttachmentRef } from '../../../filemaker/transformers/types';

function makeSigner(overrides: Partial<ExtractedSigner> = {}): ExtractedSigner {
  return {
    codeSnapshot: 'PAT-001',
    nameSnapshot: 'Dr. Pérez',
    role: 'PRIMARY_PATHOLOGIST',
    signatureOrder: 1,
    signedAt: new Date('2026-03-15'),
    isActive: true,
    supersededBy: null,
    correctionReason: null,
    ...overrides,
  };
}

function makePdfRef(): ExtractedAttachmentRef {
  return {
    category: 'REPORT_PDF',
    label: 'Informe 12345',
    sequenceOrder: 0,
    s3Key: 'Biopsias/PROC-001/2026/03/12345.pdf',
    contentType: 'application/pdf',
    fmSourceField: 'INFORMES PDF::PDF INFORME',
    fmContainerUrlOriginal: 'https://fm.example/.../12345.pdf',
    citolabS3KeyOriginal: null,
  };
}

function makeExam(overrides: Partial<ExtractedExam> = {}): ExtractedExam {
  return {
    fmInformeNumber: 12345,
    fmSource: 'BIOPSIAS',
    fmRecordId: 'rec-1',
    subjectFirstName: 'Juan',
    subjectPaternalLastName: 'Pérez',
    subjectMaternalLastName: null,
    subjectRut: '123456785',
    subjectAge: 65,
    subjectGender: 'MALE',
    category: 'BIOPSY',
    subcategory: null,
    isUrgent: false,
    requestingPhysicianName: null,
    labOriginCode: 'PROC-001',
    anatomicalSite: null,
    clinicalHistory: null,
    sampleCollectedAt: new Date('2026-03-10'),
    receivedAt: null,
    requestedAt: new Date('2026-03-10'),
    status: 'VALIDATED',
    conclusion: null,
    fullText: null,
    microscopicDescription: null,
    macroscopicDescription: null,
    isAlteredOrCritical: false,
    validatedAt: new Date('2026-03-15'),
    issuedAt: new Date('2026-03-15'),
    signers: [makeSigner()],
    attachmentRefs: [makePdfRef()],
    ...overrides,
  };
}

function makeInput(exam: ExtractedExam): AgentRunInput {
  return { tenantId: 't1', validationId: 'v1', diagnosticReportId: 'dr1', exam };
}

describe('TraceabilityAgent', () => {
  const agent = new TraceabilityAgent();

  it('PASS for a complete BIOPSIA with signer + dates + PDF', async () => {
    const result = await agent.run(makeInput(makeExam()));
    expect(result.verdict).toBe('PASS');
    expect(result.findings).toHaveLength(0);
  });

  it('FAIL when signers list is empty (V032)', async () => {
    const result = await agent.run(makeInput(makeExam({ signers: [] })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V032')).toBe(true);
  });

  it('FAIL when signer order has gaps (V033)', async () => {
    const result = await agent.run(makeInput(makeExam({
      signers: [
        makeSigner({ signatureOrder: 1 }),
        makeSigner({ signatureOrder: 3, codeSnapshot: 'PAT-002', nameSnapshot: 'Dr. B' }),
      ],
    })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V033')).toBe(true);
  });

  it('FAIL when no PRIMARY_PATHOLOGIST in BIOPSY (V034)', async () => {
    const result = await agent.run(makeInput(makeExam({
      signers: [makeSigner({ role: 'SUPERVISING_PATHOLOGIST' })],
    })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V034')).toBe(true);
  });

  it('FAIL when validatedAt is null but status=VALIDATED (V038)', async () => {
    const result = await agent.run(makeInput(makeExam({ validatedAt: null })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V038')).toBe(true);
  });

  it('FAIL when validatedAt is before requestedAt (V039)', async () => {
    const result = await agent.run(makeInput(makeExam({
      requestedAt: new Date('2026-03-20'),
      validatedAt: new Date('2026-03-15'),
    })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V039')).toBe(true);
  });

  it('FAIL when issuedAt is before validatedAt (V041)', async () => {
    const result = await agent.run(makeInput(makeExam({
      validatedAt: new Date('2026-03-15'),
      issuedAt: new Date('2026-03-10'),
    })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V041')).toBe(true);
  });

  it('FAIL when status=DELIVERED but no PDF attachment ref (V042)', async () => {
    const result = await agent.run(makeInput(makeExam({
      status: 'DELIVERED',
      attachmentRefs: [],
    })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V042')).toBe(true);
  });
});
```

- [ ] **Step 10.2: Run — debe FAIL**

```bash
pnpm --filter @zeru/api exec jest traceability.agent 2>&1 | tail -5
# esperado: Cannot find module
```

- [ ] **Step 10.3: Implementar `TraceabilityAgent`**

Crear `apps/api/src/modules/lab/validation/agents/traceability.agent.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { AgentFinding, AgentRunInput, AgentRunResult, ValidationAgent } from './types';

const VALIDATED_STATUSES = ['VALIDATED', 'SIGNED', 'DELIVERED', 'DOWNLOADED'];

@Injectable()
export class TraceabilityAgent implements ValidationAgent {
  readonly key = 'TRACEABILITY' as const;

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const start = Date.now();
    const { exam } = input;
    const findings: AgentFinding[] = [];

    // V032: al menos un signer en estados validados.
    if (VALIDATED_STATUSES.includes(exam.status) && exam.signers.length === 0) {
      findings.push({
        code: 'V032',
        severity: 'CRITICAL',
        message: `status=${exam.status} but signers list is empty`,
      });
    }

    // V033: signatureOrder secuencial 1..N sin huecos.
    if (exam.signers.length > 0) {
      const orders = [...exam.signers].map((s) => s.signatureOrder).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          findings.push({
            code: 'V033',
            severity: 'HIGH',
            message: `signer order has gap or duplicate: expected ${i + 1}, got ${orders[i]}`,
            evidence: { orders },
          });
          break;
        }
      }
    }

    // V034: BIOPSY requiere al menos un PRIMARY_PATHOLOGIST.
    if (exam.category === 'BIOPSY' && VALIDATED_STATUSES.includes(exam.status)) {
      const hasPrimary = exam.signers.some((s) => s.role === 'PRIMARY_PATHOLOGIST' && s.isActive);
      if (!hasPrimary) {
        findings.push({
          code: 'V034',
          severity: 'CRITICAL',
          message: 'BIOPSY validated without active PRIMARY_PATHOLOGIST signer',
        });
      }
    }

    // V038: validatedAt requerido si status indica validación o más adelante.
    if (VALIDATED_STATUSES.includes(exam.status) && !exam.validatedAt) {
      findings.push({
        code: 'V038',
        severity: 'CRITICAL',
        message: `status=${exam.status} but validatedAt is null`,
      });
    }

    // V039: validatedAt >= requestedAt (si ambos presentes).
    if (
      exam.validatedAt &&
      exam.requestedAt &&
      exam.validatedAt.getTime() < exam.requestedAt.getTime()
    ) {
      findings.push({
        code: 'V039',
        severity: 'HIGH',
        message: 'validatedAt is earlier than requestedAt',
        evidence: { requestedAt: exam.requestedAt, validatedAt: exam.validatedAt },
      });
    }

    // V040: validatedAt >= sampleCollectedAt (si ambos presentes).
    if (
      exam.validatedAt &&
      exam.sampleCollectedAt &&
      exam.validatedAt.getTime() < exam.sampleCollectedAt.getTime()
    ) {
      findings.push({
        code: 'V040',
        severity: 'HIGH',
        message: 'validatedAt is earlier than sampleCollectedAt',
      });
    }

    // V041: issuedAt >= validatedAt (si ambos presentes).
    if (
      exam.validatedAt &&
      exam.issuedAt &&
      exam.issuedAt.getTime() < exam.validatedAt.getTime()
    ) {
      findings.push({
        code: 'V041',
        severity: 'HIGH',
        message: 'issuedAt is earlier than validatedAt',
      });
    }

    // V042: status DELIVERED requiere ref de PDF.
    if (exam.status === 'DELIVERED' || exam.status === 'DOWNLOADED') {
      const hasPdf = exam.attachmentRefs.some((a) => a.category === 'REPORT_PDF');
      if (!hasPdf) {
        findings.push({
          code: 'V042',
          severity: 'HIGH',
          message: `status=${exam.status} but no REPORT_PDF attachment ref`,
        });
      }
    }

    // V043: s3Key del PDF debe seguir formato {Categoria}/{origen}/{año}/{mes}/{informe}.pdf
    const pdf = exam.attachmentRefs.find((a) => a.category === 'REPORT_PDF');
    if (pdf && !/^[A-Za-z]+\/[^/]+\/\d{4}\/\d{2}\/\d+\.pdf$/.test(pdf.s3Key)) {
      findings.push({
        code: 'V043',
        severity: 'MEDIUM',
        message: `unexpected s3Key format: ${pdf.s3Key}`,
        evidence: { s3Key: pdf.s3Key },
      });
    }

    const verdict = findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
      ? 'FAIL'
      : 'PASS';

    return {
      agentKey: 'TRACEABILITY',
      verdict,
      confidence: 1,
      findings,
      durationMs: Date.now() - start,
    };
  }
}
```

- [ ] **Step 10.4: Run — debe PASS**

```bash
pnpm --filter @zeru/api exec jest traceability.agent 2>&1 | tail -5
# esperado: PASS, 8 tests
```

- [ ] **Step 10.5: Commit**

```bash
git add apps/api/src/modules/lab/validation/agents/traceability.agent.ts apps/api/src/modules/lab/validation/agents/traceability.agent.spec.ts
git commit -m "feat(lab): traceability agent covers V032/V033/V034/V038-V043"
```

---

## Tarea 11: F1 — Consolidador

Mapea findings de los 3 agentes a verdict global del `LabReportValidation`. Reglas (del spec §5.4):
- Si **cualquier agente con severity CRITICAL → FAIL**: global FAIL
- Si todos PASS: global PASS
- Si algún UNCERTAIN sin FAIL: global UNCERTAIN

**Files:**
- Create: `apps/api/src/modules/lab/validation/services/consolidator.service.ts`
- Create: `apps/api/src/modules/lab/validation/services/consolidator.service.spec.ts`

- [ ] **Step 11.1: Spec del consolidator**

Crear `apps/api/src/modules/lab/validation/services/consolidator.service.spec.ts`:

```typescript
import { ConsolidatorService } from './consolidator.service';
import type { AgentRunResult } from '../agents/types';

function passResult(agentKey: AgentRunResult['agentKey']): AgentRunResult {
  return { agentKey, verdict: 'PASS', confidence: 1, findings: [], durationMs: 5 };
}

function failResult(agentKey: AgentRunResult['agentKey'], severity: 'CRITICAL' | 'HIGH' = 'CRITICAL'): AgentRunResult {
  return {
    agentKey,
    verdict: 'FAIL',
    confidence: 1,
    findings: [{ code: 'X', severity, message: 'failed' }],
    durationMs: 5,
  };
}

function uncertainResult(agentKey: AgentRunResult['agentKey']): AgentRunResult {
  return {
    agentKey,
    verdict: 'UNCERTAIN',
    confidence: 0.5,
    findings: [{ code: 'V006', severity: 'MEDIUM', message: 'unknown' }],
    durationMs: 5,
  };
}

describe('ConsolidatorService', () => {
  const consolidator = new ConsolidatorService();

  it('PASS when all agents PASS', () => {
    const result = consolidator.consolidate([
      passResult('IDENTITY'),
      passResult('ORIGIN'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.verdict).toBe('PASS');
    expect(result.confidenceAvg).toBe(1);
    expect(result.isCritical).toBe(false);
  });

  it('FAIL when any agent has CRITICAL finding', () => {
    const result = consolidator.consolidate([
      passResult('IDENTITY'),
      failResult('ORIGIN', 'CRITICAL'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.verdict).toBe('FAIL');
    expect(result.isCritical).toBe(true);
  });

  it('FAIL when only HIGH findings (no CRITICAL)', () => {
    const result = consolidator.consolidate([
      passResult('IDENTITY'),
      failResult('TRACEABILITY', 'HIGH'),
      passResult('ORIGIN'),
    ]);
    expect(result.verdict).toBe('FAIL');
    expect(result.isCritical).toBe(false);
  });

  it('UNCERTAIN when one agent UNCERTAIN and rest PASS', () => {
    const result = consolidator.consolidate([
      uncertainResult('IDENTITY'),
      passResult('ORIGIN'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.verdict).toBe('UNCERTAIN');
  });

  it('FAIL takes precedence over UNCERTAIN', () => {
    const result = consolidator.consolidate([
      uncertainResult('IDENTITY'),
      failResult('ORIGIN', 'CRITICAL'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.verdict).toBe('FAIL');
  });

  it('confidenceAvg averages confidence across agents', () => {
    const result = consolidator.consolidate([
      passResult('IDENTITY'),
      uncertainResult('ORIGIN'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.confidenceAvg).toBeCloseTo((1 + 0.5 + 1) / 3, 4);
  });
});
```

- [ ] **Step 11.2: Run — debe FAIL**

```bash
pnpm --filter @zeru/api exec jest consolidator 2>&1 | tail -5
```

- [ ] **Step 11.3: Implementar `ConsolidatorService`**

Crear `apps/api/src/modules/lab/validation/services/consolidator.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { AgentRunResult, AgentVerdict } from '../agents/types';

export interface ConsolidatedVerdict {
  verdict: AgentVerdict;
  confidenceAvg: number;
  isCritical: boolean;
  isAcuteCritical: boolean;
  totalFindings: number;
}

@Injectable()
export class ConsolidatorService {
  consolidate(runs: AgentRunResult[]): ConsolidatedVerdict {
    const totalFindings = runs.reduce((sum, r) => sum + r.findings.length, 0);
    const confidenceAvg = runs.length === 0
      ? 0
      : runs.reduce((sum, r) => sum + r.confidence, 0) / runs.length;

    const hasCritical = runs.some((r) =>
      r.findings.some((f) => f.severity === 'CRITICAL'),
    );
    const hasFail = runs.some((r) => r.verdict === 'FAIL');
    const hasUncertain = runs.some((r) => r.verdict === 'UNCERTAIN');

    let verdict: AgentVerdict;
    if (hasFail) {
      verdict = 'FAIL';
    } else if (hasUncertain) {
      verdict = 'UNCERTAIN';
    } else {
      verdict = 'PASS';
    }

    return {
      verdict,
      confidenceAvg,
      isCritical: hasCritical,
      isAcuteCritical: false, // F2 calcula este flag con criticality agent
      totalFindings,
    };
  }
}
```

- [ ] **Step 11.4: Run — debe PASS**

```bash
pnpm --filter @zeru/api exec jest consolidator 2>&1 | tail -5
# esperado: PASS, 6 tests
```

- [ ] **Step 11.5: Commit**

```bash
git add apps/api/src/modules/lab/validation/services/consolidator.service.ts apps/api/src/modules/lab/validation/services/consolidator.service.spec.ts
git commit -m "feat(lab): consolidator maps agent runs to global verdict"
```

---

## Tarea 12: F1 — AgentRunner (dispatch + persistencia)

Servicio que orquesta los 3 agentes en paralelo (Promise.allSettled + timeout 30s), persiste cada run en `LabValidationAgentRun`, y persiste los findings en `LabValidationFinding`.

**Files:**
- Create: `apps/api/src/modules/lab/validation/services/agent-runner.service.ts`
- Create: `apps/api/src/modules/lab/validation/services/agent-runner.service.spec.ts`

- [ ] **Step 12.1: Spec del runner**

Crear `apps/api/src/modules/lab/validation/services/agent-runner.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AgentRunnerService } from './agent-runner.service';
import { ConsolidatorService } from './consolidator.service';
import { IdentityAgent } from '../agents/identity.agent';
import { OriginAgent } from '../agents/origin.agent';
import { TraceabilityAgent } from '../agents/traceability.agent';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AgentRunResult } from '../agents/types';
import type { ExtractedExam } from '../../../filemaker/transformers/types';

function makeExam(): ExtractedExam {
  return {
    fmInformeNumber: 12345, fmSource: 'BIOPSIAS', fmRecordId: 'r1',
    subjectFirstName: 'A', subjectPaternalLastName: 'B', subjectMaternalLastName: null,
    subjectRut: '123456785', subjectAge: 65, subjectGender: 'MALE',
    category: 'BIOPSY', subcategory: null, isUrgent: false,
    requestingPhysicianName: null, labOriginCode: 'PROC-001',
    anatomicalSite: null, clinicalHistory: null,
    sampleCollectedAt: null, receivedAt: null, requestedAt: null,
    status: 'VALIDATED', conclusion: null, fullText: null,
    microscopicDescription: null, macroscopicDescription: null,
    isAlteredOrCritical: false, validatedAt: new Date(), issuedAt: new Date(),
    signers: [], attachmentRefs: [],
  };
}

describe('AgentRunnerService', () => {
  let runner: AgentRunnerService;
  let agentRunCreate: jest.Mock;
  let findingCreate: jest.Mock;
  let validationUpdate: jest.Mock;
  let identityRun: jest.Mock;

  beforeEach(async () => {
    agentRunCreate = jest.fn().mockResolvedValue({ id: 'run-1' });
    findingCreate = jest.fn().mockResolvedValue({ id: 'finding-1' });
    validationUpdate = jest.fn().mockResolvedValue({ id: 'val-1' });
    identityRun = jest.fn().mockResolvedValue({
      agentKey: 'IDENTITY', verdict: 'PASS', confidence: 1, findings: [], durationMs: 5,
    } satisfies AgentRunResult);

    const module = await Test.createTestingModule({
      providers: [
        AgentRunnerService,
        ConsolidatorService,
        { provide: IdentityAgent, useValue: { key: 'IDENTITY', run: identityRun } },
        { provide: OriginAgent, useValue: { key: 'ORIGIN', run: jest.fn().mockResolvedValue({
          agentKey: 'ORIGIN', verdict: 'PASS', confidence: 1, findings: [], durationMs: 5,
        }) } },
        { provide: TraceabilityAgent, useValue: { key: 'TRACEABILITY', run: jest.fn().mockResolvedValue({
          agentKey: 'TRACEABILITY', verdict: 'PASS', confidence: 1, findings: [], durationMs: 5,
        }) } },
        {
          provide: PrismaService,
          useValue: {
            labValidationAgentRun: { create: agentRunCreate },
            labValidationFinding: { create: findingCreate },
            labReportValidation: { update: validationUpdate },
          },
        },
      ],
    }).compile();

    runner = module.get(AgentRunnerService);
  });

  it('runs all 3 agents and persists each run', async () => {
    await runner.runAll({
      tenantId: 't1', validationId: 'v1', diagnosticReportId: 'dr1', exam: makeExam(),
    });
    expect(identityRun).toHaveBeenCalledTimes(1);
    expect(agentRunCreate).toHaveBeenCalledTimes(3);
  });

  it('updates LabReportValidation with final verdict', async () => {
    await runner.runAll({
      tenantId: 't1', validationId: 'v1', diagnosticReportId: 'dr1', exam: makeExam(),
    });
    expect(validationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'v1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        verdict: 'PASS',
      }),
    }));
  });

  it('marks validation as ERROR if all agents throw', async () => {
    identityRun.mockRejectedValue(new Error('boom'));
    // Sobreescribir los otros también para forzar todos a UNCERTAIN
    // (en runner.ts un throw se mapea a verdict UNCERTAIN, no ERROR — verificamos UNCERTAIN).
    const result = await runner.runAll({
      tenantId: 't1', validationId: 'v1', diagnosticReportId: 'dr1', exam: makeExam(),
    });
    // Identity fue UNCERTAIN; los otros 2 PASSed; consolidado es UNCERTAIN.
    expect(result.verdict).toBe('UNCERTAIN');
  });
});
```

- [ ] **Step 12.2: Run — debe FAIL**

```bash
pnpm --filter @zeru/api exec jest agent-runner 2>&1 | tail -5
```

- [ ] **Step 12.3: Implementar `AgentRunnerService`**

Crear `apps/api/src/modules/lab/validation/services/agent-runner.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IdentityAgent } from '../agents/identity.agent';
import { OriginAgent } from '../agents/origin.agent';
import { TraceabilityAgent } from '../agents/traceability.agent';
import type { AgentRunInput, AgentRunResult, ValidationAgent } from '../agents/types';
import { ConsolidatorService, type ConsolidatedVerdict } from './consolidator.service';

const AGENT_TIMEOUT_MS = 30_000;

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private readonly agents: ValidationAgent[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly consolidator: ConsolidatorService,
    identity: IdentityAgent,
    origin: OriginAgent,
    traceability: TraceabilityAgent,
  ) {
    this.agents = [identity, origin, traceability];
  }

  /**
   * Ejecuta los 3 agentes en paralelo, persiste runs+findings,
   * actualiza LabReportValidation a COMPLETED con verdict.
   */
  async runAll(input: AgentRunInput): Promise<ConsolidatedVerdict> {
    this.logger.log(
      `[Validation ${input.validationId}] running ${this.agents.length} agents`,
    );

    // Marcar como ANALYZING al iniciar.
    await this.prisma.labReportValidation.update({
      where: { id: input.validationId },
      data: { status: 'ANALYZING', analysisStartedAt: new Date() },
    });

    const results = await Promise.all(
      this.agents.map((agent) => this.runOne(agent, input)),
    );

    // Persistir cada run + sus findings.
    for (const result of results) {
      const run = await this.prisma.labValidationAgentRun.create({
        data: {
          validationId: input.validationId,
          agentKey: result.agentKey,
          verdict: result.verdict === 'PASS' ? 'PASS' : result.verdict === 'FAIL' ? 'FAIL' : 'UNCERTAIN',
          severity: highestSeverity(result),
          confidence: result.confidence,
          durationMs: result.durationMs,
          model: null,
          provider: null,
        },
      });
      for (const finding of result.findings) {
        await this.prisma.labValidationFinding.create({
          data: {
            tenantId: input.tenantId,
            validationId: input.validationId,
            agentRunId: run.id,
            agentKey: result.agentKey,
            code: finding.code,
            severity: finding.severity,
            message: finding.message,
            evidence: finding.evidence ?? {},
          },
        });
      }
    }

    const consolidated = this.consolidator.consolidate(results);

    await this.prisma.labReportValidation.update({
      where: { id: input.validationId },
      data: {
        status: 'COMPLETED',
        verdict: consolidated.verdict,
        confidenceAvg: consolidated.confidenceAvg,
        isCritical: consolidated.isCritical,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `[Validation ${input.validationId}] ${consolidated.verdict} ` +
        `(${consolidated.totalFindings} findings, conf=${consolidated.confidenceAvg.toFixed(2)})`,
    );

    return consolidated;
  }

  /** Ejecuta un agente con timeout. Si falla o excede timeout → UNCERTAIN. */
  private async runOne(agent: ValidationAgent, input: AgentRunInput): Promise<AgentRunResult> {
    const start = Date.now();
    try {
      const result = await Promise.race([
        agent.run(input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`agent ${agent.key} timeout`)), AGENT_TIMEOUT_MS),
        ),
      ]);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Validation ${input.validationId}] agent ${agent.key} failed: ${msg}`);
      return {
        agentKey: agent.key,
        verdict: 'UNCERTAIN',
        confidence: 0,
        findings: [],
        durationMs: Date.now() - start,
        errorMessage: msg,
      };
    }
  }
}

function highestSeverity(r: AgentRunResult): 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const order = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
  return r.findings.reduce<'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(
    (acc, f) => (order[f.severity] > order[acc] ? f.severity : acc),
    'INFO',
  );
}
```

- [ ] **Step 12.4: Verificar enums Prisma para `agentKey`, `verdict`, `severity`**

```bash
grep -nE "ValidationAgentKey|FindingVerdict|FindingSeverity" apps/api/prisma/schema.prisma | head -10
# esperado: enums existen con valores que matchean los strings literales del runner
```

Si los nombres no matchean exactamente, ajustar las llamadas a Prisma para usar los valores correctos del enum.

- [ ] **Step 12.5: Run el spec**

```bash
pnpm --filter @zeru/api exec jest agent-runner 2>&1 | tail -10
# esperado: PASS, 3 tests
```

- [ ] **Step 12.6: Commit**

```bash
git add apps/api/src/modules/lab/validation/services/agent-runner.service.ts apps/api/src/modules/lab/validation/services/agent-runner.service.spec.ts
git commit -m "feat(lab): agent runner dispatches and persists agent runs + findings"
```

---

## Tarea 13: F1 — Listener del evento

Suscribe `lab.report.validation.synced` y dispara `AgentRunnerService.runAll`.

**Files:**
- Create: `apps/api/src/modules/lab/validation/listeners/validation-synced.listener.ts`
- Create: `apps/api/src/modules/lab/validation/listeners/validation-synced.listener.spec.ts`

- [ ] **Step 13.1: Spec del listener**

Crear `apps/api/src/modules/lab/validation/listeners/validation-synced.listener.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ValidationSyncedListener } from './validation-synced.listener';
import { AgentRunnerService } from '../services/agent-runner.service';

describe('ValidationSyncedListener', () => {
  let listener: ValidationSyncedListener;
  let runAll: jest.Mock;

  beforeEach(async () => {
    runAll = jest.fn().mockResolvedValue({ verdict: 'PASS' });
    const module = await Test.createTestingModule({
      providers: [
        ValidationSyncedListener,
        { provide: AgentRunnerService, useValue: { runAll } },
      ],
    }).compile();
    listener = module.get(ValidationSyncedListener);
  });

  it('forwards event payload to AgentRunnerService.runAll', async () => {
    const payload = {
      validationId: 'v1',
      tenantId: 't1',
      diagnosticReportId: 'dr1',
      serviceRequestId: 'sr1',
      fmSource: 'BIOPSIAS',
      fmInformeNumber: 42,
      exam: {} as never,
      pdfBuffer: null,
    };
    await listener.handle(payload);
    expect(runAll).toHaveBeenCalledWith({
      tenantId: 't1',
      validationId: 'v1',
      diagnosticReportId: 'dr1',
      exam: payload.exam,
    });
  });

  it('does not throw when runner throws (event handler isolation)', async () => {
    runAll.mockRejectedValue(new Error('boom'));
    await expect(listener.handle({
      validationId: 'v1',
      tenantId: 't1',
      diagnosticReportId: 'dr1',
      serviceRequestId: 'sr1',
      fmSource: 'BIOPSIAS',
      fmInformeNumber: 42,
      exam: {} as never,
      pdfBuffer: null,
    })).resolves.not.toThrow();
  });
});
```

- [ ] **Step 13.2: Implementar el listener**

Crear `apps/api/src/modules/lab/validation/listeners/validation-synced.listener.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AgentRunnerService } from '../services/agent-runner.service';
import type { ExtractedExam } from '../../../filemaker/transformers/types';

interface ValidationSyncedPayload {
  validationId: string;
  tenantId: string;
  diagnosticReportId: string;
  serviceRequestId: string;
  fmSource: string;
  fmInformeNumber: number;
  exam: ExtractedExam;
  pdfBuffer: Buffer | null;
}

@Injectable()
export class ValidationSyncedListener {
  private readonly logger = new Logger(ValidationSyncedListener.name);

  constructor(private readonly runner: AgentRunnerService) {}

  @OnEvent('lab.report.validation.synced', { async: true })
  async handle(payload: ValidationSyncedPayload): Promise<void> {
    try {
      await this.runner.runAll({
        tenantId: payload.tenantId,
        validationId: payload.validationId,
        diagnosticReportId: payload.diagnosticReportId,
        exam: payload.exam,
      });
    } catch (err) {
      // Aislamiento del listener: NUNCA propagar al EventEmitter.
      // El runner ya marcó la validation como ERROR si correspondía.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[Validation ${payload.validationId}] runner failed at top level: ${msg}`,
      );
    }
  }
}
```

- [ ] **Step 13.3: Run el spec**

```bash
pnpm --filter @zeru/api exec jest validation-synced 2>&1 | tail -5
# esperado: PASS, 2 tests
```

- [ ] **Step 13.4: Commit**

```bash
git add apps/api/src/modules/lab/validation/listeners/validation-synced.listener.ts apps/api/src/modules/lab/validation/listeners/validation-synced.listener.spec.ts
git commit -m "feat(lab): validation-synced listener dispatches agents"
```

---

## Tarea 14: F1 — ValidationModule + integración con LabModule

**Files:**
- Create: `apps/api/src/modules/lab/validation/validation.module.ts`
- Modify: `apps/api/src/modules/lab/lab.module.ts`

- [ ] **Step 14.1: Crear `validation.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { IdentityAgent } from './agents/identity.agent';
import { OriginAgent } from './agents/origin.agent';
import { TraceabilityAgent } from './agents/traceability.agent';
import { ConsolidatorService } from './services/consolidator.service';
import { AgentRunnerService } from './services/agent-runner.service';
import { ValidationSyncedListener } from './listeners/validation-synced.listener';

@Module({
  imports: [PrismaModule],
  providers: [
    IdentityAgent,
    OriginAgent,
    TraceabilityAgent,
    ConsolidatorService,
    AgentRunnerService,
    ValidationSyncedListener,
  ],
  exports: [AgentRunnerService],
})
export class ValidationModule {}
```

- [ ] **Step 14.2: Importar `ValidationModule` desde `LabModule`**

Editar `apps/api/src/modules/lab/lab.module.ts`. Importar al inicio:

```typescript
import { ValidationModule } from './validation/validation.module';
```

Agregar a `imports: [...]`:

```typescript
  imports: [
    PrismaModule,
    FileMakerModule,
    FilesModule,
    ValidationModule,
    BullModule.registerQueue(...),
  ],
```

- [ ] **Step 14.3: Build verifica**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -3
# esperado: Successfully compiled
```

- [ ] **Step 14.4: Run todos los tests F1**

```bash
pnpm --filter @zeru/api exec jest --testPathPattern='validation' 2>&1 | tail -10
# esperado: TODOS los specs nuevos en PASS
```

- [ ] **Step 14.5: Lint**

```bash
pnpm lint 2>&1 | grep -E '(error|Tasks)' | tail -3
# esperado: 0 errors
```

- [ ] **Step 14.6: Commit**

```bash
git add apps/api/src/modules/lab/validation/validation.module.ts apps/api/src/modules/lab/lab.module.ts
git commit -m "feat(lab): wire ValidationModule into LabModule"
```

---

## Tarea 15: F1.5 — Smoke test E2E con FM real

Probar el pipeline completo contra FileMaker real con un informeNumber conocido. NO se hace automatizado — es manual y se documenta el resultado.

**Files:**
- Create: `docs/superpowers/notes/2026-04-20-f1-smoke-results.md`

- [ ] **Step 15.1: Verificar configuración FM en .env**

```bash
grep -E '^FM_(HOST|USER|PASS|TENANT_ID|WEBHOOK_KEY)=' apps/api/.env | sed 's/=.*/=***SET***/' | head -10
# esperado: las 5 variables aparecen como ***SET***
```

Si alguna falta: detenerse y solicitar al usuario.

- [ ] **Step 15.2: Levantar API local**

```bash
pkill -9 -f 'apps/api/dist/main' 2>/dev/null
sleep 2
pnpm --filter @zeru/api start > /tmp/zeru-f1-smoke.log 2>&1 &
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3017/api/users)
  if [ "$code" != "000" ]; then echo "ready ${i}s"; break; fi
  sleep 1
done
```

- [ ] **Step 15.3: Identificar un informeNumber real para probar**

Pedir al usuario un `informeNumber` de un caso real Citolab del último mes. Ejemplo: `12345`.

Documentar la elección en el archivo notes (Step 15.6).

- [ ] **Step 15.4: Disparar el trigger**

```bash
FM_KEY=$(grep '^FM_WEBHOOK_KEY=' apps/api/.env | cut -d= -f2)
INFORME=12345  # reemplazar por el informe real
curl -sS -X POST http://localhost:3017/api/lab/report-validation/trigger \
  -H "Content-Type: application/json" \
  -H "x-fm-webhook-key: $FM_KEY" \
  -d "{\"database\":\"BIOPSIAS\",\"informeNumber\":$INFORME}"
echo
# esperado: { "status": "enqueued", "jobId": "..." }
```

- [ ] **Step 15.5: Esperar procesamiento y verificar en DB**

Esperar ~30 segundos para que el processor + sync FM + agentes terminen.

```bash
sleep 30
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "
SELECT v.id, v.\"fmInformeNumber\", v.status, v.verdict, v.\"confidenceAvg\",
       v.\"completedAt\", v.\"errorMessage\"
FROM mod_lab.lab_report_validations v
WHERE v.\"fmInformeNumber\" = $INFORME
ORDER BY v.\"startedAt\" DESC LIMIT 1;
"
# esperado: una fila con status=COMPLETED, verdict=PASS|FAIL|UNCERTAIN, completedAt populated
```

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "
SELECT \"agentKey\", verdict, severity, confidence, \"durationMs\"
FROM mod_lab.lab_validation_agent_runs r
JOIN mod_lab.lab_report_validations v ON v.id = r.\"validationId\"
WHERE v.\"fmInformeNumber\" = $INFORME
ORDER BY v.\"startedAt\" DESC, r.\"createdAt\" ASC LIMIT 10;
"
# esperado: 3 filas (IDENTITY, ORIGIN, TRACEABILITY) con sus verdicts
```

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "
SELECT f.\"agentKey\", f.code, f.severity, f.message
FROM mod_lab.lab_validation_findings f
JOIN mod_lab.lab_report_validations v ON v.id = f.\"validationId\"
WHERE v.\"fmInformeNumber\" = $INFORME
ORDER BY v.\"startedAt\" DESC, f.\"createdAt\" ASC;
"
# esperado: 0+ filas según los findings reales del caso
```

- [ ] **Step 15.6: Documentar resultado**

Crear `docs/superpowers/notes/2026-04-20-f1-smoke-results.md`:

```markdown
# F1 Smoke E2E — Resultado

**Fecha:** 2026-04-20
**Informe probado:** BIOPSIAS #<NUMBER>
**Pipeline E2E completo:** trigger → BullMQ → processor → syncFromFm → upsertExam → emit event → 3 agentes paralelos → consolidator → COMPLETED.

## Resultado consolidado

- Status final: <COMPLETED|ERROR>
- Verdict: <PASS|FAIL|UNCERTAIN>
- ConfidenceAvg: <0.0-1.0>
- isCritical: <true|false>
- Tiempo total trigger → COMPLETED: <segundos>

## Agente runs

| Agente | Verdict | Severity max | Duration ms | Findings |
|--------|---------|--------------|-------------|----------|
| IDENTITY | ... | ... | ... | ... |
| ORIGIN | ... | ... | ... | ... |
| TRACEABILITY | ... | ... | ... | ... |

## Findings

(lista de findings reales, copia desde el query SQL)

## Observaciones

- ¿El verdict matchea con lo esperado para este caso (validación humana en FM)?
- ¿Algún false positive o false negative obvio?
- ¿Latencia razonable (<30s objetivo del spec)?
- ¿Algún error en los logs del API durante el procesamiento?
```

- [ ] **Step 15.7: Detener API**

```bash
pkill -9 -f 'apps/api/dist/main' 2>/dev/null
```

- [ ] **Step 15.8: Commit**

```bash
git add docs/superpowers/notes/2026-04-20-f1-smoke-results.md
git commit -m "docs(lab): F1 smoke E2E results"
```

- [ ] **Step 15.9: Commit vacío de cierre**

```bash
git commit --allow-empty -m "chore(f1): F1 agents complete — gate to F2"
```

---

## Gate de cierre F1 → F2

Antes de declarar F1 completo y pasar a F2 (agentes LLM):

- [ ] Migración `triggeredJobId` aplicada y unique constraint verificado en DB
- [ ] `upsertValidationRow` refactorizado a `upsert({ where: { triggeredJobId }})`
- [ ] Tests del service cubren `processValidation` guards + `upsertExam` con `$transaction`
- [ ] Los 3 agentes (IDENTITY, ORIGIN, TRACEABILITY) tienen specs ≥6 tests cada uno y todos pasan
- [ ] Consolidator tiene spec con casos PASS, FAIL, UNCERTAIN, mixed
- [ ] AgentRunnerService persiste runs + findings + actualiza validation a COMPLETED
- [ ] ValidationSyncedListener registrado vía `@OnEvent` y aislado de excepciones
- [ ] ValidationModule integrado en LabModule
- [ ] `pnpm lint` 0 errors
- [ ] Suite de tests del API pasa (todos los nuevos + los F0)
- [ ] **Smoke E2E con un caso real Citolab completó el flujo trigger → COMPLETED con verdict**
- [ ] Documento `2026-04-20-f1-smoke-results.md` con resultado del caso real

Si todo lo anterior ✅, F1 está cerrada y se puede arrancar F2 (agentes LLM: sample, concordance, criticality).
