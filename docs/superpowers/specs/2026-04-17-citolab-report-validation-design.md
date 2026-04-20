# Citolab — Sistema de validación automatizada post-humana de informes

**Fecha:** 2026-04-17
**Estado:** Diseño aprobado — pendiente de implementación
**Autor:** Camilo Espinoza + equipo de agentes Claude (10 investigadores + síntesis)
**Scope:** Fase 2 del módulo lab de Zeru — capa de validación con agentes de IA que correrá **después** de la validación humana en FileMaker para garantizar que ningún informe con error se despache.

---

## 1. Contexto

Citolab es un laboratorio chileno de histopatología y citología. Hoy, la validación de informes la realiza un equipo humano en FileMaker siguiendo el POES-CCB2 (9 pasos) y, para casos sin revisión de patólogo, un "Paso a paso validación" adicional de 14 pasos. Un informe erróneo despachado representa un riesgo clínico y legal grave.

Este sistema agrega una **capa de validación automatizada asíncrona** que se dispara cuando el humano pulsa "Validar Informe" en FM, corre una flota de agentes especializados sobre el caso, y **bloquea el despacho** si detecta inconsistencias. Casos críticos requieren **dual approval**; no críticos requieren un único aprobador del equipo de calidad distinto del validador original.

## 2. Decisiones de alcance (confirmadas)

| # | Decisión | Valor |
|---|---|---|
| D1 | Rol del humano en V1 | Sigue validando como hoy en FM; el sistema corre **después** de su validación |
| D2 | Temporalidad del request | **Asíncrono para el humano** (no espera), pero **bloqueante del despacho** (gate duro) |
| D3 | Caso crítico con inconsistencia | **Dual approval** de grupo configurable (min. 2 firmas, grupo Jefa Validación + Gerente Operaciones + otros) |
| D4 | Caso no crítico con inconsistencia | **1 aprobador** del equipo de calidad, **distinto del validador original** (SoD) |
| D5 | Alertas | Multi-destinatario: validador original, jefa validación, gerente operaciones, gerente general (este último solo en críticos). In-app + email |
| D6 | Política ante duda | **Preferir falsos positivos sobre falsos negativos** (política conservadora médica) |
| D7 | Modificaciones a FileMaker | **Ninguna.** Cero creación o alteración de campos en FM. Se extienden los transformers de Zeru para leer campos/portales ya existentes en FM |
| D8 | Sistema de evaluación | **Liviano**: sin golden set anotado inicial, sin regression CI estricto. Shadow implícito (gate `false` durante F1–F4), telemetría densa, auditoría aleatoria 5%, replay histórico sobre `Rechazado por CCB` |
| D9 | Flota productiva | **9 agentes**: 6 de texto + 3 de evidencia (solicitud, encapsulación/macro, PDF final) |
| D10 | Procedencias sensibles | **Configurables por tenant**; sembradas 6 (HTSP, HTSCEM, FSC, Megasalud, Policenter, Hospital del Profesor) |
| D11 | Destino del worktree previo | **Rescatar** `feature+fm-report-validation` (endpoint trigger, modelo `LabReportValidation`, contrato write-back FM); **rediseñar**: fire-and-forget → BullMQ, campos JSON → modelos relacionales, EventEmitter → jobs persistentes |
| D12 | Ejecución del plan | Agentes Opus 4.7 con dispatching paralelo: ~9-10 días calendario, comprimible a 6-7 con solapamiento |

## 3. Hallazgos de investigación

Resumen de los 10 agentes investigadores desplegados (reportes completos archivados por agent ID).

### 3.1 Universo de validación (Agente 1)
**43 validaciones atómicas** (V001–V043) en 13 categorías + **20 reglas implícitas** (RI-01–RI-20). 13 artefactos físicos/digitales con clave de unión por número de caso. Diferencias documentadas entre flujo CON y SIN patólogo.

### 3.2 Discovery FM real (ejecutado contra `rdp.citolab.cl` via Zeru `/filemaker/discovery`)

Layout principal `Validación Final*` (BIOPSIAS): **241 campos**. Layout `INGRESO` (PAPANICOLAOU): **135 campos**. Descubrimientos clave de campos que **existen en FM pero no se sincronizan hoy**:

**Biopsias — root-level:**
`SEXO`, `FECHA NACIMIENTO`, `NºFOLIO`, `Nº ORDEN ATENCION`, `NUMERO IDENTIFICADOR INSTITUCION`, `COD. MEDICO`, `Biopsias::Rut Medico Solicitante`, `TIPO ENVASE`, `TACOS`, `CASSETTES DE INCLUSION`, `PLACAS HE`, `T.ESPECIALES`, `Total especiales`, `ANTICUERPOS`, `INMUNO NUMEROS`, `Total Inmunos`, `INMUNOS Estado Solicitud`, `INMUNOS Fecha Solicitud`, `INMUNOS Fecha Respuesta`, `INMUNOS Responsable Solicitud`, `AVISAR PACIENTE`, `RESULTADO CRITICO RESPONSABLE NOTIFICACION`, `FECHA NOTIFICACION CRITICO`, `HORA NOTIFICACION VALOR CRITICO`, `PDF Notificación Crítico`, `COMENTARIOS CCB`, `Rechazado por CCB`, `SECRETARIA INGRESO`, `Incongruencia RapidaDiferida`, `MOTIVO ATRASO`, `VALIDA`, `VALIDADO`, `Estado FTP`, `Estado Web`, `FECHA BLOQUEO`, `Responsable Bloqueo`, `DIAGNOSTICO MODIFICADO`, `Modifcado Por` + fecha/hora, `caso corregido por validacion`, `ext_paciente_id`, `numero_informe_base`.

