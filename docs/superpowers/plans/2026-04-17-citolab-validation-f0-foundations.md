# F0 Fundaciones — Plan de implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDO: Usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`).

**Goal:** Dejar la base técnica lista para las fases F1-F7 del sistema de validación: migración Prisma con todos los modelos nuevos y extensiones, seed inicial para Citolab, extensión de los transformers de FileMaker para leer ~50 campos adicionales (incluyendo IHQ estructurado, scanner de la solicitud, fotos de encapsulación, criticidad ampliada), cola BullMQ `report-validation`, controller/service rediseñado con persistencia por jobs.

**Architecture:**
1. **Prisma schema:** extender modelos existentes (`LabPatient`, `LabPractitioner`, `LabServiceRequest`, `LabSpecimen`, `LabDiagnosticReport`) + agregar modelos nuevos (`LabReportValidation` + hijos, `Approval*`, `LabSensitiveOrigin`, `LabCriticalityLexicon`, `LabLateralityOrganRule`, `LabValidationRuleset`, `LabValidationAuditRecord`, `LabValidationReplayRun`) en schemas `public` (genéricos) y `mod_lab` (dominio).
2. **Transformers FM:** extender `BiopsyTransformer` y `PapTransformer` para leer ~50 campos FM nuevos; crear `ScannerEncapsulationTransformer` para la DB `SCANNER BIOPSIAS CITOLAB 2014`.
3. **Worktree spike:** rescatar `report-validation.controller.ts` y rediseñar `report-validation.service.ts` para encolar en BullMQ en vez de fire-and-forget, con worker `ReportValidationProcessor` que sincroniza el caso y lo persiste en `LabReportValidation.status=SYNCED` (sin correr agentes aún — eso es F1+).

**Tech Stack:** NestJS 11 • Prisma 7 • BullMQ • PostgreSQL 16 • TypeScript 5 • Zod • Vitest • pnpm.

**Working directory:** `/Users/camiloespinoza/Zeru/.claude/worktrees/feature+fm-report-validation/`
**Branch:** `worktree-feature+fm-report-validation`

---

## File Structure

### Archivos a crear

```
apps/api/prisma/migrations/YYYYMMDDhhmmss_citolab_validation_f0_foundations/migration.sql
apps/api/src/modules/lab/processors/report-validation.processor.ts
apps/api/src/modules/lab/processors/report-validation.processor.spec.ts
apps/api/src/modules/lab/services/lab-report-validation.service.ts
apps/api/src/modules/lab/services/lab-report-validation.service.spec.ts
apps/api/src/modules/lab/dto/report-validation.dto.ts
apps/api/src/modules/filemaker/transformers/scanner-encapsulation.transformer.ts
apps/api/src/modules/filemaker/transformers/scanner-encapsulation.transformer.spec.ts
apps/api/prisma/seed/citolab-validation.seed.ts
apps/api/prisma/seed/run-citolab-validation-seed.ts
docs/guides/fm-script-zeru-validacion-resultado.md
```

### Archivos a modificar

```
apps/api/prisma/schema.prisma
apps/api/src/modules/lab/lab.module.ts
apps/api/src/modules/lab/constants/queue.constants.ts
apps/api/src/modules/lab/controllers/report-validation.controller.ts   (rescate del spike)
apps/api/src/modules/lab/services/report-validation.service.ts          (rediseño)
apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts
apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts
apps/api/src/modules/filemaker/transformers/pap.transformer.ts
apps/api/src/modules/filemaker/transformers/pap.transformer.spec.ts
apps/api/src/modules/filemaker/transformers/types.ts
packages/shared/src/permissions/module-definitions.ts
```

---

## Tarea 1: Preparación del entorno de desarrollo

Verificar estado del worktree, servicios corriendo, y preparar branch de trabajo.

**Files:** ninguno (solo comandos)

- [ ] **Step 1.1: Verificar working directory y branch**

```bash
pwd
# esperado: /Users/camiloespinoza/Zeru/.claude/worktrees/feature+fm-report-validation

git status
# esperado: On branch worktree-feature+fm-report-validation, working tree clean

git log --oneline -3
# esperado: último commit "docs(lab): add Citolab report validation design spec"
```

- [ ] **Step 1.2: Verificar que postgres y redis están corriendo**

```bash
docker ps --format "{{.Names}}" | grep -E "zeru-postgres|zeru-redis"
# esperado: zeru-postgres-1 y zeru-redis-1
```

Si no están, ejecutar `pnpm ensure-infra`.

- [ ] **Step 1.3: Verificar que el API compila sin errores**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -10
# esperado: "Successfully compiled"
```

- [ ] **Step 1.4: Verificar tests actuales verdes**

```bash
pnpm --filter @zeru/api test -- --run 2>&1 | tail -10
# esperado: "Test Files ... passed"
```

- [ ] **Step 1.5: Commit vacío de kickoff**

```bash
git commit --allow-empty -m "chore: kickoff F0 foundations"
```

---

## Tarea 2: Nuevos enums Prisma

Agregar todos los enums nuevos al schema. Van antes de los modelos que los consumen.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 2.1: Identificar ubicación de enums**

Leer `apps/api/prisma/schema.prisma` y ubicar el bloque `enum WorkflowEventType` (schema `mod_lab`). Los nuevos enums irán justo después de los enums de `mod_lab` existentes. Los enums de `public` (Approval*) van antes o después de un enum existente de `public`.

- [ ] **Step 2.2: Agregar enums de validación (schema `mod_lab`)**

Agregar tras el último enum del schema `mod_lab`:

```prisma
enum ValidationRunStatus {
  PENDING
  SYNCED
  ANALYZING
  COMPLETED
  ERROR
  CANCELLED

  @@schema("mod_lab")
}

enum ValidationVerdict {
  GREEN
  YELLOW
  RED
  PENDING

  @@schema("mod_lab")
}

enum ValidationAgentKey {
  IDENTITY
  ORIGIN
  SAMPLE
  CONCORDANCE
  CRITICALITY
  TRACEABILITY
  VISION_REQUEST
  VISION_ENCAPSULATION_MACRO
  PDF_FINAL

  @@schema("mod_lab")
}

enum FindingSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW

  @@schema("mod_lab")
}

enum FindingVerdict {
  PASS
  WARN
  FAIL

  @@schema("mod_lab")
}

enum SensitiveRule {
  MUESTRA_TEXTUAL_EXACTA

  @@schema("mod_lab")
}

enum LexCategory {
  MALIGNIDAD
  INVASION
  IN_SITU
  SOSPECHA
  INFECCION_CRITICA
  HEMATOLOGIA_AGRESIVA
  TRASPLANTE_VASCULITIS
  NEGACION

  @@schema("mod_lab")
}

enum LateralityReq {
  REQUIRED
  NOT_APPLICABLE
  CONTEXTUAL

  @@schema("mod_lab")
}

enum AuditSource {
  RANDOM_SAMPLING
  ESCALATION
  REPLAY
  FEEDBACK

  @@schema("mod_lab")
}

enum HumanJudgement {
  AGENT_CORRECT
  AGENT_MISSED
  AGENT_FALSE_POSITIVE
  UNCERTAIN

  @@schema("mod_lab")
}
```

- [ ] **Step 2.3: Agregar enums de aprobación (schema `public`)**

Agregar en el bloque de enums `public`:

```prisma
enum ApprovalSubjectType {
  LAB_REPORT_VALIDATION

  @@schema("public")
}

enum ApprovalReason {
  CRITICAL_VALIDATION_FAILED
  NON_CRITICAL_VALIDATION_FAILED

  @@schema("public")
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
  CANCELLED

  @@schema("public")
}

enum ApprovalDecisionKind {
  APPROVE
  REJECT

  @@schema("public")
}

enum AlertChannel {
  IN_APP
  EMAIL
  SMS
  WEBHOOK

  @@schema("public")
}

enum RecipientScope {
  GROUP_MEMBER
  PERMISSION
  USER
  ORIGINAL_ACTOR

  @@schema("public")
}
```

- [ ] **Step 2.4: Extender enum `WorkflowEventType` existente**

Localizar `enum WorkflowEventType` en el schema y agregar estos valores al final (antes del `@@schema`):

```prisma
  SECRETARY_PRE_VALIDATION
  TM_REVIEW
  SCANNER_CAPTURE
  CRITICAL_NOTIFICATION_SENT
  PATIENT_NOTIFICATION
  AGENT_VALIDATION_RUN
  AGENT_VALIDATION_PASSED
  AGENT_VALIDATION_FAILED
```

- [ ] **Step 2.5: Validar que el schema parsea**

```bash
pnpm --filter @zeru/api exec prisma validate 2>&1 | tail -5
# esperado: "The schema at prisma/schema.prisma is valid"
```

- [ ] **Step 2.6: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): add validation/approval enums for F0"
```

---

## Tarea 3: Extender modelos Prisma existentes

Agregar columnas a `LabPatient`, `LabPractitioner`, `LabServiceRequest`, `LabSpecimen`, `LabDiagnosticReport`. Todas nullable para no romper registros existentes.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 3.1: Extender `LabPatient`**

Agregar campos antes del `@@unique` o `@@index`:

```prisma
  // Añadidos por F0 — Validación automatizada
  gender         Gender?
  birthDate      DateTime?
  email          String?
```

- [ ] **Step 3.2: Extender `LabPractitioner`**

Agregar antes del `@@unique`:

```prisma
  // Añadidos por F0
  email          String?
  rutSnapshot    String?   // poblado desde Biopsias::Rut Medico Solicitante
  codeSnapshot   String?   // poblado desde COD. MEDICO
```

- [ ] **Step 3.3: Extender `LabServiceRequest`**

Agregar antes del `@@unique`:

```prisma
  // Añadidos por F0
  externalFolioNumber      String?
  externalInstitutionId    String?
  externalOrderNumber      String?
  requestingPhysicianEmail String?
```

- [ ] **Step 3.4: Extender `LabSpecimen`**

Agregar antes del `@@index`:

```prisma
  // Añadidos por F0
  containerType             String?
  tacoCount                 Int?
  cassetteCount             Int?
  placaHeCount              Int?
  specialTechniquesCount    Int?
  ihqAntibodies             String[]
  ihqNumbers                String?
  ihqStatus                 String?
  ihqRequestedAt            DateTime?
  ihqRespondedAt            DateTime?
  ihqResponsibleNameSnapshot String?
```

- [ ] **Step 3.5: Extender `LabDiagnosticReport`**

Agregar antes del `@@unique`:

```prisma
  // Añadidos por F0 — Validación automatizada
  validationVerdict          ValidationVerdict?
  lastValidationRunId        String?
  blockedForDispatch         Boolean   @default(false)
  criticalPatientNotifyFlag  Boolean   @default(false)
  criticalNotificationPdfKey String?
  criticalNotifiedAt         DateTime?
  criticalNotifiedBy         String?
  rejectedByCcb              Boolean   @default(false)
  ccbComments                String?
  diagnosticModified         Boolean   @default(false)
  modifiedByUser             String?
  modifiedAt                 DateTime?
```

- [ ] **Step 3.6: Validar schema**

```bash
pnpm --filter @zeru/api exec prisma validate
# esperado: "The schema ... is valid"
```

- [ ] **Step 3.7: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): extend lab models with validation fields"
```

---

## Tarea 4: Modelos Prisma de validación (`LabReportValidation` y hijos)

Crear los tres modelos principales de validación. El `LabReportValidation` **reemplaza** al del worktree (que tenía menos campos).

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 4.1: Eliminar el modelo `LabReportValidation` existente del worktree**

Buscar en el schema `model LabReportValidation` y eliminar el bloque completo (agregado por el spike). Dejar solo la relación inversa en `LabDiagnosticReport` si existe (la eliminaremos también).

- [ ] **Step 4.2: Eliminar la relación `validations LabReportValidation[]` del `LabDiagnosticReport` si existe del spike**

Remover esa línea del modelo `LabDiagnosticReport`.

- [ ] **Step 4.3: Agregar modelos nuevos al final del schema `mod_lab`**

Insertar antes del cierre del archivo (después del último modelo `mod_lab`):

```prisma
model LabReportValidation {
  id                  String               @id @default(uuid())
  tenantId            String
  diagnosticReportId  String
  diagnosticReport    LabDiagnosticReport  @relation(fields: [diagnosticReportId], references: [id], onDelete: Cascade)
  fmInformeNumber     Int
  fmSource            FmSource
  triggeredByUserId   String?
  status              ValidationRunStatus  @default(PENDING)
  verdict             ValidationVerdict?
  confidenceAvg       Decimal?             @db.Decimal(5, 4)
  isCritical          Boolean              @default(false)
  isAcuteCritical     Boolean              @default(false)
  startedAt           DateTime             @default(now())
  syncedAt            DateTime?
  analysisStartedAt   DateTime?
  completedAt         DateTime?
  errorMessage        String?              @db.Text
  pdfExtractedText    String?              @db.Text
  summary             Json?
  isReplay            Boolean              @default(false)
  agentRuns           LabValidationAgentRun[]
  findings            LabValidationFinding[]
  approvalRequest     ApprovalRequest?
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  @@index([tenantId, status, startedAt])
  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, fmSource, fmInformeNumber])
  @@map("lab_report_validations")
  @@schema("mod_lab")
}