**Biopsias — related (portales):**
`Biopsias_Ingresos::Scanner Documento` ← **solicitud escaneada**
`SCANNER BP 8::DICTADO MACRO`
`SCANNER BP 8::FOTO 1..22` ← **fotos macro**
`Procedencias::email_receptor_critico_BIOPSIA`, `email_receptor_critico_BP 1`

**Portales sin leer:**
`Observaciones Tecnicas`, `portalEventosAdversos` ← EA/OT
`Placas` ← láminas histológicas
`TÉCNICAS ESPECIALES` ← catálogo estructurado

**PAP — root-level:**
`EMAIL MEDICO`, `E MAIL PACIENTE`, `EMAIL INSTITUCION`, `FECHA NACIMIENTO`, `ANTECEDENTES CLINICOS`, `ANTECEDENTES CUELLO`, `ALERTA`, `Control de Calidad`, `LECTOR RESCREANING`, `FECHA REVISIÓN TM`, `FECHA SECRETARIA PRE VALIDA`, `FECHA SERCRETARIA VALIDA`, `FOLIO V.INTEGRA`, `Acusa Recibo` + medio/imagen/fecha/responsable, `FECHA MAIL MEDICO`, `FECHA MAIL PACIENTE`, `FECHA ENVIO FTP`.

**Database independiente:** `SCANNER BIOPSIAS CITOLAB 2014` con layout **`FOTOS ENCAPSULACION`** (8 campos FOTO + `FOTO ENCAPSULACIÓN 1`, ligado a `Trazabilidad::Fecha_Scanner`).

### 3.3 Estado código Zeru (Agentes 3, 4, 5)
- Módulo `filemaker` maduro para sincronización, **cero validación de negocio** hoy. 8 transformers, 6 con specs. `FmSyncService` monolítico (1062 LOC). FM→Zeru para entidades lab **no implementado** (v1 limitation documentada).
- Módulo `lab` con modelos completos: `LabDiagnosticReport`, `LabServiceRequest`, `LabSpecimen`, `LabSlide`, `LabSigner` (con superseding), `LabWorkflowEvent` (30+ tipos), `LabCommunication`, `LabAdverseEvent`, `LabTechnicalObservation`, `LabDiagnosticReportAttachment` (categorías ya definidas incluyendo `ENCAPSULATION_PHOTO`, `CRITICAL_NOTIFICATION_PDF`).
- UI lab: solo `/laboratory/dashboard` y `/laboratory/origins` implementadas; reception, processing, reports, coding son placeholders.
- **Worktree previo `feature+fm-report-validation` (rebaseado sobre develop 2026-04-17):** esqueleto rescatable: `POST /lab/report-validation/trigger` con auth `X-FM-Webhook-Key`, modelo `LabReportValidation` con campos AI tracking, write-back FM vía script `Zeru_Validacion_Resultado`. Rediseñar: fire-and-forget → BullMQ, campos JSON → modelos relacionales, EventEmitter → jobs persistentes.

### 3.4 Reglas médicas (Agente 6)
Matriz completa de lateralidad por órgano (obligatoria/no-aplica/contextual), prestación↔tipo muestra, keyword→prestación inferida, IHQ esperada por órgano/diagnóstico (mama ER/PR/HER2/Ki-67; próstata PIN4 AMACR+p63+HMWCK; pulmón TTF-1+p40; linfoma panel WHO; GIST CD117+DOG1; etc.), **40 tipos de inconsistencia** catalogados (20 bloqueantes, 15 warning, 5 info). Incluye ASCO/CAP 2023 HER2-low, Bethesda, Milan, París, Yokohama.

### 3.5 Criticidad (Agente 7)
Distinción **crítico vs crítico agudo** (CAP/ADASP). Catálogo por sistema + no-oncológicos. **Algoritmo multicapa** de detección: señal explícita FM → segunda firma → léxico con detector de negación → CIE-10/CIE-O → técnicas IHQ → contexto procedencia. **Regla de seguridad dura:** si paciente tuvo caso crítico en últimos 12 meses y nuevo informe no se marca crítico, levantar alerta obligatoria.

### 3.6 Concordancia macro-histo-conclusión (Agente 8)
Framework con fichas estructuradas (`MacroFacts`, `HistoFacts`, `ConclusionFacts`), 5 validadores modulares, **ensemble cruzado obligatorio para malignidades** (Opus 4.7 como 2ª opinión), prompts con grounding obligatorio (cada afirmación con cita literal verificable), 8 casos sintéticos de prueba. Objetivo: **sensibilidad ≥99.5% en discordancias diagnósticas críticas**.

### 3.7 Visión (Agente 9)
**Pipeline híbrido**: AWS Textract (OCR estructurado) + GPT-5.4 vision (razonamiento semántico). Decisión V1: OCR Textract para solicitud (formulario); VLM gpt-5.4 para encapsulación/macro (razonamiento visual).

### 3.8 Notificaciones/RBAC (Agente 10)
Zeru ya tiene: `NotificationService` (in-app + WS Socket.IO), `EmailService` (SES con branding por tenant), `PermissionGuard`, patrón `getAdminRecipients` resolver por permiso. **A construir:** módulo `approvals/` con 5 modelos Prisma nuevos, SoD enforced en 3 capas (DB unique + servicio + trigger Postgres), audit log inmutable (revoke UPDATE/DELETE + trigger).

---

## 4. Arquitectura

### 4.1 Flujo de alto nivel