model LabValidationAgentRun {
  id             String              @id @default(uuid())
  validationId   String
  validation     LabReportValidation @relation(fields: [validationId], references: [id], onDelete: Cascade)
  agentKey       ValidationAgentKey
  verdict        FindingVerdict
  severity       FindingSeverity
  confidence     Decimal             @db.Decimal(5, 4)
  durationMs     Int
  model          String?
  provider       String?
  inputTokens    Int?
  outputTokens   Int?
  aiUsageLogId   String?
  rawOutput      Json?
  createdAt      DateTime            @default(now())

  @@unique([validationId, agentKey])
  @@index([validationId])
  @@map("lab_validation_agent_runs")
  @@schema("mod_lab")
}

model LabValidationFinding {
  id                   String              @id @default(uuid())
  validationId         String
  validation           LabReportValidation @relation(fields: [validationId], references: [id], onDelete: Cascade)
  agentKey             ValidationAgentKey
  ruleId               String
  verdict              FindingVerdict
  severity             FindingSeverity
  message              String              @db.Text
  field                String?
  evidenceQuote        String?             @db.Text
  evidenceSource       String?
  suggestion           String?             @db.Text
  requiresHumanReview  Boolean             @default(false)
  blocksDispatch       Boolean             @default(false)
  createdAt            DateTime            @default(now())

  @@index([validationId, severity])
  @@index([ruleId])
  @@map("lab_validation_findings")
  @@schema("mod_lab")
}
```

- [ ] **Step 4.4: Agregar relación inversa en `LabDiagnosticReport`**

Dentro del modelo `LabDiagnosticReport`, junto a otras relaciones:

```prisma
  validations        LabReportValidation[]
```

- [ ] **Step 4.5: Validar schema**

```bash
pnpm --filter @zeru/api exec prisma validate
# esperado: "valid"
```

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): add validation run, agent run and finding models"
```

---

## Tarea 5: Modelos Prisma de aprobaciones

Modelos genéricos en `public` para aprobaciones con dual-approval y SoD.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 5.1: Agregar modelos al schema `public`**

Insertar al final del archivo (después de modelos `public` existentes, antes de modelos `mod_lab`):

```prisma
model ApprovalGroup {
  id                    String                   @id @default(uuid())
  tenantId              String
  slug                  String
  name                  String
  description           String?
  reason                ApprovalReason
  minApprovers          Int                      @default(1)
  excludeOriginalActor  Boolean                  @default(true)
  slaHours              Int                      @default(72)
  isActive              Boolean                  @default(true)
  createdAt             DateTime                 @default(now())
  updatedAt             DateTime                 @updatedAt

  members               ApprovalGroupMember[]
  requests              ApprovalRequest[]
  alertRecipients       ApprovalAlertRecipient[]

  @@unique([tenantId, slug])
  @@index([tenantId, isActive, reason])
  @@map("approval_groups")
  @@schema("public")
}

model ApprovalGroupMember {
  id         String        @id @default(uuid())
  groupId    String
  group      ApprovalGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  userId     String
  user       User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  addedAt    DateTime      @default(now())
  addedById  String?

  @@unique([groupId, userId])
  @@index([userId])
  @@map("approval_group_members")
  @@schema("public")
}

model ApprovalRequest {
  id                  String              @id @default(uuid())
  tenantId            String
  subjectType         ApprovalSubjectType
  subjectId           String
  reason              ApprovalReason
  status              ApprovalStatus      @default(PENDING)
  originalActorId     String?
  groupId             String
  group               ApprovalGroup       @relation(fields: [groupId], references: [id])
  approvalsRequired   Int
  approvalsCount      Int                 @default(0)
  rejectionsCount     Int                 @default(0)
  snapshot            Json
  createdAt           DateTime            @default(now())
  expiresAt           DateTime?
  resolvedAt          DateTime?

  decisions           ApprovalDecision[]
  validation          LabReportValidation? @relation(fields: [subjectId], references: [id], map: "approval_req_validation_fk")

  @@index([tenantId, status, createdAt])
  @@index([tenantId, subjectType, subjectId])
  @@map("approval_requests")
  @@schema("public")
}

model ApprovalDecision {
  id           String               @id @default(uuid())
  requestId    String
  request      ApprovalRequest      @relation(fields: [requestId], references: [id], onDelete: Cascade)
  decidedById  String
  decidedBy    User                 @relation(fields: [decidedById], references: [id])
  decision     ApprovalDecisionKind
  notes        String               @db.Text
  ipAddress    String?
  userAgent    String?
  decidedAt    DateTime             @default(now())

  @@unique([requestId, decidedById])
  @@index([decidedById])
  @@map("approval_decisions")
  @@schema("public")
}

model ApprovalAlertRecipient {
  id             String          @id @default(uuid())
  tenantId       String
  groupId        String?
  group          ApprovalGroup?  @relation(fields: [groupId], references: [id], onDelete: SetNull)
  reason         ApprovalReason?
  scope          RecipientScope
  permissionKey  String?
  userId         String?
  channels       AlertChannel[]
  createdAt      DateTime        @default(now())

  @@index([tenantId, groupId, reason])
  @@map("approval_alert_recipients")
  @@schema("public")
}
```

- [ ] **Step 5.2: Agregar relaciones inversas en `User`**

Dentro del modelo `User` (schema `public`), junto a otras relaciones:

```prisma
  approvalGroupMembers     ApprovalGroupMember[]
  approvalDecisions        ApprovalDecision[]
```

- [ ] **Step 5.3: Validar schema**

```bash
pnpm --filter @zeru/api exec prisma validate
```

- [ ] **Step 5.4: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): add approval models with SoD support"
```

---

## Tarea 6: Modelos Prisma de configurabilidad y evaluación

Agregar `LabSensitiveOrigin`, `LabCriticalityLexicon`, `LabLateralityOrganRule`, `LabValidationRuleset`, `LabValidationAuditRecord`, `LabValidationReplayRun`.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 6.1: Agregar modelos configurables al schema `mod_lab`**

Al final de los modelos `mod_lab`:

```prisma
model LabSensitiveOrigin {
  id           String        @id @default(uuid())
  tenantId     String
  labOriginId  String?
  nameMatch    String?
  rule         SensitiveRule @default(MUESTRA_TEXTUAL_EXACTA)
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([tenantId, isActive])
  @@map("lab_sensitive_origins")
  @@schema("mod_lab")
}

model LabCriticalityLexicon {
  id          String      @id @default(uuid())
  tenantId    String
  category    LexCategory
  pattern     String
  isRegex     Boolean     @default(false)
  weight      Int         @default(1)
  locale      String      @default("es-CL")
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())

  @@index([tenantId, category, isActive])
  @@map("lab_criticality_lexicon")
  @@schema("mod_lab")
}

model LabLateralityOrganRule {
  id            String        @id @default(uuid())
  tenantId      String
  organPattern  String
  requirement   LateralityReq

  @@unique([tenantId, organPattern])
  @@map("lab_laterality_organ_rules")
  @@schema("mod_lab")
}

model LabValidationRuleset {
  id                          String   @id @default(uuid())
  tenantId                    String   @unique
  gateEnabled                 Boolean  @default(false)
  thresholdCritical           Int      @default(3)
  thresholdMediumConfidence   Decimal  @default(0.70) @db.Decimal(5, 4)
  autoApproveWithExplicitFlag Boolean  @default(true)
  concordanceEnsembleOnMalign Boolean  @default(true)
  visionVlmEnabled            Boolean  @default(true)
  pdfFinalVlmEnabled          Boolean  @default(false)
  agentsEnabled               Json
  updatedAt                   DateTime @updatedAt

  @@map("lab_validation_rulesets")
  @@schema("mod_lab")
}

model LabValidationAuditRecord {
  id                 String           @id @default(uuid())
  tenantId           String
  validationId       String           @unique
  source             AuditSource
  sampledAt          DateTime         @default(now())
  reviewerId         String?
  reviewedAt         DateTime?
  judgement          HumanJudgement?
  comments           String?          @db.Text
  missedFindingsRule String[]
  agreedFindingsRule String[]
  falsePositiveRule  String[]

  @@index([tenantId, source, sampledAt])
  @@index([reviewerId, reviewedAt])
  @@map("lab_validation_audit_records")
  @@schema("mod_lab")
}

model LabValidationReplayRun {
  id              String    @id @default(uuid())
  tenantId        String
  name            String
  filterCriteria  Json
  totalCases      Int
  processedCases  Int       @default(0)
  detectedCases   Int       @default(0)
  status          String
  startedAt       DateTime  @default(now())
  completedAt     DateTime?

  @@index([tenantId, status, startedAt])
  @@map("lab_validation_replay_runs")
  @@schema("mod_lab")
}
```

- [ ] **Step 6.2: Validar schema**

```bash
pnpm --filter @zeru/api exec prisma validate
```

- [ ] **Step 6.3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(prisma): add configurability and evaluation models"
```

---

## Tarea 7: Permisos nuevos en `MODULE_DEFINITIONS`

Agregar módulos `lab-reports`, `operations`, `approvals` al catálogo compartido.

**Files:**
- Modify: `packages/shared/src/permissions/module-definitions.ts`

- [ ] **Step 7.1: Leer el archivo y entender estructura actual**

```bash
head -40 packages/shared/src/permissions/module-definitions.ts
```

Identificar cómo están definidos los módulos existentes (formato, campos). Típicamente cada módulo tiene `key`, `name`, `actions: string[]`, `roles: {...}`.

- [ ] **Step 7.2: Agregar los 3 nuevos módulos al array `MODULE_DEFINITIONS`**

Insertar nuevos objetos siguiendo el formato existente. Ejemplo (ajustar a la estructura real):

```typescript
{
  key: 'lab-reports',
  name: 'Informes de laboratorio',
  description: 'Validación y firma de informes anatomopatológicos',
  actions: ['view', 'validate', 'override'],
  defaultAccessByRole: {
    OWNER: 'MANAGE',
    ADMIN: 'MANAGE',
    ACCOUNTANT: 'NONE',
    VIEWER: 'VIEW',
  },
},
{
  key: 'operations',
  name: 'Operaciones',
  description: 'Gestión operacional transversal (gerencia operaciones)',
  actions: ['view', 'manage'],
  defaultAccessByRole: {
    OWNER: 'MANAGE',
    ADMIN: 'MANAGE',
    ACCOUNTANT: 'NONE',
    VIEWER: 'NONE',
  },
},
{
  key: 'approvals',
  name: 'Aprobaciones',
  description: 'Aprobación de solicitudes y configuración de grupos',
  actions: ['view', 'decide', 'configure-groups'],
  defaultAccessByRole: {
    OWNER: 'MANAGE',
    ADMIN: 'MANAGE',
    ACCOUNTANT: 'NONE',
    VIEWER: 'VIEW',
  },
},
```

- [ ] **Step 7.3: Build shared**

```bash
pnpm --filter @zeru/shared build 2>&1 | tail -5
# esperado: sin errores
```

- [ ] **Step 7.4: Commit**

```bash
git add packages/shared/src/permissions/module-definitions.ts
git commit -m "feat(permissions): add lab-reports, operations and approvals modules"
```

---

## Tarea 8: Generar migración Prisma + triggers inmutabilidad

Crear la migración, revisarla, agregar SQL custom para triggers de inmutabilidad.

**Files:**
- Create: `apps/api/prisma/migrations/YYYYMMDDhhmmss_citolab_validation_f0_foundations/migration.sql`

- [ ] **Step 8.1: Generar migración con Prisma**

```bash
cd apps/api
pnpm exec prisma migrate dev --create-only --name citolab_validation_f0_foundations
```

Revisar la migración generada. Debe contener `ALTER TABLE` para los modelos extendidos y `CREATE TABLE` para los nuevos.

- [ ] **Step 8.2: Agregar triggers de inmutabilidad al SQL de migración**

Abrir el archivo generado (`apps/api/prisma/migrations/TIMESTAMP_citolab_validation_f0_foundations/migration.sql`) y **agregar al final**:

```sql
-- ═══════════════════════════════════════════════════════════════
-- Triggers de inmutabilidad para audit log y decisiones
-- ═══════════════════════════════════════════════════════════════

-- Approval decisions: nunca se pueden modificar ni borrar
CREATE OR REPLACE FUNCTION forbid_approval_decision_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'approval_decisions are immutable (attempted %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_decisions_immutable
BEFORE UPDATE OR DELETE ON public.approval_decisions
FOR EACH ROW
EXECUTE FUNCTION forbid_approval_decision_mutation();

-- Enforce SoD: un mismo usuario no puede aprobar su propia validación
-- si el grupo tiene excludeOriginalActor=true
CREATE OR REPLACE FUNCTION enforce_sod_on_decision()
RETURNS TRIGGER AS $$
DECLARE
  v_original_actor_id TEXT;
  v_exclude_original  BOOLEAN;
BEGIN
  SELECT ar.original_actor_id,
         ag.exclude_original_actor
    INTO v_original_actor_id, v_exclude_original
  FROM public.approval_requests ar
  JOIN public.approval_groups   ag ON ag.id = ar.group_id
  WHERE ar.id = NEW.request_id;

  IF v_exclude_original AND v_original_actor_id = NEW.decided_by_id THEN
    RAISE EXCEPTION 'SoD violation: original actor cannot decide on their own approval request';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_decisions_sod
BEFORE INSERT ON public.approval_decisions
FOR EACH ROW
EXECUTE FUNCTION enforce_sod_on_decision();
```

Nota: los nombres de columnas deben ser los snake_case del mapping de Prisma. Verificar con `\d public.approval_requests` si hay duda.

- [ ] **Step 8.3: Aplicar la migración**

```bash
pnpm exec prisma migrate dev
# esperado: "migration applied successfully"
```

- [ ] **Step 8.4: Generar cliente Prisma**

```bash
pnpm exec prisma generate 2>&1 | tail -5
# esperado: "Generated Prisma Client ... to ./node_modules/@prisma/client"
```

- [ ] **Step 8.5: Verificar tabla con triggers**

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "\d public.approval_decisions"
# debe listar triggers "approval_decisions_immutable" y "approval_decisions_sod"
```

- [ ] **Step 8.6: Test manual rápido de inmutabilidad**

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "UPDATE public.approval_decisions SET notes = 'hack' WHERE id = 'nonexistent';" 2>&1 | grep -i "immutable\|exception"
# esperado: "approval_decisions are immutable" (también si no hay filas, el trigger no aplica; para test completo se hará en task de seed o test)
```

- [ ] **Step 8.7: Commit**

```bash
cd /Users/camiloespinoza/Zeru/.claude/worktrees/feature+fm-report-validation
git add apps/api/prisma/migrations/
git commit -m "feat(db): migration for F0 + immutability and SoD triggers"
```

---

## Tarea 9: Seed Citolab — procedencias sensibles, lexicón, lateralidad, ruleset

Archivo seed idempotente ejecutable vía pnpm script.

**Files:**
- Create: `apps/api/prisma/seed/citolab-validation.seed.ts`
- Create: `apps/api/prisma/seed/run-citolab-validation-seed.ts`

- [ ] **Step 9.1: Crear `apps/api/prisma/seed/citolab-validation.seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const CITOLAB_TENANT_ID = 'd8d330f3-075d-41a5-9e6b-783d26f2070d';

export async function seedCitolabValidation(prisma: PrismaClient) {
  const tenantId = CITOLAB_TENANT_ID;

  // ─── 1. Procedencias sensibles ────────────────────────────────────────
  const sensitiveOrigins = [
    { nameMatch: 'HTSP' },
    { nameMatch: 'HTSCEM' },
    { nameMatch: 'FUNDACION SAN CRISTOBAL' },
    { nameMatch: 'MEGASALUD' },
    { nameMatch: 'POLICENTER' },
    { nameMatch: 'HOSPITAL DEL PROFESOR' },
  ];
  for (const o of sensitiveOrigins) {
    await prisma.labSensitiveOrigin.upsert({
      where: {
        id: `seed-sensitive-${tenantId}-${o.nameMatch.replace(/\s+/g, '-').toLowerCase()}`,
      },
      create: {
        id: `seed-sensitive-${tenantId}-${o.nameMatch.replace(/\s+/g, '-').toLowerCase()}`,
        tenantId,
        nameMatch: o.nameMatch,
        rule: 'MUESTRA_TEXTUAL_EXACTA',
        isActive: true,
      },
      update: {},
    });
  }

  // ─── 2. Lexicón de criticidad ──────────────────────────────────────────
  const lexicon: Array<{ category: any; pattern: string; isRegex?: boolean; weight?: number }> = [
    // MALIGNIDAD
    { category: 'MALIGNIDAD', pattern: 'carcinoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'adenocarcinoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'sarcoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'linfoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'leucemia', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'melanoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'mieloma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'mesotelioma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'blastoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'glioma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'seminoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'coriocarcinoma', weight: 3 },
    { category: 'MALIGNIDAD', pattern: 'neoplasia maligna', weight: 3 },
    // INVASION
    { category: 'INVASION', pattern: 'infiltrante', weight: 2 },
    { category: 'INVASION', pattern: 'invasor', weight: 2 },
    { category: 'INVASION', pattern: 'metástasis', weight: 3 },
    { category: 'INVASION', pattern: 'metastásico', weight: 3 },
    { category: 'INVASION', pattern: 'margen (positivo|comprometido|afectado)', isRegex: true, weight: 3 },
    // IN_SITU
    { category: 'IN_SITU', pattern: 'in situ', weight: 2 },
    { category: 'IN_SITU', pattern: 'CIS', weight: 2 },
    { category: 'IN_SITU', pattern: 'DCIS', weight: 2 },
    { category: 'IN_SITU', pattern: 'HSIL', weight: 3 },
    { category: 'IN_SITU', pattern: 'AIS', weight: 2 },
    { category: 'IN_SITU', pattern: 'displasia (severa|alto grado|grado alto)', isRegex: true, weight: 2 },
    // SOSPECHA
    { category: 'SOSPECHA', pattern: 'sospechoso de malignidad', weight: 2 },
    { category: 'SOSPECHA', pattern: 'compatible con malignidad', weight: 2 },
    { category: 'SOSPECHA', pattern: 'ASC-H', weight: 2 },
    { category: 'SOSPECHA', pattern: 'AGC', weight: 2 },
    { category: 'SOSPECHA', pattern: 'no se puede descartar malignidad', weight: 2 },
    // INFECCION_CRITICA
    { category: 'INFECCION_CRITICA', pattern: 'tuberculosis', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'BAAR', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'Pneumocystis', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'Aspergillus', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'Mucor', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'Cryptococcus', weight: 3 },
    { category: 'INFECCION_CRITICA', pattern: 'citomegalovirus', weight: 2 },
    { category: 'INFECCION_CRITICA', pattern: 'granuloma caseificante', weight: 3 },
    // HEMATOLOGIA_AGRESIVA
    { category: 'HEMATOLOGIA_AGRESIVA', pattern: 'blastos', weight: 3 },
    { category: 'HEMATOLOGIA_AGRESIVA', pattern: 'Burkitt', weight: 3 },
    { category: 'HEMATOLOGIA_AGRESIVA', pattern: 'LDGCB', weight: 3 },
    { category: 'HEMATOLOGIA_AGRESIVA', pattern: 'linfoblástico', weight: 3 },
    // TRASPLANTE_VASCULITIS
    { category: 'TRASPLANTE_VASCULITIS', pattern: 'rechazo (agudo|activo|mediado)', isRegex: true, weight: 3 },
    { category: 'TRASPLANTE_VASCULITIS', pattern: 'vasculitis (activa|necrotizante)', isRegex: true, weight: 3 },
    { category: 'TRASPLANTE_VASCULITIS', pattern: 'glomerulonefritis rápidamente progresiva', weight: 3 },
    // NEGACION
    { category: 'NEGACION', pattern: 'no se observa', weight: 1 },
    { category: 'NEGACION', pattern: 'sin evidencia de', weight: 1 },
    { category: 'NEGACION', pattern: 'negativo para', weight: 1 },
    { category: 'NEGACION', pattern: 'descarta', weight: 1 },
    { category: 'NEGACION', pattern: 'ausente', weight: 1 },
    { category: 'NEGACION', pattern: 'ausencia de', weight: 1 },
    { category: 'NEGACION', pattern: 'libre de', weight: 1 },
    { category: 'NEGACION', pattern: 'no se identifica', weight: 1 },
    { category: 'NEGACION', pattern: 'compatible con proceso benigno', weight: 1 },
    { category: 'NEGACION', pattern: 'NILM', weight: 1 },
  ];
  for (const entry of lexicon) {
    await prisma.labCriticalityLexicon.upsert({
      where: { id: `seed-lex-${tenantId}-${entry.category}-${entry.pattern}`.replace(/[^a-z0-9-]/gi, '_') },
      create: {
        id: `seed-lex-${tenantId}-${entry.category}-${entry.pattern}`.replace(/[^a-z0-9-]/gi, '_'),
        tenantId,
        category: entry.category,
        pattern: entry.pattern,
        isRegex: entry.isRegex ?? false,
        weight: entry.weight ?? 1,
        locale: 'es-CL',
        isActive: true,
      },
      update: {},
    });
  }

  // ─── 3. Reglas de lateralidad ─────────────────────────────────────────
  const laterality: Array<{ organPattern: string; requirement: 'REQUIRED' | 'NOT_APPLICABLE' | 'CONTEXTUAL' }> = [
    { organPattern: 'mama', requirement: 'REQUIRED' },
    { organPattern: 'ovario', requirement: 'REQUIRED' },
    { organPattern: 'trompa', requirement: 'REQUIRED' },
    { organPattern: 'testículo', requirement: 'REQUIRED' },
    { organPattern: 'testiculo', requirement: 'REQUIRED' },
    { organPattern: 'epidídimo', requirement: 'REQUIRED' },
    { organPattern: 'epididimo', requirement: 'REQUIRED' },
    { organPattern: 'riñón', requirement: 'REQUIRED' },
    { organPattern: 'rinon', requirement: 'REQUIRED' },
    { organPattern: 'uréter', requirement: 'REQUIRED' },
    { organPattern: 'ureter', requirement: 'REQUIRED' },
    { organPattern: 'suprarrenal', requirement: 'REQUIRED' },
    { organPattern: 'pulmón', requirement: 'REQUIRED' },
    { organPattern: 'pulmon', requirement: 'REQUIRED' },
    { organPattern: 'bronquio', requirement: 'REQUIRED' },
    { organPattern: 'amígdala', requirement: 'REQUIRED' },
    { organPattern: 'amigdala', requirement: 'REQUIRED' },
    { organPattern: 'parótida', requirement: 'REQUIRED' },
    { organPattern: 'parotida', requirement: 'REQUIRED' },
    { organPattern: 'submaxilar', requirement: 'REQUIRED' },
    { organPattern: 'tiroides', requirement: 'REQUIRED' },
    { organPattern: 'paratiroides', requirement: 'REQUIRED' },
    { organPattern: 'globo ocular', requirement: 'REQUIRED' },
    { organPattern: 'oído', requirement: 'REQUIRED' },
    { organPattern: 'oido', requirement: 'REQUIRED' },
    { organPattern: 'extremidad', requirement: 'REQUIRED' },
    { organPattern: 'miembro superior', requirement: 'REQUIRED' },
    { organPattern: 'miembro inferior', requirement: 'REQUIRED' },
    { organPattern: 'ganglio axilar', requirement: 'REQUIRED' },
    { organPattern: 'ganglio inguinal', requirement: 'REQUIRED' },
    { organPattern: 'ganglio supraclavicular', requirement: 'REQUIRED' },
    { organPattern: 'pleura', requirement: 'REQUIRED' },
    { organPattern: 'médula ósea', requirement: 'REQUIRED' },
    { organPattern: 'medula osea', requirement: 'REQUIRED' },
    // NOT_APPLICABLE
    { organPattern: 'útero', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'utero', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'cuello uterino', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'endometrio', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'vagina', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'próstata', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'prostata', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'pene', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'estómago', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'estomago', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'esófago', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'esofago', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'colon', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'recto', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'apéndice', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'apendice', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'vesícula', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'vesicula', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'páncreas', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'pancreas', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'bazo', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'vejiga', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'uretra', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'laringe', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'tráquea', requirement: 'NOT_APPLICABLE' },
    { organPattern: 'traquea', requirement: 'NOT_APPLICABLE' },
    // CONTEXTUAL
    { organPattern: 'ganglio cervical', requirement: 'CONTEXTUAL' },
    { organPattern: 'ganglio mediastínico', requirement: 'CONTEXTUAL' },
    { organPattern: 'hígado', requirement: 'CONTEXTUAL' },
    { organPattern: 'higado', requirement: 'CONTEXTUAL' },
    { organPattern: 'piel', requirement: 'CONTEXTUAL' },
    { organPattern: 'vulva', requirement: 'CONTEXTUAL' },
  ];
  for (const rule of laterality) {
    await prisma.labLateralityOrganRule.upsert({
      where: {
        tenantId_organPattern: {
          tenantId,
          organPattern: rule.organPattern,
        },
      },
      create: {
        tenantId,
        organPattern: rule.organPattern,
        requirement: rule.requirement,
      },
      update: { requirement: rule.requirement },
    });
  }

  // ─── 4. Ruleset default ────────────────────────────────────────────────
  await prisma.labValidationRuleset.upsert({
    where: { tenantId },
    create: {
      tenantId,
      gateEnabled: false,
      thresholdCritical: 3,
      thresholdMediumConfidence: 0.70,
      autoApproveWithExplicitFlag: true,
      concordanceEnsembleOnMalign: true,
      visionVlmEnabled: true,
      pdfFinalVlmEnabled: false,
      agentsEnabled: {
        IDENTITY: true,
        ORIGIN: true,
        SAMPLE: true,
        CONCORDANCE: true,
        CRITICALITY: true,
        TRACEABILITY: true,
        VISION_REQUEST: true,
        VISION_ENCAPSULATION_MACRO: true,
        PDF_FINAL: true,
      },
    },
    update: {},
  });

  // ─── 5. Grupos de aprobadores ──────────────────────────────────────────
  const criticalsGroupId = `approval-group-${tenantId}-critical`;
  await prisma.approvalGroup.upsert({
    where: {
      tenantId_slug: { tenantId, slug: 'citolab-criticals' },
    },
    create: {
      id: criticalsGroupId,
      tenantId,
      slug: 'citolab-criticals',
      name: 'Críticos — Citolab',
      description: 'Aprobadores para validaciones críticas fallidas (malignidad, IHQ, cruce de casos)',
      reason: 'CRITICAL_VALIDATION_FAILED',
      minApprovers: 2,
      excludeOriginalActor: true,
      slaHours: 72,
      isActive: true,
    },
    update: {},
  });

  const qualityGroupId = `approval-group-${tenantId}-quality`;
  await prisma.approvalGroup.upsert({
    where: {
      tenantId_slug: { tenantId, slug: 'citolab-quality' },
    },
    create: {
      id: qualityGroupId,
      tenantId,
      slug: 'citolab-quality',
      name: 'Calidad — Citolab',
      description: 'Aprobadores de validaciones no críticas fallidas',
      reason: 'NON_CRITICAL_VALIDATION_FAILED',
      minApprovers: 1,
      excludeOriginalActor: true,
      slaHours: 48,
      isActive: true,
    },
    update: {},
  });

  // ─── 6. Destinatarios de alertas por defecto ──────────────────────────
  const recipientsBase = [
    { scope: 'ORIGINAL_ACTOR' as const, reason: null, channels: ['IN_APP', 'EMAIL'] as const },
    { scope: 'PERMISSION' as const, reason: null, permissionKey: 'lab-reports:validate', channels: ['IN_APP', 'EMAIL'] as const },
    { scope: 'PERMISSION' as const, reason: 'CRITICAL_VALIDATION_FAILED' as const, permissionKey: 'operations:manage', channels: ['IN_APP', 'EMAIL'] as const },
    { scope: 'PERMISSION' as const, reason: 'CRITICAL_VALIDATION_FAILED' as const, permissionKey: 'tenant:manage', channels: ['EMAIL'] as const },
  ];
  for (const r of recipientsBase) {
    await prisma.approvalAlertRecipient.upsert({
      where: {
        id: `seed-recip-${tenantId}-${r.scope}-${r.permissionKey ?? 'any'}-${r.reason ?? 'any'}`,
      },
      create: {
        id: `seed-recip-${tenantId}-${r.scope}-${r.permissionKey ?? 'any'}-${r.reason ?? 'any'}`,
        tenantId,
        scope: r.scope,
        reason: r.reason as any,
        permissionKey: r.permissionKey ?? null,
        channels: [...r.channels],
      },
      update: {},
    });
  }

  return {
    sensitiveOrigins: sensitiveOrigins.length,
    lexiconEntries: lexicon.length,
    lateralityRules: laterality.length,
    approvalGroups: 2,
    alertRecipients: recipientsBase.length,
  };
}
```