```
[FM: humano pulsa "Validar Informe"]
           │
           ▼
[FM script: POST /api/lab/report-validation/trigger {database, informeNumber}]
           │  (auth X-FM-Webhook-Key, throttle 60/min)
           ▼
[Zeru controller: ack 200 → humano sigue validando]
           │
           ▼
[BullMQ cola `report-validation`: job encolado, retries=3 backoff exp]
           │
           ▼
[Worker ReportValidationProcessor]
    ├─ 1. syncFromFm()        — reusa BiopsyTransformer / PapTransformer extendidos
    ├─ 2. downloadAttachments() — PDF + scan solicitud + fotos encapsulación/macro
    ├─ 3. runAgentPipeline()    — 9 agentes en paralelo (30s timeout)
    ├─ 4. consolidateVerdict()  — agregar sub-veredictos
    ├─ 5. persistResult()       — LabReportValidation + agentRuns + findings
    ├─ 6. dispatchSideEffects() según veredicto:
    │     ├─ PASS verde        → LabDiagnosticReport.blockedForDispatch=false
    │     ├─ FAIL no-crítico   → createApprovalRequest(single, excludeOriginal) + alerts
    │     └─ FAIL crítico      → createApprovalRequest(dual) + alerts + email gerente general
    └─ 7. writeBackToFm()       — script FM Zeru_Validacion_Resultado
           │
           ▼
[FM consulta GET /lab/report-validation/can-dispatch/:informeNumber antes de despachar]
[Si blockedForDispatch=true → FM retiene; si false → FM despacha]
```

### 4.2 Componentes

1. **`ReportValidationController`** (rescatado): endpoint `POST /api/lab/report-validation/trigger` con `X-FM-Webhook-Key`.
2. **`ReportValidationProcessor`** (BullMQ): orquesta sync → agents → persistence → side effects.
3. **`AgentPipelineOrchestrator`**: ejecuta 9 agentes en paralelo, cada uno con contrato `run(ctx): Promise<AgentVerdict>`.
4. **9 agentes** (detalle §5).
5. **`ValidationConsolidator`**: agrega sub-veredictos → veredicto global.
6. **`ApprovalService`**: crea requests, valida SoD, registra decisiones, dispara unblock.
7. **`ApprovalNotificationListener`**: fan-out de alertas in-app + email.
8. **Gate de despacho**: `GET /api/lab/report-validation/can-dispatch/:informeNumber` consultado por FM.

### 4.3 Latencia objetivo

| Etapa | p50 | p95 |
|---|---|---|
| Sync FM + download | 2-5s | 8s |
| Agentes paralelos | 8-15s | 25s |
| Persistencia + side effects | <1s | 2s |
| **Total desde trigger** | **12-20s** | **30s** |

### 4.4 Decisiones arquitectónicas clave

- **Async para humano, síncrono para despacho.** Humano no espera; informe no sale hasta veredicto.
- **Rescatar del worktree:** controller, esqueleto del service, modelo `LabReportValidation` (con campos AI tracking), contrato write-back FM.
- **Rediseñar:** fire-and-forget → BullMQ con retries/persistencia; `EventEmitter` interno → jobs de cola; estados hardcoded → enum Prisma; JSON libre → modelos relacionales para findings (permite métricas y query).
- **Single-tenant en V1** (Citolab) con arquitectura multi-tenant ready.

---

## 5. Flota de agentes productivos

### 5.1 Contrato uniforme

```typescript
interface ValidationAgent {
  key: ValidationAgentKey;
  run(context: ExamContext): Promise<AgentVerdict>;
}

type AgentVerdict = {
  agentKey: ValidationAgentKey;
  verdict: 'PASS' | 'WARN' | 'FAIL';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;   // 0..1
  findings: Finding[];
  tokensInput?: number;
  tokensOutput?: number;
  model?: string;
  provider?: string;
  durationMs: number;
};
```

### 5.2 Los 9 agentes

| # | Agente | Motor | Modelo | Validaciones V00x | Severidad al fallar |
|---|---|---|---|---|---|
| 1 | **identity** | determinístico | — | V001, V002, V006, V007, V008, RI-04, RI-05 | CRITICAL |
| 2 | **origin** | determinístico | — | V009, V010, V014, V028, RI-12 | HIGH–CRITICAL |
| 3 | **sample** | híbrido | gpt-5.4-mini | V011, V012, V013, V015, V017, V030, V031, RI-06 | HIGH–CRITICAL |
| 4 | **concordance** | LLM (ensemble en malignidad) | gpt-5.4 + claude-opus-4-7 | V016, V018, V019, V020, V021, V022, V023, V024, V025, RI-02, RI-11, RI-13 | CRITICAL |
| 5 | **criticality** | híbrido | gpt-5.4 | V026, V027, V029, RI-15, RI-16 | CRITICAL |
| 6 | **traceability** | determinístico | — | V032, V033, V034, V038, V039, V040, V041, V042, V043 | HIGH |
| 7 | **vision-request** | OCR (Textract) + VLM | gpt-5.4-vision | V002 cross-check, V009 cross-check, V011 cross-check, V014 textual | CRITICAL |
| 8 | **vision-encapsulation-macro** | OCR + VLM | gpt-5.4-vision | V035, V036, V037 | CRITICAL en cruce |
| 9 | **pdf-final** | pdf-parse + VLM opcional | — / gpt-5.4-vision | V042, V043 | HIGH |

### 5.3 Ejecución y orden

- Todos los 9 agentes arrancan **en paralelo** una vez completos `syncFromFm` + `downloadAttachments`.
- Timeout global por agente: **30s**.
- `concordance` puede disparar segunda pasada secuencial con claude-opus-4-7 si detecta FAIL malignidad con `confidence<0.85`.

### 5.4 Consolidación

```
Si cualquier agente severity=CRITICAL con verdict=FAIL:
  → global FAIL
  Si criticality.isCritical=true:
    → requiere dual approval
  Else:
    → requiere single approver (≠ validador original)
Si ≥2 agentes verdict=WARN:
  → global WARN (alerta, no bloquea)
Si todos PASS AND confianza promedio ≥0.85:
  → global PASS → desbloquea
Confianza promedio < 0.70:
  → escalar a revisión humana (aunque todo sea PASS)
```