- [ ] **Step 9.2: Crear runner `apps/api/prisma/seed/run-citolab-validation-seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { seedCitolabValidation } from './citolab-validation.seed';

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await seedCitolabValidation(prisma);
    console.log('Seed completado:', result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 9.3: Agregar script npm**

Editar `apps/api/package.json` y agregar en `"scripts"`:

```json
"seed:citolab-validation": "tsx prisma/seed/run-citolab-validation-seed.ts"
```

- [ ] **Step 9.4: Ejecutar seed**

```bash
cd apps/api && pnpm seed:citolab-validation
# esperado:
# Seed completado: { sensitiveOrigins: 6, lexiconEntries: ~48, lateralityRules: ~60, approvalGroups: 2, alertRecipients: 4 }
```

- [ ] **Step 9.5: Verificar en DB**

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c "SELECT COUNT(*) FROM mod_lab.lab_sensitive_origins; SELECT COUNT(*) FROM mod_lab.lab_criticality_lexicon; SELECT COUNT(*) FROM mod_lab.lab_laterality_organ_rules; SELECT COUNT(*) FROM public.approval_groups;"
# esperado:
# sensitive: 6, lexicon: ≥40, laterality: ≥55, approval_groups: 2
```

- [ ] **Step 9.6: Commit**

```bash
cd /Users/camiloespinoza/Zeru/.claude/worktrees/feature+fm-report-validation
git add apps/api/prisma/seed/ apps/api/package.json
git commit -m "feat(seed): citolab sensitive origins, lexicon, laterality, approval groups"
```

---

## Tarea 10: Extender `BiopsyTransformer` — campos root-level

Extender el transformer existente para leer 20+ campos nuevos del layout `Validación Final*`.

**Files:**
- Modify: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/types.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts`

- [ ] **Step 10.1: Escribir test fallante para nuevos campos**

Agregar al final de `biopsy.transformer.spec.ts` (antes del último `});` del `describe` principal):

```typescript
  it('extracts new F0 fields: sex, birthDate, folio, IHQ, criticality, CCB', () => {
    const record = {
      recordId: '42',
      modId: '1',
      fieldData: {
        'INFORME Nº': '2026-99999',
        'RUT': '12345678-9',
        'NOMBRE': 'JUAN',
        'A.PATERNO': 'PÉREZ',
        'A.MATERNO': 'SOTO',
        'EDAD': '65',
        'SEXO': 'M',
        'FECHA NACIMIENTO': '05/15/1960',
        'NºFOLIO': 'FOL-12345',
        'Nº ORDEN ATENCION': 'OA-777',
        'NUMERO IDENTIFICADOR INSTITUCION': 'HTSP-555',
        'COD. MEDICO': 'MED-99',
        'TIPO DE EXAMEN': 'Biopsia',
        'TIPO ENVASE': 'Frasco 10ml',
        'TACOS': '3',
        'CASSETTES DE INCLUSION': '4',
        'PLACAS HE': '4',
        'T.ESPECIALES': '2',
        'Total especiales': '2',
        'ANTICUERPOS': 'CD20|CD3|Ki67',
        'INMUNO NUMEROS': 'IHQ-2026-0042',
        'Total Inmunos': '3',
        'INMUNOS Estado Solicitud': 'Completada',
        'INMUNOS Fecha solicitud': '03/01/2026',
        'INMUNOS Fecha Respuesta': '03/03/2026',
        'INMUNOS Responsable solicitud': 'TM-ATENEA',
        'AVISAR PACIENTE': 'Sí',
        'RESULTADO CRITICO RESPONSABLE NOTIFICACION': 'JEFE-VAL',
        'FECHA NOTIFICACION CRITICO': '03/04/2026',
        'HORA NOTIFICACION VALOR CRITICO': '14:30',
        'PDF Notificación Crítico': '/path/to/notif.pdf',
        'COMENTARIOS CCB': 'Corregir lateralidad',
        'Rechazado por CCB': 'Sí',
        'DIAGNOSTICO MODIFICADO': 'Sí',
        'Modifcado Por': 'PATOLOGO-X',
        'Modifcado Por Fecha': '03/05/2026',
        'Modifcado Por Hora': '10:15',
        'Biopsias::Rut Medico Solicitante': '9876543-K',
        'FECHA': '02/28/2026',
        'FECHA VALIDACIÓN': '03/02/2026',
        'DIAGNOSTICO': 'Carcinoma ductal',
        'Alterado o Crítico': 'Sí',
        'PATOLOGO': 'Dr. Smith (DRS01)',
      },
      portalData: {},
    };

    const result = BiopsyTransformer.extract(record, 'BIOPSIAS');

    expect(result.subjectGender).toBe('MALE');
    expect(result.subjectBirthDate).toEqual(new Date('1960-05-15T00:00:00.000Z'));
    expect(result.externalFolioNumber).toBe('FOL-12345');
    expect(result.externalOrderNumber).toBe('OA-777');
    expect(result.externalInstitutionId).toBe('HTSP-555');
    expect(result.requestingPhysicianCode).toBe('MED-99');
    expect(result.requestingPhysicianRut).toBe('9876543-K');
    expect(result.containerType).toBe('Frasco 10ml');
    expect(result.tacoCount).toBe(3);
    expect(result.cassetteCount).toBe(4);
    expect(result.placaHeCount).toBe(4);
    expect(result.specialTechniquesCount).toBe(2);
    expect(result.ihqAntibodies).toEqual(['CD20', 'CD3', 'Ki67']);
    expect(result.ihqNumbers).toBe('IHQ-2026-0042');
    expect(result.ihqStatus).toBe('Completada');
    expect(result.criticalPatientNotifyFlag).toBe(true);
    expect(result.criticalNotifiedBy).toBe('JEFE-VAL');
    expect(result.rejectedByCcb).toBe(true);
    expect(result.ccbComments).toBe('Corregir lateralidad');
    expect(result.diagnosticModified).toBe(true);
    expect(result.modifiedByUser).toBe('PATOLOGO-X');
  });