### 5.5 AI Cost Tracking (obligatorio)

Por cada ejecución de agente que llama LLM, fila en `AiUsageLog`:
- `provider`: `OPENAI` | `ANTHROPIC` | `AWS_TEXTRACT`
- `model`: `gpt-5.4` | `gpt-5.4-mini` | `gpt-5.4-vision` | `claude-opus-4-7` | `textract`
- `inputTokens`, `outputTokens` (0 para Textract)
- `feature`: `"report-validation-{agentKey}"`
- `tenantId`
- `conversationId`: null
- `metadata`: `{ validationId, diagnosticReportId, fmInformeNumber }`

### 5.6 Costo estimado por caso

| Agente | Costo USD/caso |
|---|---|
| identity | 0 |
| origin | 0 |
| sample | ~0.001 |
| concordance | ~0.02–0.04 |
| criticality | ~0.005 |
| traceability | 0 |
| vision-request | ~0.02 |
| vision-encapsulation-macro | ~0.03 |
| pdf-final | ~0.002 |
| **Total/caso** | **~0.075–0.10** |

A 120 casos/día → **~USD 270–360/mes** en LLM+visión (sin VLM de PDF).

---

## 6. Modelo de datos

### 6.1 Extensiones a modelos existentes

**`LabPatient`**: `gender`, `birthDate`, `email`.
**`LabPractitioner`**: `email`, `rut` (poblar), `code` (poblar). Resolver en importador.
**`LabServiceRequest`**: `externalFolioNumber`, `externalInstitutionId`, `externalOrderNumber`, `requestingPhysicianEmail`, `requestingPhysicianId` (resolver).
**`LabSpecimen`**: `containerType`, `tacoCount`, `cassetteCount`, `placaHeCount`, `specialTechniquesCount`, `ihqAntibodies: String[]`, `ihqNumbers`, `ihqStatus`, `ihqRequestedAt`, `ihqRespondedAt`, `ihqResponsible`.
**`LabDiagnosticReport`**: `validationVerdict: ValidationVerdict?`, `lastValidationRunId: String?`, `blockedForDispatch: Boolean @default(false)`, `criticalPatientNotifyFlag`, `criticalNotificationPdfKey`, `criticalNotifiedAt`, `criticalNotifiedBy`, `rejectedByCcb`, `ccbComments`, `diagnosticModified`, `modifiedBy`, `modifiedAt`.
**`LabWorkflowEvent` (enum)**: agregar `SECRETARY_PRE_VALIDATION`, `TM_REVIEW`, `SCANNER_CAPTURE`, `CRITICAL_NOTIFICATION_SENT`, `PATIENT_NOTIFICATION`, `AGENT_VALIDATION_RUN`, `AGENT_VALIDATION_PASSED`, `AGENT_VALIDATION_FAILED`.
**`LabDiagnosticReportAttachment`**: poblar categorías ya declaradas (`REQUEST_DOCUMENT`, `ENCAPSULATION_PHOTO`, `CRITICAL_NOTIFICATION_PDF`).

### 6.2 Nuevos modelos de validación

```prisma
enum ValidationRunStatus { PENDING SYNCED ANALYZING COMPLETED ERROR CANCELLED }
enum ValidationVerdict   { GREEN YELLOW RED PENDING }
enum ValidationAgentKey  { IDENTITY ORIGIN SAMPLE CONCORDANCE CRITICALITY
                           TRACEABILITY VISION_REQUEST VISION_ENCAPSULATION_MACRO PDF_FINAL }
enum FindingSeverity     { CRITICAL HIGH MEDIUM LOW }
enum FindingVerdict      { PASS WARN FAIL }

model LabReportValidation {
  id                  String   @id @default(uuid())
  tenantId            String
  diagnosticReportId  String
  fmInformeNumber     Int
  fmSource            FmSource
  triggeredByUserId   String?
  status              ValidationRunStatus @default(PENDING)
  verdict             ValidationVerdict?
  confidenceAvg       Decimal?
  isCritical          Boolean  @default(false)
  isAcuteCritical     Boolean  @default(false)
  startedAt           DateTime @default(now())
  syncedAt            DateTime?
  analysisStartedAt   DateTime?
  completedAt         DateTime?
  errorMessage        String?
  pdfExtractedText    String?
  summary             Json?
  isReplay            Boolean  @default(false)
  agentRuns           LabValidationAgentRun[]
  findings            LabValidationFinding[]
  approvalRequest     ApprovalRequest?
  @@index([tenantId, status, startedAt])
  @@index([tenantId, diagnosticReportId])
  @@schema("mod_lab")
}

model LabValidationAgentRun {
  id              String   @id @default(uuid())
  validationId    String
  agentKey        ValidationAgentKey
  verdict         FindingVerdict
  severity        FindingSeverity
  confidence      Decimal
  durationMs      Int
  model           String?
  provider        String?
  inputTokens     Int?
  outputTokens    Int?
  aiUsageLogId    String?
  rawOutput       Json?
  @@unique([validationId, agentKey])
  @@schema("mod_lab")
}

model LabValidationFinding {
  id                   String   @id @default(uuid())
  validationId         String
  agentKey             ValidationAgentKey
  ruleId               String
  verdict              FindingVerdict
  severity             FindingSeverity
  message              String
  field                String?
  evidenceQuote        String?
  evidenceSource       String?
  suggestion           String?
  requiresHumanReview  Boolean  @default(false)
  blocksDispatch       Boolean  @default(false)
  @@index([validationId, severity])
  @@index([ruleId])
  @@schema("mod_lab")
}
```

### 6.3 Modelos de aprobaciones (schema `public` — genérico)