```

- [ ] **Step 10.2: Ejecutar test — debe fallar**

```bash
pnpm --filter @zeru/api test biopsy.transformer -- --run 2>&1 | tail -20
# esperado: FAIL en el nuevo test — propiedades inexistentes
```

- [ ] **Step 10.3: Extender `types.ts` con los campos nuevos en `ExtractedExam`**

Abrir `apps/api/src/modules/filemaker/transformers/types.ts`. Localizar `export interface ExtractedExam`. Agregar:

```typescript
  // F0 — nuevos campos
  subjectGender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  subjectBirthDate?: Date | null;
  externalFolioNumber?: string | null;
  externalOrderNumber?: string | null;
  externalInstitutionId?: string | null;
  requestingPhysicianCode?: string | null;
  requestingPhysicianRut?: string | null;
  containerType?: string | null;
  tacoCount?: number | null;
  cassetteCount?: number | null;
  placaHeCount?: number | null;
  specialTechniquesCount?: number | null;
  ihqAntibodies?: string[];
  ihqNumbers?: string | null;
  ihqStatus?: string | null;
  ihqRequestedAt?: Date | null;
  ihqRespondedAt?: Date | null;
  ihqResponsibleNameSnapshot?: string | null;
  criticalPatientNotifyFlag?: boolean;
  criticalNotifiedBy?: string | null;
  criticalNotifiedAt?: Date | null;
  criticalNotificationPdfKey?: string | null;
  rejectedByCcb?: boolean;
  ccbComments?: string | null;
  diagnosticModified?: boolean;
  modifiedByUser?: string | null;
  modifiedAt?: Date | null;
```

- [ ] **Step 10.4: Extender `BiopsyTransformer.extract`**

Abrir `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts`. Dentro del método `extract`, antes del `return`, agregar asignaciones a las propiedades del retorno. Ejemplo para añadir en el objeto que se retorna:

```typescript
const fd = record.fieldData;
// ... existing assignments ...

// F0 — nuevos campos
result.subjectGender = mapGender(str(fd['SEXO']));
result.subjectBirthDate = parseDate(fd['FECHA NACIMIENTO']);
result.externalFolioNumber = str(fd['NºFOLIO']);
result.externalOrderNumber = str(fd['Nº ORDEN ATENCION']);
result.externalInstitutionId = str(fd['NUMERO IDENTIFICADOR INSTITUCION']);
result.requestingPhysicianCode = str(fd['COD. MEDICO']);
result.requestingPhysicianRut = normalizeRut(str(fd['Biopsias::Rut Medico Solicitante']));
result.containerType = str(fd['TIPO ENVASE']);
result.tacoCount = parseNum(fd['TACOS']);
result.cassetteCount = parseNum(fd['CASSETTES DE INCLUSION']);
result.placaHeCount = parseNum(fd['PLACAS HE']);
result.specialTechniquesCount = parseNum(fd['Total especiales']);
const anticuerpos = str(fd['ANTICUERPOS']);
result.ihqAntibodies = anticuerpos ? anticuerpos.split(/[|,;]/).map((s) => s.trim()).filter(Boolean) : [];
result.ihqNumbers = str(fd['INMUNO NUMEROS']);
result.ihqStatus = str(fd['INMUNOS Estado Solicitud']);
result.ihqRequestedAt = parseDate(fd['INMUNOS Fecha solicitud']);
result.ihqRespondedAt = parseDate(fd['INMUNOS Fecha Respuesta']);
result.ihqResponsibleNameSnapshot = str(fd['INMUNOS Responsable solicitud']);
result.criticalPatientNotifyFlag = isYes(fd['AVISAR PACIENTE']);
result.criticalNotifiedBy = str(fd['RESULTADO CRITICO RESPONSABLE NOTIFICACION']);
const critFecha = parseDate(fd['FECHA NOTIFICACION CRITICO']);
const critHora = str(fd['HORA NOTIFICACION VALOR CRITICO']);
result.criticalNotifiedAt = critFecha && critHora ? new Date(`${critFecha.toISOString().slice(0,10)}T${critHora.length === 5 ? critHora + ':00' : critHora}`) : critFecha ?? null;
result.criticalNotificationPdfKey = str(fd['PDF Notificación Crítico']);
result.ccbComments = str(fd['COMENTARIOS CCB']);
result.rejectedByCcb = isYes(fd['Rechazado por CCB']);
result.diagnosticModified = isYes(fd['DIAGNOSTICO MODIFICADO']);
result.modifiedByUser = str(fd['Modifcado Por']);
const modFecha = parseDate(fd['Modifcado Por Fecha']);
const modHora = str(fd['Modifcado Por Hora']);
result.modifiedAt = modFecha && modHora ? new Date(`${modFecha.toISOString().slice(0,10)}T${modHora.length === 5 ? modHora + ':00' : modHora}`) : modFecha ?? null;
```

- [ ] **Step 10.5: Agregar helper `mapGender` en `biopsy.transformer.ts` (arriba del archivo, después de imports)**

```typescript
function mapGender(raw: string | null | undefined): 'MALE' | 'FEMALE' | 'OTHER' | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'M' || v === 'MASCULINO' || v === 'MALE' || v === 'HOMBRE') return 'MALE';
  if (v === 'F' || v === 'FEMENINO' || v === 'FEMALE' || v === 'MUJER') return 'FEMALE';
  return 'OTHER';
}
```

- [ ] **Step 10.6: Import `normalizeRut` si no está importado ya**

Verificar al inicio de `biopsy.transformer.ts`:

```typescript
import { normalizeRut } from '@zeru/shared';
```

- [ ] **Step 10.7: Ejecutar test — debe pasar**

```bash
pnpm --filter @zeru/api test biopsy.transformer -- --run 2>&1 | tail -10
# esperado: PASS
```

- [ ] **Step 10.8: Commit**

```bash
git add apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts \
        apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts \
        apps/api/src/modules/filemaker/transformers/types.ts
git commit -m "feat(fm): BiopsyTransformer reads root-level F0 fields"
```

---

## Tarea 11: Extender `BiopsyTransformer` — portales

Leer portales `Observaciones Tecnicas`, `portalEventosAdversos`, `Placas`, `TÉCNICAS ESPECIALES`.

**Files:**
- Modify: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/types.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts`

- [ ] **Step 11.1: Agregar tipos de extracción en `types.ts`**

Agregar al final del archivo:

```typescript
export interface ExtractedAdverseEvent {
  eventType: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  description: string;
  occurredAt?: Date | null;
  detectedAt?: Date | null;
  status?: string | null;
}

export interface ExtractedTechnicalObservation {
  workflowStage?: string | null;
  description: string;
  observedAt?: Date | null;
  observedByNameSnapshot?: string | null;
}

export interface ExtractedSpecialTechnique {
  name: string;
  code?: string | null;
  requestedAt?: Date | null;
  respondedAt?: Date | null;
  responsibleNameSnapshot?: string | null;
  status?: string | null;
}

export interface ExtractedSlide {
  placaCode?: string | null;
  stain?: string | null;
  level?: string | null;
}
```

Luego agregar al interface `ExtractedExam`:

```typescript
  adverseEvents?: ExtractedAdverseEvent[];
  technicalObservations?: ExtractedTechnicalObservation[];
  specialTechniques?: ExtractedSpecialTechnique[];
  slides?: ExtractedSlide[];
```

- [ ] **Step 11.2: Escribir test para portales**

Agregar al spec:

```typescript
  it('extracts portals: adverse events, technical observations, slides, special techniques', () => {
    const record = {
      recordId: '43',
      modId: '1',
      fieldData: { 'INFORME Nº': '2026-99998' },
      portalData: {
        portalEventosAdversos: [
          { 'EventosAdversos::tipo': 'Corte mal teñido', 'EventosAdversos::severidad': 'Media', 'EventosAdversos::descripcion': 'Tinción pálida en lámina 2' },
        ],
        'Observaciones Tecnicas': [
          { 'Obs::etapa': 'MACROSCOPY', 'Obs::descripcion': 'Orientación cambiada', 'Obs::responsable': 'TM-JB' },
        ],
        Placas: [
          { 'Placas::codigo': 'PL-001', 'Placas::tincion': 'H&E', 'Placas::nivel': '1' },
          { 'Placas::codigo': 'PL-002', 'Placas::tincion': 'PAS', 'Placas::nivel': '2' },
        ],
        'TÉCNICAS ESPECIALES': [
          { 'Tec::nombre': 'PAS', 'Tec::codigo': 'PAS-01', 'Tec::estado': 'Completada' },
        ],
      },
    };

    const result = BiopsyTransformer.extract(record, 'BIOPSIAS');
    expect(result.adverseEvents).toHaveLength(1);
    expect(result.adverseEvents?.[0].eventType).toBe('Corte mal teñido');
    expect(result.technicalObservations).toHaveLength(1);
    expect(result.slides).toHaveLength(2);
    expect(result.specialTechniques).toHaveLength(1);
  });
```

- [ ] **Step 11.3: Implementar extracción de portales en `BiopsyTransformer.extract`**

Antes del `return result;` del `extract`, agregar:

```typescript
// Portales F0
const pd = record.portalData ?? {};

const adverseEventsPortal = pd['portalEventosAdversos'] as any[] | undefined;
result.adverseEvents = (adverseEventsPortal ?? [])
  .map((row) => ({
    eventType: str(row['EventosAdversos::tipo']) ?? 'DESCONOCIDO',
    severity: mapSeverity(str(row['EventosAdversos::severidad'])),
    description: str(row['EventosAdversos::descripcion']) ?? '',
    occurredAt: parseDate(row['EventosAdversos::fechaOcurrencia']),
    detectedAt: parseDate(row['EventosAdversos::fechaDeteccion']),
    status: str(row['EventosAdversos::estado']),
  }))
  .filter((e) => e.description);

const techObsPortal = pd['Observaciones Tecnicas'] as any[] | undefined;
result.technicalObservations = (techObsPortal ?? [])
  .map((row) => ({
    workflowStage: str(row['Obs::etapa']),
    description: str(row['Obs::descripcion']) ?? '',
    observedAt: parseDate(row['Obs::fecha']),
    observedByNameSnapshot: str(row['Obs::responsable']),
  }))
  .filter((o) => o.description);

const placasPortal = pd['Placas'] as any[] | undefined;
result.slides = (placasPortal ?? [])
  .map((row) => ({
    placaCode: str(row['Placas::codigo']),
    stain: str(row['Placas::tincion']),
    level: str(row['Placas::nivel']),
  }))
  .filter((s) => s.placaCode);

const tecnicasPortal = pd['TÉCNICAS ESPECIALES'] as any[] | undefined;
result.specialTechniques = (tecnicasPortal ?? [])
  .map((row) => ({
    name: str(row['Tec::nombre']) ?? '',
    code: str(row['Tec::codigo']),
    status: str(row['Tec::estado']),
    requestedAt: parseDate(row['Tec::fechaSolicitud']),
    respondedAt: parseDate(row['Tec::fechaRespuesta']),
    responsibleNameSnapshot: str(row['Tec::responsable']),
  }))
  .filter((t) => t.name);
```

- [ ] **Step 11.4: Agregar helper `mapSeverity` (arriba, junto a `mapGender`)**

```typescript
function mapSeverity(raw: string | null | undefined): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'BAJA' || v === 'LOW') return 'LOW';
  if (v === 'MEDIA' || v === 'MEDIUM') return 'MEDIUM';
  if (v === 'ALTA' || v === 'HIGH') return 'HIGH';
  if (v === 'CRÍTICA' || v === 'CRITICA' || v === 'CRITICAL') return 'CRITICAL';
  return null;
}
```

- [ ] **Step 11.5: Ejecutar test — debe pasar**

```bash
pnpm --filter @zeru/api test biopsy.transformer -- --run 2>&1 | tail -10
```

- [ ] **Step 11.6: Commit**

```bash
git add apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts \
        apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts \
        apps/api/src/modules/filemaker/transformers/types.ts
git commit -m "feat(fm): BiopsyTransformer extracts new portals (EA, obs tec, slides, tec esp)"
```

---

## Tarea 12: Extender `BiopsyTransformer` — attachments adicionales

Agregar scanner de solicitud, dictado macro (SCANNER BP 8::DICTADO MACRO) y la nueva categoría de encapsulación desde portales (aunque `FOTOS ENCAPSULACION` se maneja por su propio transformer en tarea 14, aquí capturamos los que estén embebidos en el portal del layout principal).

**Files:**
- Modify: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts`

- [ ] **Step 12.1: Escribir test para nuevos attachments**

```typescript
  it('extracts REQUEST_DOCUMENT and MACRO_DICTATION attachments', () => {
    const record = {
      recordId: '44',
      modId: '1',
      fieldData: {
        'INFORME Nº': '2026-99997',
        'Biopsias_Ingresos::Scanner Documento': 'https://fm.example/container/requests/solicitud-44.pdf',
        'SCANNER BP 8::DICTADO MACRO': 'https://fm.example/container/dictados/dict-44.mp3',
      },
      portalData: {},
    };

    const result = BiopsyTransformer.extract(record, 'BIOPSIAS');
    const requestDoc = result.attachments?.find((a) => a.category === 'REQUEST_DOCUMENT');
    const dictation = result.attachments?.find((a) => a.category === 'MACRO_DICTATION');
    expect(requestDoc).toBeDefined();
    expect(requestDoc?.fmContainerUrlOriginal).toContain('solicitud-44.pdf');
    expect(dictation).toBeDefined();
    expect(dictation?.fmContainerUrlOriginal).toContain('dict-44.mp3');
  });
```

- [ ] **Step 12.2: Extender extracción de attachments en `extractAttachmentRefs`**

Localizar el método que construye attachments (típicamente `extractAttachmentRefs` o similar dentro de `biopsy.transformer.ts`). Agregar antes del return de la lista:

```typescript
// F0 — REQUEST_DOCUMENT (solicitud escaneada)
const requestDocUrl = str(fd['Biopsias_Ingresos::Scanner Documento']);
if (requestDocUrl) {
  attachments.push({
    category: 'REQUEST_DOCUMENT',
    fmSourceField: 'Biopsias_Ingresos::Scanner Documento',
    fmContainerUrlOriginal: requestDocUrl,
    s3Key: `${tenantId}/cases/${informeNumber}/documents/request/${encodeS3Path(requestDocUrl)}`,
    sequenceOrder: 0,
  });
}

// F0 — MACRO_DICTATION (dictado del patólogo)
const dictationUrl = str(fd['SCANNER BP 8::DICTADO MACRO']);
if (dictationUrl) {
  attachments.push({
    category: 'MACRO_DICTATION',
    fmSourceField: 'SCANNER BP 8::DICTADO MACRO',
    fmContainerUrlOriginal: dictationUrl,
    s3Key: `${tenantId}/cases/${informeNumber}/audio/macro-dictation/${encodeS3Path(dictationUrl)}`,
    sequenceOrder: 0,
  });
}

// F0 — CRITICAL_NOTIFICATION_PDF si existe
const critPdfUrl = str(fd['PDF Notificación Crítico']);
if (critPdfUrl) {
  attachments.push({
    category: 'CRITICAL_NOTIFICATION_PDF',
    fmSourceField: 'PDF Notificación Crítico',
    fmContainerUrlOriginal: critPdfUrl,
    s3Key: `${tenantId}/cases/${informeNumber}/documents/critical-notification/${encodeS3Path(critPdfUrl)}`,
    sequenceOrder: 0,
  });
}
```

Nota: si `tenantId` no está disponible en el scope de `extractAttachmentRefs`, omitir el prefijo `${tenantId}/` del `s3Key` (el importador aguas arriba lo prefija al momento de persistir — patrón ya usado en `biopsy.transformer.ts` para otras attachments existentes). Verificar cómo hacen hoy los attachments existentes de `REPORT_PDF` y replicar esa convención exacta.

- [ ] **Step 12.3: Ejecutar test**

```bash
pnpm --filter @zeru/api test biopsy.transformer -- --run 2>&1 | tail -10
```

- [ ] **Step 12.4: Commit**

```bash
git add apps/api/src/modules/filemaker/transformers/biopsy.transformer.ts \
        apps/api/src/modules/filemaker/transformers/biopsy.transformer.spec.ts
git commit -m "feat(fm): BiopsyTransformer extracts request scan, macro dictation, critical PDF"
```

---

## Tarea 13: Extender `PapTransformer`

Campos nuevos: DOB, emails, antecedentes, alerta, control calidad, pasos trazabilidad adicionales.

**Files:**
- Modify: `apps/api/src/modules/filemaker/transformers/pap.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/pap.transformer.spec.ts`

- [ ] **Step 13.1: Test fallante en `pap.transformer.spec.ts`**

```typescript
  it('extracts new F0 fields: DOB, emails, antecedentes, alerta, QC, tracking dates', () => {
    const record = {
      recordId: '55',
      modId: '1',
      fieldData: {
        'INFORME Nº': '2026-PAP-77777',
        'RUT': '11111111-1',
        'NOMBRES': 'ANA',
        'A.PATERNO': 'LÓPEZ',
        'A.MATERNO': 'ROJAS',
        'EDAD': '45',
        'FECHA NACIMIENTO': '04/20/1980',
        'E MAIL PACIENTE': 'ana@example.com',
        'EMAIL MEDICO': 'medico@hospital.cl',
        'EMAIL INSTITUCION': 'lab@hospital.cl',
        'ANTECEDENTES CLINICOS': 'Control anual',
        'ANTECEDENTES CUELLO': 'Sin lesión previa',
        'ALERTA': 'Paciente gestante',
        'Control de Calidad': 'Revisado 2 lecturas',
        'FECHA REVISIÓN TM': '02/15/2026',
        'FECHA SECRETARIA PRE VALIDA': '02/16/2026',
        'FECHA SERCRETARIA VALIDA': '02/17/2026',
        'FOLIO V.INTEGRA': 'VI-88',
        'EXAMEN': 'PAP',
        'FECHA': '02/10/2026',
        'FECHA TOMA MUESTRA': '02/10/2026',
      },
      portalData: {},
    };

    const result = PapTransformer.extract(record, 'PAPANICOLAOU');
    expect(result.subjectBirthDate).toEqual(new Date('1980-04-20T00:00:00.000Z'));
    expect(result.clinicalHistory).toContain('Control anual');
    expect(result.patientEmail).toBe('ana@example.com');
    expect(result.requestingPhysicianEmail).toBe('medico@hospital.cl');
    expect(result.externalFolioNumber).toBe('VI-88');
  });
```

- [ ] **Step 13.2: Agregar a `ExtractedExam`**

Extender `types.ts` si no están:

```typescript
  patientEmail?: string | null;
  alertText?: string | null;
  qualityControlNote?: string | null;
  tmReviewedAt?: Date | null;
  secretaryPreValidatedAt?: Date | null;
  secretaryValidatedAt?: Date | null;
```

- [ ] **Step 13.3: Implementar en `PapTransformer.extract`**

Agregar antes del `return`:

```typescript
result.subjectBirthDate = parseDate(fd['FECHA NACIMIENTO']);
result.patientEmail = str(fd['E MAIL PACIENTE']);
result.requestingPhysicianEmail = str(fd['EMAIL MEDICO']);
const antClin = str(fd['ANTECEDENTES CLINICOS']);
const antCuello = str(fd['ANTECEDENTES CUELLO']);
result.clinicalHistory = [antClin, antCuello].filter(Boolean).join(' | ') || null;
result.alertText = str(fd['ALERTA']);
result.qualityControlNote = str(fd['Control de Calidad']);
result.tmReviewedAt = parseDate(fd['FECHA REVISIÓN TM']);
result.secretaryPreValidatedAt = parseDate(fd['FECHA SECRETARIA PRE VALIDA']);
result.secretaryValidatedAt = parseDate(fd['FECHA SERCRETARIA VALIDA']);
result.externalFolioNumber = str(fd['FOLIO V.INTEGRA']);
```

- [ ] **Step 13.4: Ejecutar test**

```bash
pnpm --filter @zeru/api test pap.transformer -- --run 2>&1 | tail -10
```

- [ ] **Step 13.5: Commit**

```bash
git add apps/api/src/modules/filemaker/transformers/pap.transformer.ts \
        apps/api/src/modules/filemaker/transformers/pap.transformer.spec.ts \
        apps/api/src/modules/filemaker/transformers/types.ts
git commit -m "feat(fm): PapTransformer reads F0 fields (DOB, emails, QC, tracking)"
```

---

## Tarea 14: Nuevo `ScannerEncapsulationTransformer`

Transformer para la DB `SCANNER BIOPSIAS CITOLAB 2014`, layout `FOTOS ENCAPSULACION`.

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/scanner-encapsulation.transformer.ts`
- Create: `apps/api/src/modules/filemaker/transformers/scanner-encapsulation.transformer.spec.ts`

- [ ] **Step 14.1: Crear spec primero**

```typescript
import { describe, it, expect } from 'vitest';
import { ScannerEncapsulationTransformer } from './scanner-encapsulation.transformer';

describe('ScannerEncapsulationTransformer', () => {
  it('extracts up to 8 encapsulation photos + 1 special', () => {
    const record = {
      recordId: '70',
      modId: '1',
      fieldData: {
        'INFORME Nº': '2026-88888',
        'FOTO 1': 'https://fm/container/enc/1-70.jpg',
        'FOTO 2': 'https://fm/container/enc/2-70.jpg',
        'FOTO 3': 'https://fm/container/enc/3-70.jpg',
        'FOTO ENCAPSULACIÓN 1': 'https://fm/container/enc/special-70.jpg',
        'Trazabilidad::Fecha_Scanner': '02/14/2026',
      },
    };

    const result = ScannerEncapsulationTransformer.extract(record);
    expect(result.fmInformeNumber).toBe(2026); // o el formato que se decida
    expect(result.attachments).toHaveLength(4);
    expect(result.attachments[0].category).toBe('ENCAPSULATION_PHOTO');
    expect(result.scannerCapturedAt).toEqual(new Date('2026-02-14T00:00:00.000Z'));
  });

  it('skips empty foto fields', () => {
    const record = {
      recordId: '71',
      modId: '1',
      fieldData: {
        'INFORME Nº': '2026-88889',
        'FOTO 1': 'https://fm/container/enc/1-71.jpg',
        'FOTO 2': '',
        'FOTO 3': null,
      },
    };
    const result = ScannerEncapsulationTransformer.extract(record);
    expect(result.attachments).toHaveLength(1);
  });
});
```

- [ ] **Step 14.2: Implementar transformer**

Crear `apps/api/src/modules/filemaker/transformers/scanner-encapsulation.transformer.ts`:

```typescript
import type { FmRecord } from '@zeru/shared';
import type { AttachmentRef } from './types';
import { str, parseNum, parseDate, encodeS3Path } from './helpers';

const DATABASE = 'SCANNER BIOPSIAS CITOLAB 2014';
const LAYOUT = 'FOTOS ENCAPSULACION';

export interface ExtractedEncapsulationRecord {
  fmInformeNumber: number | null;
  fmRecordId: string;
  fmModId: string;
  scannerCapturedAt: Date | null;
  attachments: AttachmentRef[];
}

export const ScannerEncapsulationTransformer = {
  database: DATABASE,
  layout: LAYOUT,

  extract(record: FmRecord): ExtractedEncapsulationRecord {
    const fd = record.fieldData ?? {};
    const informeNumber = parseNum(fd['INFORME Nº']);
    const attachments: AttachmentRef[] = [];

    for (let i = 1; i <= 8; i++) {
      const url = str(fd[`FOTO ${i}`]);
      if (url) {
        attachments.push({
          category: 'ENCAPSULATION_PHOTO',
          label: `Foto encapsulación ${i}`,
          sequenceOrder: i,
          fmSourceField: `FOTO ${i}`,
          fmContainerUrlOriginal: url,
          s3Key: `cases/${informeNumber ?? 'unknown'}/photos/encapsulation/${i}-${encodeS3Path(url)}`,
        });
      }
    }

    const special = str(fd['FOTO ENCAPSULACIÓN 1']);
    if (special) {
      attachments.push({
        category: 'ENCAPSULATION_PHOTO',
        label: 'Foto encapsulación especial',
        sequenceOrder: 99,
        fmSourceField: 'FOTO ENCAPSULACIÓN 1',
        fmContainerUrlOriginal: special,
        s3Key: `cases/${informeNumber ?? 'unknown'}/photos/encapsulation/special-${encodeS3Path(special)}`,
      });
    }

    return {
      fmInformeNumber: informeNumber,
      fmRecordId: record.recordId,
      fmModId: record.modId,
      scannerCapturedAt: parseDate(fd['Trazabilidad::Fecha_Scanner']),
      attachments,
    };
  },
};
```

- [ ] **Step 14.3: Ejecutar test**

```bash
pnpm --filter @zeru/api test scanner-encapsulation -- --run 2>&1 | tail -10
# esperado: 2 passed
```

- [ ] **Step 14.4: Exportar en `filemaker.module.ts` o transformers/index si existe**