```prisma
enum ApprovalSubjectType  { LAB_REPORT_VALIDATION }
enum ApprovalReason       { CRITICAL_VALIDATION_FAILED  NON_CRITICAL_VALIDATION_FAILED }
enum ApprovalStatus       { PENDING APPROVED REJECTED EXPIRED CANCELLED }
enum ApprovalDecisionKind { APPROVE REJECT }
enum AlertChannel         { IN_APP EMAIL SMS WEBHOOK }
enum RecipientScope       { GROUP_MEMBER PERMISSION USER ORIGINAL_ACTOR }

model ApprovalGroup {
  id                    String   @id @default(uuid())
  tenantId              String
  slug                  String
  name                  String
  description           String?
  reason                ApprovalReason
  minApprovers          Int      @default(1)
  excludeOriginalActor  Boolean  @default(true)
  slaHours              Int      @default(72)
  isActive              Boolean  @default(true)
  members               ApprovalGroupMember[]
  requests              ApprovalRequest[]
  alertRecipients       ApprovalAlertRecipient[]
  @@unique([tenantId, slug])
  @@schema("public")
}

model ApprovalGroupMember {
  id        String   @id @default(uuid())
  groupId   String
  userId    String
  addedAt   DateTime @default(now())
  addedById String?
  @@unique([groupId, userId])
  @@schema("public")
}

model ApprovalRequest {
  id                  String   @id @default(uuid())
  tenantId            String
  subjectType         ApprovalSubjectType
  subjectId           String
  reason              ApprovalReason
  status              ApprovalStatus @default(PENDING)
  originalActorId     String?
  groupId             String
  approvalsRequired   Int
  approvalsCount      Int      @default(0)
  rejectionsCount     Int      @default(0)
  snapshot            Json
  createdAt           DateTime @default(now())
  expiresAt           DateTime?
  resolvedAt          DateTime?
  decisions           ApprovalDecision[]
  @@index([tenantId, status, createdAt])
  @@index([tenantId, subjectType, subjectId])
  @@schema("public")
}

model ApprovalDecision {
  id           String   @id @default(uuid())
  requestId    String
  decidedById  String
  decision     ApprovalDecisionKind
  notes        String
  ipAddress    String?
  userAgent    String?
  decidedAt    DateTime @default(now())
  @@unique([requestId, decidedById])
  @@schema("public")
}

model ApprovalAlertRecipient {
  id             String   @id @default(uuid())
  tenantId       String
  groupId        String?
  reason         ApprovalReason?
  scope          RecipientScope
  permissionKey  String?
  userId         String?
  channels       AlertChannel[]
  @@index([tenantId, groupId, reason])
  @@schema("public")
}
```

### 6.4 Modelos de configurabilidad (schema `mod_lab`)

```prisma
enum SensitiveRule    { MUESTRA_TEXTUAL_EXACTA }
enum LexCategory      { MALIGNIDAD INVASION IN_SITU SOSPECHA INFECCION_CRITICA
                        HEMATOLOGIA_AGRESIVA TRASPLANTE_VASCULITIS NEGACION }
enum LateralityReq    { REQUIRED NOT_APPLICABLE CONTEXTUAL }

model LabSensitiveOrigin {
  id           String   @id @default(uuid())
  tenantId     String
  labOriginId  String?
  nameMatch    String?
  rule         SensitiveRule
  isActive     Boolean @default(true)
  @@index([tenantId, isActive])
  @@schema("mod_lab")
}

model LabCriticalityLexicon {
  id          String   @id @default(uuid())
  tenantId    String
  category    LexCategory
  pattern     String
  isRegex     Boolean @default(false)
  weight      Int     @default(1)
  locale      String  @default("es-CL")
  isActive    Boolean @default(true)
  @@index([tenantId, category, isActive])
  @@schema("mod_lab")
}

model LabLateralityOrganRule {
  id            String         @id @default(uuid())
  tenantId      String
  organPattern  String
  requirement   LateralityReq
  @@unique([tenantId, organPattern])
  @@schema("mod_lab")
}

model LabValidationRuleset {
  id                          String   @id @default(uuid())
  tenantId                    String   @unique
  gateEnabled                 Boolean  @default(false)
  thresholdCritical           Int      @default(3)
  thresholdMediumConfidence   Decimal  @default(0.70)
  autoApproveWithExplicitFlag Boolean  @default(true)
  concordanceEnsembleOnMalign Boolean  @default(true)
  visionVlmEnabled            Boolean  @default(true)
  pdfFinalVlmEnabled          Boolean  @default(false)
  agentsEnabled               Json
  updatedAt                   DateTime @updatedAt
  @@schema("mod_lab")
}
```

### 6.5 Modelos de evaluación

```prisma
enum AuditSource      { RANDOM_SAMPLING ESCALATION REPLAY FEEDBACK }
enum HumanJudgement   { AGENT_CORRECT AGENT_MISSED AGENT_FALSE_POSITIVE UNCERTAIN }

model LabValidationAuditRecord {
  id                 String   @id @default(uuid())
  tenantId           String
  validationId       String   @unique
  source             AuditSource
  sampledAt          DateTime @default(now())
  reviewerId         String?
  reviewedAt         DateTime?
  judgement          HumanJudgement?
  comments           String?
  missedFindingsRule String[]
  agreedFindingsRule String[]
  falsePositiveRule  String[]
  @@index([tenantId, source, sampledAt])
  @@index([reviewerId, reviewedAt])
  @@schema("mod_lab")
}

model LabValidationReplayRun {
  id              String   @id @default(uuid())
  tenantId        String
  name            String
  filterCriteria  Json
  totalCases      Int
  processedCases  Int      @default(0)
  detectedCases   Int      @default(0)
  status          String
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  @@schema("mod_lab")
}
```

### 6.6 Migración