No requiere provider en el módulo (son static). Verificar que el archivo nuevo compile:

```bash
pnpm --filter @zeru/api build 2>&1 | tail -5
```

- [ ] **Step 14.5: Commit**

```bash
git add apps/api/src/modules/filemaker/transformers/scanner-encapsulation.transformer.ts \
        apps/api/src/modules/filemaker/transformers/scanner-encapsulation.transformer.spec.ts
git commit -m "feat(fm): add ScannerEncapsulationTransformer for FOTOS ENCAPSULACION layout"
```

---

## Tarea 15: Cola BullMQ `report-validation` — constantes + registro

Agregar cola al `LabModule`.

**Files:**
- Modify: `apps/api/src/modules/lab/constants/queue.constants.ts`
- Modify: `apps/api/src/modules/lab/lab.module.ts`

- [ ] **Step 15.1: Agregar constantes**

Editar `apps/api/src/modules/lab/constants/queue.constants.ts`:

Después de las constantes existentes, agregar:

```typescript
export const REPORT_VALIDATION_QUEUE = 'report-validation';

export const REPORT_VALIDATION_JOB_NAMES = {
  PROCESS_VALIDATION: 'process-validation',
} as const;

export const REPORT_VALIDATION_QUEUE_CONFIG = {
  concurrency: 5,
  retryAttempts: 3,
  retryBackoff: {
    type: 'exponential' as const,
    delay: 3000, // 3s → 6s → 12s
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 3000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
  },
};
```

- [ ] **Step 15.2: Registrar cola en `LabModule`**

Editar `apps/api/src/modules/lab/lab.module.ts`. Importar la constante al inicio:

```typescript
import {
  LAB_IMPORT_QUEUE,
  ATTACHMENT_MIGRATION_QUEUE,
  REPORT_VALIDATION_QUEUE,
  REPORT_VALIDATION_QUEUE_CONFIG,
} from './constants/queue.constants';
```

En el array de `BullModule.registerQueue(...)`, agregar una tercera entrada:

```typescript
      {
        name: REPORT_VALIDATION_QUEUE,
        defaultJobOptions: REPORT_VALIDATION_QUEUE_CONFIG.defaultJobOptions,
      },
```

- [ ] **Step 15.3: Build verifica**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -5
```

- [ ] **Step 15.4: Commit**

```bash
git add apps/api/src/modules/lab/constants/queue.constants.ts \
        apps/api/src/modules/lab/lab.module.ts
git commit -m "feat(lab): register report-validation BullMQ queue"
```

---

## Tarea 16: Rediseñar `ReportValidationService`

Reemplazar el fire-and-forget del spike por enqueue a BullMQ. El service expone dos operaciones: `enqueueValidation(trigger)` y `getCanDispatch(tenantId, informeNumber, fmSource)`.

**Files:**
- Modify: `apps/api/src/modules/lab/services/report-validation.service.ts`
- Modify: `apps/api/src/modules/lab/services/report-validation.service.spec.ts` (crear si no existe)

- [ ] **Step 16.1: Escribir test del service (spec nuevo)**

Crear `apps/api/src/modules/lab/services/report-validation.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ReportValidationService } from './report-validation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { REPORT_VALIDATION_QUEUE, REPORT_VALIDATION_JOB_NAMES } from '../constants/queue.constants';

describe('ReportValidationService', () => {
  let service: ReportValidationService;
  let queueAdd: ReturnType<typeof vi.fn>;
  let prismaFindFirst: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    queueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
    prismaFindFirst = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportValidationService,
        {
          provide: PrismaService,
          useValue: {
            labDiagnosticReport: { findFirst: prismaFindFirst },
          },
        },
        {
          provide: getQueueToken(REPORT_VALIDATION_QUEUE),
          useValue: { add: queueAdd },
        },
      ],
    }).compile();

    service = module.get(ReportValidationService);
  });

  it('enqueues a job with correct payload', async () => {
    await service.enqueueValidation({
      tenantId: 'tenant-1',
      database: 'BIOPSIAS',
      informeNumber: 42,
      triggeredByUserId: 'user-1',
    });

    expect(queueAdd).toHaveBeenCalledWith(
      REPORT_VALIDATION_JOB_NAMES.PROCESS_VALIDATION,
      expect.objectContaining({
        tenantId: 'tenant-1',
        database: 'BIOPSIAS',
        informeNumber: 42,
        triggeredByUserId: 'user-1',
      }),
      expect.any(Object),
    );
  });

  describe('getCanDispatch', () => {
    it('returns true when report is not blocked', async () => {
      prismaFindFirst.mockResolvedValue({ id: 'r1', blockedForDispatch: false });
      const result = await service.getCanDispatch('tenant-1', 42, 'BIOPSIAS');
      expect(result.canDispatch).toBe(true);
    });

    it('returns false when report is blocked', async () => {
      prismaFindFirst.mockResolvedValue({ id: 'r1', blockedForDispatch: true });
      const result = await service.getCanDispatch('tenant-1', 42, 'BIOPSIAS');
      expect(result.canDispatch).toBe(false);
    });

    it('returns true (default) when report not found yet', async () => {
      prismaFindFirst.mockResolvedValue(null);
      const result = await service.getCanDispatch('tenant-1', 42, 'BIOPSIAS');
      expect(result.canDispatch).toBe(true);
      expect(result.reason).toContain('not-found');
    });
  });
});
```

- [ ] **Step 16.2: Reescribir `report-validation.service.ts`**

Reemplazar todo el contenido:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  REPORT_VALIDATION_QUEUE,
  REPORT_VALIDATION_JOB_NAMES,
  REPORT_VALIDATION_QUEUE_CONFIG,
} from '../constants/queue.constants';

export interface ReportValidationTrigger {
  tenantId: string;
  database: string;
  informeNumber: number;
  triggeredByUserId?: string | null;
}

export interface ProcessValidationJobData {
  tenantId: string;
  database: string;
  informeNumber: number;
  triggeredByUserId?: string | null;
  enqueuedAt: string; // ISO
}

export type CanDispatchResult =
  | { canDispatch: true; reason: string }
  | { canDispatch: false; reason: string };

@Injectable()
export class ReportValidationService {
  private readonly logger = new Logger(ReportValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REPORT_VALIDATION_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueueValidation(trigger: ReportValidationTrigger): Promise<{ jobId: string }> {
    const data: ProcessValidationJobData = {
      tenantId: trigger.tenantId,
      database: trigger.database,
      informeNumber: trigger.informeNumber,
      triggeredByUserId: trigger.triggeredByUserId ?? null,
      enqueuedAt: new Date().toISOString(),
    };

    const job = await this.queue.add(
      REPORT_VALIDATION_JOB_NAMES.PROCESS_VALIDATION,
      data,
      {
        ...REPORT_VALIDATION_QUEUE_CONFIG.defaultJobOptions,
        jobId: `${trigger.tenantId}:${trigger.database}:${trigger.informeNumber}`,
      },
    );

    this.logger.log(
      `Enqueued validation job ${job.id} for ${trigger.database}:${trigger.informeNumber} (tenant=${trigger.tenantId})`,
    );
    return { jobId: job.id ?? 'unknown' };
  }

  async getCanDispatch(
    tenantId: string,
    informeNumber: number,
    fmSource: string,
  ): Promise<CanDispatchResult> {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: {
        tenantId,
        fmInformeNumber: informeNumber,
        fmSource: fmSource as any,
      },
      select: { id: true, blockedForDispatch: true },
    });

    if (!report) {
      return { canDispatch: true, reason: 'report-not-found-yet' };
    }
    if (report.blockedForDispatch) {
      return { canDispatch: false, reason: 'blocked-by-validation' };
    }
    return { canDispatch: true, reason: 'not-blocked' };
  }
}
```

- [ ] **Step 16.3: Correr test**

```bash
pnpm --filter @zeru/api test report-validation.service -- --run 2>&1 | tail -10
```

- [ ] **Step 16.4: Actualizar registro en `LabModule`**

En `apps/api/src/modules/lab/lab.module.ts`, `ReportValidationService` ya está registrado (rescatado del spike). Verificar que siga apareciendo en `providers: []` y no tenga dependencias rotas tras el refactor:

```bash
pnpm --filter @zeru/api build 2>&1 | tail -5
```

- [ ] **Step 16.5: Commit**

```bash
git add apps/api/src/modules/lab/services/report-validation.service.ts \
        apps/api/src/modules/lab/services/report-validation.service.spec.ts
git commit -m "refactor(lab): redesign ReportValidationService to enqueue BullMQ jobs"
```

---

## Tarea 17: `ReportValidationProcessor` (worker con pipeline hasta SYNCED)

Procesador BullMQ que sincroniza el caso y crea `LabReportValidation.status=SYNCED`. Sin agentes todavía — eso es F1+.

**Files:**
- Create: `apps/api/src/modules/lab/processors/report-validation.processor.ts`
- Create: `apps/api/src/modules/lab/processors/report-validation.processor.spec.ts`
- Modify: `apps/api/src/modules/lab/lab.module.ts`

- [ ] **Step 17.1: Spec fallante**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ReportValidationProcessor } from './report-validation.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { FmAuthService } from '../../filemaker/services/fm-auth.service';

describe('ReportValidationProcessor', () => {
  let processor: ReportValidationProcessor;
  let prisma: any;
  let fmApi: any;

  beforeEach(async () => {
    prisma = {
      labReportValidation: {
        create: vi.fn().mockResolvedValue({ id: 'val-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      labDiagnosticReport: {
        findFirst: vi.fn().mockResolvedValue({ id: 'report-1' }),
        upsert: vi.fn().mockResolvedValue({ id: 'report-1' }),
      },
    };
    fmApi = {
      findRecords: vi.fn().mockResolvedValue([
        { recordId: '1', modId: '1', fieldData: { 'INFORME Nº': '2026-42' } },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportValidationProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: FmApiService, useValue: fmApi },
        { provide: FmAuthService, useValue: { getToken: vi.fn() } },
      ],
    }).compile();

    processor = module.get(ReportValidationProcessor);
  });

  it('processes a job, creates validation with status SYNCED', async () => {
    const job: any = {
      id: 'job-1',
      name: 'process-validation',
      data: {
        tenantId: 'tenant-1',
        database: 'BIOPSIAS',
        informeNumber: 42,
        enqueuedAt: new Date().toISOString(),
      },
      updateProgress: vi.fn(),
    };

    await processor.process(job);

    expect(prisma.labReportValidation.create).toHaveBeenCalled();
    // El último update deja status SYNCED (o COMPLETED si ya no hay agentes)
    const updates = prisma.labReportValidation.update.mock.calls;
    const statuses = updates.map((c: any[]) => c[0].data.status);
    expect(statuses).toContain('SYNCED');
  });
});
```

- [ ] **Step 17.2: Implementar processor**

Crear `apps/api/src/modules/lab/processors/report-validation.processor.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import {
  REPORT_VALIDATION_QUEUE,
  REPORT_VALIDATION_JOB_NAMES,
  REPORT_VALIDATION_QUEUE_CONFIG,
} from '../constants/queue.constants';
import type { ProcessValidationJobData } from '../services/report-validation.service';

const FM_SOURCE_BY_DATABASE: Record<string, string> = {
  BIOPSIAS: 'BIOPSIAS',
  BIOPSIASRESPALDO: 'BIOPSIASRESPALDO',
  PAPANICOLAOU: 'PAPANICOLAOU',
  PAPANICOLAOUHISTORICO: 'PAPANICOLAOUHISTORICO',
};

const LAYOUT_BY_DATABASE: Record<string, string> = {
  BIOPSIAS: 'Validación Final*',
  BIOPSIASRESPALDO: 'Validación Final*',
  PAPANICOLAOU: 'INGRESO',
  PAPANICOLAOUHISTORICO: 'INGRESO',
};

@Injectable()
@Processor(REPORT_VALIDATION_QUEUE, { concurrency: REPORT_VALIDATION_QUEUE_CONFIG.concurrency })
export class ReportValidationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportValidationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
  ) {
    super();
  }

  async process(job: Job<ProcessValidationJobData>): Promise<{ validationId: string }> {
    if (job.name !== REPORT_VALIDATION_JOB_NAMES.PROCESS_VALIDATION) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const { tenantId, database, informeNumber, triggeredByUserId } = job.data;
    this.logger.log(`Processing validation ${database}:${informeNumber} (tenant=${tenantId})`);

    const fmSource = FM_SOURCE_BY_DATABASE[database];
    if (!fmSource) {
      throw new Error(`Unsupported database: ${database}`);
    }

    // 1. Crear validation record PENDING
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: {
        tenantId,
        fmInformeNumber: informeNumber,
        fmSource: fmSource as any,
      },
      select: { id: true },
    });

    const validation = await this.prisma.labReportValidation.create({
      data: {
        tenantId,
        diagnosticReportId: report?.id ?? '__pending__',
        fmInformeNumber: informeNumber,
        fmSource: fmSource as any,
        triggeredByUserId: triggeredByUserId ?? null,
        status: 'PENDING',
      },
    });

    await job.updateProgress(10);

    try {
      // 2. Sincronizar desde FM (stub en F0 — solo verifica el caso existe)
      const layout = LAYOUT_BY_DATABASE[database];
      const records = await this.fmApi.findRecords(
        database,
        layout,
        { 'INFORME Nº': `=${informeNumber}` },
        { limit: 1 },
      );
      if (!records.length) {
        throw new Error(`FM record not found: ${database}/${layout}/INFORME Nº=${informeNumber}`);
      }
      await job.updateProgress(50);

      // 3. Marcar SYNCED
      await this.prisma.labReportValidation.update({
        where: { id: validation.id },
        data: {
          status: 'SYNCED',
          syncedAt: new Date(),
        },
      });
      await job.updateProgress(90);

      // NOTA F0: no corremos agentes ni decidimos veredicto todavía.
      // En F1+ se agregará: ANALYZING → COMPLETED con verdict.

      await job.updateProgress(100);
      return { validationId: validation.id };
    } catch (err) {
      await this.prisma.labReportValidation.update({
        where: { id: validation.id },
        data: {
          status: 'ERROR',
          completedAt: new Date(),
          errorMessage: (err as Error).message,
        },
      });
      throw err;
    }
  }
}
```

- [ ] **Step 17.3: Registrar processor en `LabModule`**

En `apps/api/src/modules/lab/lab.module.ts`, agregar import:

```typescript
import { ReportValidationProcessor } from './processors/report-validation.processor';
```

Y en `providers: [...]` (cerca de los otros processors):

```typescript
    // Report validation worker
    ReportValidationProcessor,