**Una única migración V1** agregando todas las columnas nuevas (nullable para compatibilidad) + todas las tablas nuevas. Sin backfill inicial; las columnas nuevas se pueblan conforme el importador las lee en el próximo run.

**Triggers Postgres de defensa en profundidad** (mismo migration):
- `REVOKE UPDATE, DELETE ON audit_logs, approval_decisions FROM app_user`
- Trigger `BEFORE UPDATE OR DELETE ON approval_decisions, audit_logs → RAISE EXCEPTION`
- Trigger `BEFORE INSERT ON approval_decisions` que valida SoD (si grupo tiene `exclude_original_actor=true`, `decided_by_id != original_actor_id`).

---

## 7. Aprobaciones y alertas

### 7.1 Flujo de aprobación

Ver diagrama en §4.1 (rama "FAIL").

### 7.2 Segregación de funciones (SoD)

Enforced en 3 capas:

1. **DB:** `@@unique([requestId, decidedById])` en `ApprovalDecision`.
2. **Servicio:** `ApprovalService.decide()` valida membresía en grupo, valida `userId != request.originalActorId` si `group.excludeOriginalActor=true`, valida `request.status=PENDING`.
3. **Trigger Postgres:** `BEFORE INSERT ON approval_decisions RAISE EXCEPTION if decided_by_id = original_actor_id and group.exclude_original_actor`.

### 7.3 Destinatarios configurables

Resolución en cascada (vía `ApprovalAlertRecipient`):

| Scope | CRITICAL | NON_CRITICAL | Canales |
|---|---|---|---|
| `ORIGINAL_ACTOR` | ✓ | ✓ | IN_APP + EMAIL |
| `PERMISSION(lab-reports:validate)` | ✓ | ✓ | IN_APP + EMAIL |
| `PERMISSION(operations:manage)` | ✓ | — | IN_APP + EMAIL |
| `PERMISSION(tenant:manage)` | ✓ | — | EMAIL |
| `GROUP_MEMBER` | ✓ | ✓ | IN_APP + EMAIL |

### 7.4 Permisos nuevos

Agregar a `MODULE_DEFINITIONS`:
- `lab-reports:validate`
- `operations:manage`
- `approvals:decide`
- `approvals:configure-groups`

Seedear en todos los roles default con `AccessLevel` apropiado.

### 7.5 Payload del reporte adjunto a alerta

Estructura en `ApprovalRequest.snapshot: Json` (anonimizada parcialmente):

```typescript
{
  case: {
    reportId, fmInformeNumber, fmSource, category,
    patientRef: { id, initials, ageBucket },
    origin: { code, name, isSensitive },
    isUrgent, isAlteredOrCritical,
  },
  originalValidator: { userId, nameSnapshot, codeSnapshot, validatedAt },
  consolidatedVerdict: 'RED' | 'YELLOW',
  confidenceAvg: number,
  isCritical: boolean,
  isAcuteCritical: boolean,
  agentResults: Array<{
    agentKey, verdict, severity, confidence,
    findings: Array<{ ruleId, message, evidenceQuote, field, severity }>,
  }>,
  deepLink: string,
  pdfAttachmentKey?: string,
}
```

### 7.6 Throttling

- `NotificationService`: reutilizar `groupKey="approval:{requestId}"` con ventana 5min.
- Tabla nueva `EmailSendLog(tenantId, recipientId, type, sentAt)` — 1 email por recipient+type cada 10 min.

### 7.7 SLA y expiración

- Cron cada 15 min:
  - Marca `PENDING` con `expiresAt < now` como `EXPIRED`.
  - Dispara alerta al gerente general + tenantOwner.
  - Caso queda bloqueado; requiere nueva `ApprovalRequest` desde UI.
- Reminders: si `<24h` para expirar y destinatarios no han visto la notificación (vía `Presence`), re-envía alerta.

### 7.8 Auditoría inmutable

- Cada `ApprovalRequest` (create/update) y `ApprovalDecision` (insert) registra en `AuditLog` vía `AuditService.log()`.
- Triggers Postgres previenen UPDATE/DELETE sobre `audit_logs` y `approval_decisions`.

### 7.9 UI

- `/laboratory/validation` — bandeja (filtros status, reason, grupo, edad).
- `/laboratory/validation/[id]` — detalle con panel agent-by-agent, citas literales, botones aprobar/rechazar (textarea obligatorio).
- `/laboratory/settings/validation` — CRUD configurables (grupos, lexicón, procedencias sensibles, ruleset, recipients).

---

## 8. Sistema de evaluación

### 8.1 Telemetría en vivo

Dashboard `/laboratory/validation-metrics`:
- Por agente (7/30/90d): PASS/WARN/FAIL, confianza promedio, latencia p50/p95, costo/caso, severidad.
- Concordancia humano-agente (basado en `ApprovalDecision`).
- Calibración (reliability diagram).
- Tasa de FN desde `LabValidationAuditRecord` con `judgement=AGENT_MISSED`.
- Costo acumulado cross-cutting `AiUsageLog`.
- Cola aprobaciones + SLA.
- Drift alerts (rolling 7d vs 30d, 3σ).

### 8.2 Auditoría aleatoria (5% de PASS)

Cron diario selecciona 5% random de casos de ayer con `verdict=GREEN`, crea `LabValidationAuditRecord` con `source=RANDOM_SAMPLING`, notifica a rol patólogo jefe/QA. UI permite marcar `judgement`. Si `AGENT_MISSED` crítico → alerta inmediata.

### 8.3 Replay histórico

Endpoint `POST /lab/validation/replay` con filtros (rango fechas, `rejectedByCcb=true`, etc.). Crea `LabValidationReplayRun`, encola un job por caso. Cada job corre pipeline offline (`isReplay=true`, no dispara alertas). Dashboard muestra "de X casos rechazados por ustedes, detectamos Y%".