```

- [ ] **Step 17.4: Ejecutar test**

```bash
pnpm --filter @zeru/api test report-validation.processor -- --run 2>&1 | tail -10
```

- [ ] **Step 17.5: Verificar build completo**

```bash
pnpm --filter @zeru/api build 2>&1 | tail -5
```

- [ ] **Step 17.6: Commit**

```bash
git add apps/api/src/modules/lab/processors/report-validation.processor.ts \
        apps/api/src/modules/lab/processors/report-validation.processor.spec.ts \
        apps/api/src/modules/lab/lab.module.ts
git commit -m "feat(lab): ReportValidationProcessor writes LabReportValidation to SYNCED"
```

---

## Tarea 18: Actualizar controller + endpoint `can-dispatch` + smoke test E2E

Ajustar el controller rescatado para usar el service rediseñado y exponer el endpoint que FM consulta antes de despachar.

**Files:**
- Modify: `apps/api/src/modules/lab/controllers/report-validation.controller.ts`
- Create: `docs/guides/fm-script-zeru-validacion-resultado.md`

- [ ] **Step 18.1: Leer el controller actual del spike**

```bash
cat apps/api/src/modules/lab/controllers/report-validation.controller.ts
```

- [ ] **Step 18.2: Actualizar el controller**

Reemplazar el contenido para que use el nuevo service y agregue `GET can-dispatch`:

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
  Logger,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ReportValidationService } from '../services/report-validation.service';

const triggerSchema = z.object({
  database: z.enum(['BIOPSIAS', 'BIOPSIASRESPALDO', 'PAPANICOLAOU', 'PAPANICOLAOUHISTORICO']),
  informeNumber: z.coerce.number().int().positive(),
});
type TriggerInput = z.infer<typeof triggerSchema>;

@Controller('lab/report-validation')
export class ReportValidationController {
  private readonly logger = new Logger(ReportValidationController.name);
  private readonly tenantId: string;
  private readonly webhookKey: string;

  constructor(
    private readonly service: ReportValidationService,
    config: ConfigService,
  ) {
    this.tenantId = config.get<string>('FM_TENANT_ID') ?? '';
    this.webhookKey = config.get<string>('FM_WEBHOOK_KEY') ?? '';
    if (!this.tenantId || !this.webhookKey) {
      this.logger.warn('FM_TENANT_ID or FM_WEBHOOK_KEY not configured — trigger endpoint will reject all requests');
    }
  }

  @Post('trigger')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async trigger(
    @Headers('x-fm-webhook-key') providedKey: string | undefined,
    @Body(new ZodValidationPipe(triggerSchema)) body: TriggerInput,
    @Headers('x-triggered-by-user-id') triggeredByUserId?: string,
  ) {
    this.assertWebhookKey(providedKey);
    const { jobId } = await this.service.enqueueValidation({
      tenantId: this.tenantId,
      database: body.database,
      informeNumber: body.informeNumber,
      triggeredByUserId: triggeredByUserId ?? null,
    });
    return { status: 'enqueued', jobId };
  }

  @Get('can-dispatch/:database/:informeNumber')
  @Throttle({ default: { limit: 600, ttl: 60000 } })
  async canDispatch(
    @Headers('x-fm-webhook-key') providedKey: string | undefined,
    @Param('database') database: string,
    @Param('informeNumber', ParseIntPipe) informeNumber: number,
  ) {
    this.assertWebhookKey(providedKey);
    const result = await this.service.getCanDispatch(this.tenantId, informeNumber, database);
    return result;
  }

  private assertWebhookKey(provided: string | undefined) {
    if (!provided || !this.webhookKey) {
      throw new UnauthorizedException('missing webhook key');
    }
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(this.webhookKey, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('invalid webhook key');
    }
  }
}
```

- [ ] **Step 18.3: Smoke test manual end-to-end**

Con el API corriendo (`pnpm --filter @zeru/api dev`), probar el trigger:

```bash
source ~/Zeru/apps/api/.env
curl -sS -X POST http://localhost:3017/api/lab/report-validation/trigger \
  -H "Content-Type: application/json" \
  -H "x-fm-webhook-key: $FM_WEBHOOK_KEY" \
  -d '{"database":"BIOPSIAS","informeNumber":1000}' | jq
# esperado: { "status": "enqueued", "jobId": "..." }
```

Verificar en DB:

```bash
PGPASSWORD=zeru psql -h localhost -p 5437 -U zeru -d zeru -c \
  "SELECT id, status, fm_informe_number, synced_at, error_message FROM mod_lab.lab_report_validations ORDER BY created_at DESC LIMIT 1;"
# esperado: una fila con status SYNCED o ERROR (si el informe 1000 no existe en FM, ERROR es ok)
```

Probar can-dispatch:

```bash
curl -sS "http://localhost:3017/api/lab/report-validation/can-dispatch/BIOPSIAS/1000" \
  -H "x-fm-webhook-key: $FM_WEBHOOK_KEY" | jq
# esperado: { "canDispatch": true, "reason": "report-not-found-yet" } o similar
```

- [ ] **Step 18.4: Documentar contrato del script FM**

Crear `docs/guides/fm-script-zeru-validacion-resultado.md`:

```markdown
# Script FM `Zeru_Validacion_Resultado` — Contrato

Documento el contrato que el script de FileMaker `Zeru_Validacion_Resultado` debe implementar para integrarse con el sistema de validación.

## Flujo

### 1. Dispara trigger al validar

Al momento en que el usuario pulsa "Validar Informe" en FileMaker, el script `OnRecordCommit` o un script dedicado debe ejecutar `Insert from URL` hacia Zeru:

**Endpoint:** `POST {{ZERU_API_BASE}}/api/lab/report-validation/trigger`

**Headers:**
```
Content-Type: application/json
x-fm-webhook-key: {{FM_WEBHOOK_KEY}}
x-triggered-by-user-id: {{USUARIO_FM_ID}}  (opcional pero recomendado)
```

**Body:**
```json
{
  "database": "BIOPSIAS",
  "informeNumber": 12345
}
```

**Respuesta esperada (200 OK):**
```json
{ "status": "enqueued", "jobId": "..." }
```

Ante cualquier otro código, registrar en bitácora y continuar (no bloquear al usuario — la validación ocurre en paralelo).

### 2. Consulta `can-dispatch` antes de despachar

Cuando FileMaker está por despachar el PDF (envío por email, FTP, etc.), debe consultar primero:

**Endpoint:** `GET {{ZERU_API_BASE}}/api/lab/report-validation/can-dispatch/{database}/{informeNumber}`

**Headers:**
```
x-fm-webhook-key: {{FM_WEBHOOK_KEY}}
```

**Respuesta:**
```json
{ "canDispatch": true,  "reason": "not-blocked" }
```
o
```json
{ "canDispatch": false, "reason": "blocked-by-validation" }
```

Si `canDispatch=false`, FileMaker debe **retener el despacho** y mostrar al usuario que el caso está en revisión.

### 3. Write-back desde Zeru (F5)

Opcional en F0, se implementa en F5: Zeru ejecutará este script de FM pasando `informeNumber` + `verdict` para que FM actualice campos locales (flag de bloqueo, razones, etc.).

## Variables de entorno FM

- `ZERU_API_BASE`: URL base de Zeru (e.g. `https://api.zeru.cl`)
- `FM_WEBHOOK_KEY`: clave compartida, sincronizada con el env `FM_WEBHOOK_KEY` de Zeru.

## Manejo de errores

- Timeout: 5s.
- Si Zeru no responde, se registra en bitácora y se continúa con el flujo actual (para no bloquear operación).
- El `can-dispatch` debe ser consultado **siempre** antes de despachar, sin excepción.
```

- [ ] **Step 18.5: Commit**

```bash
git add apps/api/src/modules/lab/controllers/report-validation.controller.ts \
        docs/guides/fm-script-zeru-validacion-resultado.md
git commit -m "feat(lab): add can-dispatch endpoint and FM integration contract"
```

- [ ] **Step 18.6: Lint + test final**

```bash
pnpm lint 2>&1 | tail -5
# esperado: sin errores

pnpm --filter @zeru/api test -- --run 2>&1 | tail -10
# esperado: todos los tests pasan
```

- [ ] **Step 18.7: Commit de cierre de F0**

```bash
git commit --allow-empty -m "chore(f0): F0 foundations complete — gate to F1"
```

---

## Gate de cierre F0 → F1

Antes de declarar F0 completo y pasar a F1, verificar:

- [ ] La migración se aplicó sin errores en desarrollo
- [ ] El seed creó 6 procedencias sensibles, >40 términos de lexicón, >55 reglas de lateralidad, 2 grupos de aprobadores, 4 destinatarios
- [ ] `BiopsyTransformer` extrae los 25+ campos F0 nuevos + los 4 portales
- [ ] `PapTransformer` extrae los 8+ campos F0 nuevos
- [ ] `ScannerEncapsulationTransformer` extrae fotos 1-8 + especial
- [ ] Cola `report-validation` registrada en BullMQ
- [ ] Endpoint `POST /api/lab/report-validation/trigger` responde 200 y encola job
- [ ] Endpoint `GET /api/lab/report-validation/can-dispatch/:db/:n` responde con canDispatch boolean
- [ ] Un job end-to-end llega al worker, crea `LabReportValidation` y termina en status `SYNCED` (o `ERROR` controlado si el caso no existe)
- [ ] Trigger Postgres `approval_decisions_immutable` rechaza UPDATE/DELETE
- [ ] Trigger Postgres `approval_decisions_sod` rechaza cuando `decidedById = originalActorId`
- [ ] Permisos `lab-reports`, `operations`, `approvals` aparecen en `MODULE_DEFINITIONS`
- [ ] `pnpm lint` limpio
- [ ] Suite de tests del API 100% pasando

Si todo lo anterior ✅, F0 está cerrada y se puede arrancar F1 (Agentes determinísticos).

---

**FIN DEL PLAN F0**