### 8.4 Golden set orgánico

Se construye automáticamente a partir de:
- `ApprovalDecision` — humano evaluó veredicto agente.
- `LabValidationAuditRecord` — humano revisó PASS.
- Casos del replay con concordancia.

Al mes 3 habrá ~100-200 casos naturalmente etiquetados. En V1.5 se activa regression CI sobre ellos.

---

## 9. Configurabilidad

### 9.1 Sembrado inicial V1

| Catálogo | Contenido inicial |
|---|---|
| `LabSensitiveOrigin` | 6 procedencias: HTSP, HTSCEM, FSC, Megasalud, Policenter, Hospital del Profesor |
| `LabCriticalityLexicon` | ~40 términos (malignidad, invasión, in situ, sospecha, infecciones críticas) + 10 patrones negación |
| `LabLateralityOrganRule` | ~40 órganos (obligatorios: mama, ovario, testículo, riñón, pulmón, etc.; no-aplica: útero, cérvix, recto, etc.) |
| `LabValidationRuleset` | Default con `gateEnabled=false` (se activa en F5), umbrales recomendados, todos los agentes activos excepto `pdfFinalVlmEnabled` |
| `ApprovalGroup` | "Críticos - Citolab" (min=2, slaHours=72, excludeOriginalActor=true), "No críticos - Calidad Citolab" (min=1, slaHours=48, excludeOriginalActor=true) |
| `ApprovalAlertRecipient` | 5 recipients default según matriz §7.3 |

### 9.2 Kill-switch operacional

- `LabValidationRuleset.gateEnabled` — controla si FAIL bloquea despacho.
- `LabValidationRuleset.agentsEnabled: Json` — desactivar agente individual sin apagar sistema.
- Cambios desde UI, accesibles a `OWNER` + permiso `approvals:configure-groups`.
- Toggle auditado.
- Si `gateEnabled=false`: sistema corre y registra, no bloquea. Permite degradar sin perder telemetría.

---

## 10. Roadmap de entrega

| Fase | Entregables | Tiempo Opus paralelo | Gate para avanzar |
|---|---|---|---|
| **F0 Fundaciones** | Migración Prisma + seed + transformers extendidos + cola BullMQ + rescate worktree | ~1 día | Importador poblando 50+ campos nuevos; controller responde trigger |
| **F1 Agentes determinísticos** | identity, origin, traceability + consolidador básico + persistencia | ~1 día | 3 agentes PASS en casos sintéticos |
| **F2 Agentes LLM** | sample, concordance, criticality + prompt library + test vs 15-20 casos reales | ~2-3 días | Concordance sens ≥0.95 en test; costo <USD 0.05/caso |
| **F3 Agentes evidencia** | pdf-final, vision-request, vision-encapsulation-macro + pipeline R2 | ~2 días | Vision detecta cruces inyectados; costo <USD 0.05/caso |
| **F4 Aprobaciones + alertas** | Módulo approvals/ + listener fan-out + UI bandeja/detalle + triggers DB | ~1.5 días | Happy path E2E en staging |
| **F5 Gate + FM write-back** | Script FM + endpoint can-dispatch + kill-switch operacional | ~0.5 día | Citolab valida flujo en caso real |
| **F6 Evaluación + dashboard** | /validation-metrics + auditoría aleatoria + replay + drift alerts | ~1 día | Dashboard live, primer replay corrido |
| **F7 Config UI** | /settings/validation CRUD | ~0.5 día | Citolab edita regla en vivo |

**Total:** 9-10 días calendario. Comprimible a 6-7 con paralelización F2||F3 y F6||F7.

### 10.1 Camino crítico al primer bloqueo real

Primer caso bloqueado en F5 (~día 7-8). Antes de eso, `gateEnabled=false`: los jobs corren y registran pero no bloquean. **7+ días de data real** antes del primer bloqueo efectivo; suficiente para calibrar prompts y umbrales.

### 10.2 Checklist pre-release (F5 → F6)

- [ ] Pipeline sin errores en últimos 100 casos reales
- [ ] Tiempo medio total p95 < 30s
- [ ] Tasa de error LLM < 1%
- [ ] Costo mensual estimado validado (<USD 500/mes)
- [ ] Script FM `Zeru_Validacion_Resultado` probado
- [ ] Kill-switch probado end-to-end
- [ ] Audit log inmutabilidad verificada (intento DELETE falla)
- [ ] SoD verificado (usuario no puede aprobar su propia validación)
- [ ] Permisos sembrados en todos los roles
- [ ] Email branding Citolab renderiza correctamente
- [ ] Documentación operativa para equipo Citolab
- [ ] Rollback plan documentado

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Falsos negativos en malignidad | Baja | Crítico | Ensemble cruzado concordance; auditoría aleatoria 5%; regla histórica 12m; política conservadora (preferir FP) |
| Falsos positivos masivos al activar gate | Media | Alto | `gateEnabled=false` hasta F5; 7+ días de data real antes de activar; kill-switch operacional |
| LLM hallucina hallazgos | Media | Alto | Grounding obligatorio (cada finding con `evidenceQuote` verificable); post-validación regex que cita exista literalmente |
| Drift de modelos OpenAI | Alta | Medio | Alertas drift 3σ; golden set orgánico acumulado |
| Costo excede presupuesto | Media | Medio | AiUsageLog cross-cutting; alert si costo diario >umbral; kill-switch por agente |
| Privacidad: PII sale de Chile | Alta | Medio | Blur de RUT/nombre antes de VLM; cláusulas DPA revisadas |
| Foto equivocada asociada al caso (doble error humano) | Media | Alto | V-02 detecta múltiples nº caso en misma foto; vision-request cruza RUT escaneado vs FM |
| Aprobador inactivo / vacaciones | Alta | Medio | Grupos con ≥2 miembros activos; V1.5: delegación temporal |
| Audit log modificado | Muy baja | Crítico | Triggers Postgres + revoke UPDATE/DELETE |
| FM no expone algún campo asumido | Baja | Medio | Discovery real ya ejecutado; gaps documentados en §3.2 |

---

## 12. Referencias

- POES-CCB2 v2 (Citolab, vigente 02-12-2022)
- Flujo "Paso a paso validación, caso sin revisión de patólogo" (14 pasos, Citolab)
- POES Citolab — 43 validaciones catalogadas (agente 1, ID: ada85ec00bfe2c917)
- Discovery FM — metadata + sample layouts `Validación Final*` y `INGRESO` (archivos `/tmp/fm-discovery/`)
- Reglas médicas de concordancia (agente 6, ID: a32b9edd2f4f38b79) — CAP, ASCO/CAP 2023 HER2, Bethesda, Milan, París, Yokohama
- Definición clínica de caso crítico (agente 7, ID: a6207f491b83d213a) — CAP/ADASP
- Framework concordance macro-histo-conclusión (agente 8, ID: a49ad4546a69ef883)
- Visión sobre fotos físicas (agente 9, ID: aedaf8a06a826edb7)
- Notificaciones, aprobaciones y RBAC (agente 10)
- Worktree `feature+fm-report-validation` (rebaseado sobre develop 2026-04-17, commit `1ae27d5`)
- `CLAUDE.md` (Zeru) — requisitos AI Cost Tracking
- Spec relacionado: `2026-04-03-filemaker-connector-design.md`
- Spec relacionado: `2026-04-09-biopsias-papanicolaou-import-design.md`

---

## Apéndice A — Inventario completo de campos FM a consumir (extensión de transformers)

### A.1 BIOPSIAS / BiopsyTransformer

**Root-level nuevos:**
`SEXO`, `FECHA NACIMIENTO`, `NºFOLIO`, `Nº ORDEN ATENCION`, `NUMERO IDENTIFICADOR INSTITUCION`, `COD. MEDICO`, `TIPO ENVASE`, `TACOS`, `CASSETTES DE INCLUSION`, `PLACAS HE`, `T.ESPECIALES`, `Total especiales`, `ANTICUERPOS`, `INMUNO NUMEROS`, `Total Inmunos`, `INMUNOS Estado Solicitud`, `INMUNOS Fecha Solicitud`, `INMUNOS Fecha Respuesta`, `INMUNOS Responsable Solicitud`, `INMUNOS Recibe Respuesta`, `AVISAR PACIENTE`, `RESULTADO CRITICO RESPONSABLE NOTIFICACION`, `FECHA NOTIFICACION CRITICO`, `HORA NOTIFICACION VALOR CRITICO`, `PDF Notificación Crítico`, `COMENTARIOS CCB`, `Rechazado por CCB`, `SECRETARIA INGRESO`, `Incongruencia RapidaDiferida`, `MOTIVO ATRASO`, `VALIDA`, `VALIDADO`, `Estado FTP`, `Estado Web`, `FECHA BLOQUEO`, `Responsable Bloqueo`, `DIAGNOSTICO MODIFICADO`, `Modifcado Por`, `Modifcado Por Fecha`, `Modifcado Por Hora`, `caso corregido por validacion`, `ext_paciente_id`, `numero_informe_base`.

**Related-field nuevos:**
`Biopsias::Rut Medico Solicitante`, `Biopsias_Ingresos::Scanner Documento` (→ `AttachmentCategory.REQUEST_DOCUMENT`), `SCANNER BP 8::DICTADO MACRO` (→ `MACRO_DICTATION`), `Procedencias::email_receptor_critico_BIOPSIA`, `Procedencias::email_receptor_critico_BP 1`, `Procedencias::EMAIL SOLICITUDES ANTECEDENTES 1`.

**Portales nuevos:**
- `Observaciones Tecnicas` → `LabTechnicalObservation`
- `portalEventosAdversos` → `LabAdverseEvent`
- `Placas` → `LabSlide` (incluye IHQ structured)
- `TÉCNICAS ESPECIALES` → catálogo estructurado en `LabSpecimen.specialTechniques`

### A.2 PAPANICOLAOU / PapTransformer

**Root-level nuevos:**
`EMAIL MEDICO`, `E MAIL PACIENTE`, `EMAIL INSTITUCION`, `FECHA NACIMIENTO`, `ANTECEDENTES CLINICOS`, `ANTECEDENTES CUELLO`, `ALERTA`, `Control de Calidad`, `LECTOR RESCREANING`, `FECHA REVISIÓN TM`, `FECHA SECRETARIA PRE VALIDA`, `FECHA SERCRETARIA VALIDA`, `FOLIO V.INTEGRA`, `Acusa Recibo`, `Acusa Recibo Fecha`, `Acusa Recibo hora`, `Acusa Recibo Medio`, `Acusa Recibo Responsable`, `Acusa Recibo Imagen`, `FECHA MAIL MEDICO`, `FECHA MAIL PACIENTE`, `FECHA ENVIO FTP`, `NOMBRE BONO`, `FONO`, `Hora toma de muestra`.

### A.3 SCANNER BIOPSIAS CITOLAB 2014 / nuevo transformer

**Layout `FOTOS ENCAPSULACION`:**
`FOTO 1..8`, `FOTO ENCAPSULACIÓN 1` → todas a `AttachmentCategory.ENCAPSULATION_PHOTO` con metadata `Trazabilidad::Fecha_Scanner`.

**Layouts `FOTO 1..4`:** fotos macro adicionales — mapear a `MACRO_PHOTO`.

---

**FIN DEL SPEC**
