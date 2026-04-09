# Importación y unificación de Biopsias y Papanicolaous — FileMaker → Zeru

**Fecha:** 2026-04-09
**Estado:** En revisión
**Autor:** Claude + Camilo
**Contexto:** Citolab opera su laboratorio de anatomía patológica y citología sobre FileMaker Server con múltiples bases de datos. Esta spec diseña la importación de los 4.2M de registros de exámenes (biopsias + paps) a un modelo FHIR unificado en Zeru, con sync bidireccional y UI de consulta + edición de cobranzas y macroscopía.

---

## 1. Problema

Citolab almacena 32 años de exámenes (1994–2026) en 4 bases de datos FileMaker:

| Base FM | Registros | Rango | Tabla principal |
|---|---|---|---|
| BIOPSIAS | 1,297,449 | 2000–2026 | `Tabla` |
| BIOPSIASRESPALDO | 1,197,879 | 1994–2026 | `Tabla` (copia parcial) |
| PAPANICOLAOU | 520,055 | ~2023–2026 | `PAPANICOLAOU` |
| PAPANICOLAOUHISTORICO | 2,302,139 | 1997–2023 | `PAPANICOLAOU` |
| **Total** | **~4.2M** | **1994–2026** | |

Problemas actuales:
1. FM no escala: BIOPSIASRESPALDO existe porque BIOPSIAS era "muy pesado".
2. Sin modelo normalizado: cada registro replica nombre/RUT del paciente (sin tabla Patient).
3. Sin búsqueda eficiente: no hay full-text search sobre diagnósticos.
4. Cobranzas manuales: ingresos de cobro se registran en FM sin automatización.
5. Macroscopía sin herramientas: la transcripción se hace directamente en FM sin apoyo de Zeru.

## 2. Decisiones de diseño

1. **Modelo FHIR completo:** Patient, Practitioner, ServiceRequest, Specimen, DiagnosticReport, Observation, Communication — con nomenclatura HL7 FHIR.
2. **Import de los 4.2M completos** (32 años de historia). No se descarta ninguna base.
3. **Bidireccional desde día 1**, acotado a cobranzas y macroscopía. El resto es read-only.
4. **Snapshots de paciente en ServiceRequest** (fidelidad histórica del documento médico-legal). Campos separados: `subjectFirstName`, `subjectPaternalLastName`, `subjectMaternalLastName`.
5. **Patient dedup por RUT estricto.** Sin RUT → Patient separado con `needsMerge: true`.
6. **Practitioner unificado** (patólogos + tecnólogos médicos + secretarias + médicos externos) con `roles[]`. No dos tablas separadas.
7. **Múltiples firmantes por informe** — tabla `DiagnosticReportSigner` many-to-many con `SigningRole` y snapshots.
8. **Workflow híbrido:** `DiagnosticReport.status` (high-level) + `ExamWorkflowEvent` tabla normalizada (historial completo).
9. **Todos los binarios a S3 de Zeru** — PDFs (via S3 Citolab), fotos/scans (via containers FM). Solo versión principal del PDF.
10. **Import por batches con BullMQ** — jobs de 100 registros, resilientes, idempotentes, pausables.
11. **Test mode:** filtro por fecha para importar solo un período acotado (marzo 2026 para pruebas).
12. **Schema PostgreSQL `mod_lab`** aislado del core.

## 3. Arquitectura

### 3.1 Estructura de código

```
apps/api/src/modules/
├── filemaker/                         (existente)
│   ├── transformers/
│   │   ├── biopsy.transformer.ts          ← NUEVO
│   │   ├── pap.transformer.ts             ← NUEVO
│   │   ├── exam-charge.transformer.ts     ← NUEVO
│   │   ├── liquidation.transformer.ts     ← NUEVO
│   │   ├── traceability.transformer.ts    ← NUEVO
│   │   └── communication.transformer.ts   ← NUEVO
│   └── services/
│       └── fm-lab-import.service.ts       ← NUEVO: pipeline de lab
│
└── lab/                               ← NUEVO MÓDULO
    ├── lab.module.ts
    ├── queues/
    │   ├── lab-import.queue.ts
    │   ├── attachment-migration.queue.ts
    │   └── processors/
    │       ├── practitioners-import.processor.ts
    │       ├── patients-batch.processor.ts
    │       ├── exams-batch.processor.ts
    │       ├── workflow-events-batch.processor.ts
    │       ├── communications-batch.processor.ts
    │       ├── exam-charges-batch.processor.ts
    │       ├── liquidations-batch.processor.ts
    │       └── attachment-download.processor.ts
    ├── services/
    │   ├── lab-import-orchestrator.service.ts
    │   ├── patient.service.ts
    │   ├── diagnostic-report.service.ts
    │   ├── exam-charge.service.ts
    │   └── attachment-migration.service.ts
    ├── controllers/
    │   ├── patient.controller.ts
    │   ├── diagnostic-report.controller.ts
    │   ├── exam-charge.controller.ts
    │   └── lab-import.controller.ts
    └── dto/
```

### 3.2 Schemas PostgreSQL

```
zeru (database)
├── public         ← core Zeru + billing catalogs existentes
│                    (LegalEntity, LabOrigin, BillingConcept, BillingAgreement, etc.)
├── mod_lab        ← NUEVO: módulo laboratorio (18 tablas)
└── citolab_fm     ← puente FM existente (FmSyncRecord, FmSyncLog)
```

Prisma datasource:
```prisma
schemas = ["public", "citolab_fm", "mod_lab"]
```

### 3.3 Colas BullMQ

- **Queue `lab-import`:** batches de import (concurrency: 3, retry: 5x exponential)
- **Queue `attachment-migration`:** descarga de binarios (concurrency: 10, rate: 50/s, retry: 10x)
- Redis: `redis://localhost:6380` (ya configurado)
- BullBoard en `/admin/queues` (protegido por permisos)

### 3.4 Flujo de datos

```
FM Data API → FmApiService → Transformer (fromFm) → BullMQ batch processor → Prisma → mod_lab
                                                                                   → S3 Zeru (attachments)
S3 Citolab (archivos-citolab-virginia) ──────────────────────────────────────────→ S3 Zeru (PDFs)
```

## 4. Modelo de datos (schema `mod_lab`)

### 4.1 Patient

```prisma
model Patient {
  id                String   @id @default(uuid())
  tenantId          String
  rut               String?
  firstName         String
  paternalLastName  String
  maternalLastName  String?
  birthDate         DateTime?
  gender            Gender?
  email             String?
  phone             String?
  address           String?
  commune           String?
  city              String?
  needsMerge        Boolean  @default(false)
  mergedIntoId      String?
  serviceRequests   ServiceRequest[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  @@unique([tenantId, rut])
  @@index([tenantId, paternalLastName, firstName])
  @@index([tenantId, needsMerge])
  @@schema("mod_lab")
}

enum Gender {
  MALE
  FEMALE
  OTHER
  UNKNOWN
  @@schema("mod_lab")
}
```

Dedup: por RUT cuando existe. Sin RUT → Patient separado con `needsMerge: true`. `mergedIntoId` para tombstone post-merge.

Nota sobre dedup BIOPSIAS / BIOPSIASRESPALDO: ambas bases pueden tener el mismo `INFORME Nº` para el mismo examen (RESPALDO es copia parcial de BIOPSIAS). La unique key `(tenantId, fmSource, fmInformeNumber)` los distingue por source. El pipeline importa BIOPSIAS primero como fuente primaria. Al importar BIOPSIASRESPALDO, si el `INFORME Nº` ya existe en BIOPSIAS, se crea un `FmSyncRecord` adicional para el vínculo pero NO se duplica el DiagnosticReport — solo se importan los informes cuyo número NO existe en BIOPSIAS (delta histórico pre-2000). El mismo patrón aplica para PAPANICOLAOU / PAPANICOLAOUHISTORICO.

### 4.2 Practitioner

```prisma
model Practitioner {
  id                String   @id @default(uuid())
  tenantId          String
  rut               String?
  firstName         String
  paternalLastName  String
  maternalLastName  String?
  roles             PractitionerRole[]
  isInternal        Boolean  @default(false)
  code              String?
  licenseNumber     String?
  specialty         String?
  email             String?
  phone             String?
  institutionId     String?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  @@unique([tenantId, rut])
  @@unique([tenantId, code])
  @@index([tenantId, paternalLastName, firstName])
  @@schema("mod_lab")
}

enum PractitionerRole {
  PATHOLOGIST
  MEDICAL_TECH
  CYTOTECHNOLOGIST
  REQUESTING_PHYSICIAN
  RECEPTION
  LAB_TECHNICIAN
  SECRETARY
  COURIER
  OTHER
  @@schema("mod_lab")
}
```

Match al importar: RUT → code → nombre normalizado.

### 4.3 ServiceRequest

```prisma
model ServiceRequest {
  id                        String        @id @default(uuid())
  tenantId                  String
  fmInformeNumber           Int
  fmSource                  FmSource
  subjectFirstName          String
  subjectPaternalLastName   String
  subjectMaternalLastName   String?
  subjectRut                String?
  subjectAge                Int?
  subjectId                 String?
  category                  ExamCategory
  subcategory               String?
  priority                  Priority      @default(ROUTINE)
  requestingPhysicianName   String?
  requestingPhysicianId     String?
  labOriginId               String
  labOriginCodeSnapshot     String
  sampleCollectedAt         DateTime?
  receivedAt                DateTime?
  requestedAt               DateTime?
  clinicalHistory           String?
  muestraDe                 String?
  specimens                 Specimen[]
  diagnosticReports         DiagnosticReport[]
  createdAt                 DateTime      @default(now())
  updatedAt                 DateTime      @updatedAt
  deletedAt                 DateTime?

  @@unique([tenantId, fmSource, fmInformeNumber])
  @@index([tenantId, labOriginId])
  @@index([tenantId, subjectId])
  @@index([tenantId, category, receivedAt])
  @@index([tenantId, subjectRut])
  @@schema("mod_lab")
}

enum FmSource {
  BIOPSIAS
  BIOPSIASRESPALDO
  PAPANICOLAOU
  PAPANICOLAOUHISTORICO
  @@schema("mod_lab")
}

enum ExamCategory {
  BIOPSY
  PAP
  CYTOLOGY
  IMMUNOHISTOCHEMISTRY
  MOLECULAR
  OTHER
  @@schema("mod_lab")
}

enum Priority {
  ROUTINE
  URGENT
  ASAP
  @@schema("mod_lab")
}
```

### 4.4 Specimen y Slide

```prisma
model Specimen {
  id                String          @id @default(uuid())
  tenantId          String
  serviceRequestId  String
  containerLabel    String?
  sequenceNumber    Int
  anatomicalSite    String?
  muestraDeText     String?
  collectedAt       DateTime?
  receivedAt        DateTime?
  status            SpecimenStatus  @default(RECEIVED)
  tacoCode          String?
  slides            Slide[]
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  deletedAt         DateTime?

  @@index([tenantId, serviceRequestId])
  @@schema("mod_lab")
}

model Slide {
  id          String   @id @default(uuid())
  tenantId    String
  specimenId  String
  placaCode   String?
  stain       String?
  level       Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId, specimenId])
  @@schema("mod_lab")
}

enum SpecimenStatus {
  RECEIVED
  PROCESSING
  EMBEDDED
  CUT
  STAINED
  ARCHIVED
  DISCARDED
  @@schema("mod_lab")
}
```

### 4.5 DiagnosticReport

```prisma
model DiagnosticReport {
  id                        String                    @id @default(uuid())
  tenantId                  String
  serviceRequestId          String
  fmInformeNumber           Int
  fmSource                  FmSource
  status                    DiagnosticReportStatus
  currentStageOwnerId       String?
  primarySignerId           String?
  primarySignerCodeSnapshot String?
  conclusion                String?                   @db.Text
  fullText                  String?                   @db.Text
  microscopicDescription    String?                   @db.Text
  macroscopicDescription    String?                   @db.Text
  clinicalComments          String?                   @db.Text
  isUrgent                  Boolean                   @default(false)
  isAlteredOrCritical       Boolean                   @default(false)
  criticalNotified          Boolean                   @default(false)
  validatedAt               DateTime?
  issuedAt                  DateTime?
  deliveredAt               DateTime?
  signers                   DiagnosticReportSigner[]
  observations              Observation[]
  workflowEvents            ExamWorkflowEvent[]
  communications            Communication[]
  adverseEvents             AdverseEvent[]
  technicalObservations     TechnicalObservation[]
  attachments               DiagnosticReportAttachment[]
  examCharges               ExamCharge[]
  createdAt                 DateTime                  @default(now())
  updatedAt                 DateTime                  @updatedAt
  deletedAt                 DateTime?

  @@unique([tenantId, fmSource, fmInformeNumber])
  @@index([tenantId, status])
  @@index([tenantId, validatedAt])
  @@index([tenantId, primarySignerId])
  @@index([tenantId, isUrgent, isAlteredOrCritical])
  @@schema("mod_lab")
}

enum DiagnosticReportStatus {
  REGISTERED
  IN_TRANSIT
  RECEIVED
  PROCESSING
  REPORTING
  PRE_VALIDATED
  VALIDATED
  SIGNED
  DELIVERED
  DOWNLOADED
  CANCELLED
  AMENDED
  @@schema("mod_lab")
}
```

### 4.6 DiagnosticReportSigner

Relación many-to-many: un informe puede tener múltiples firmantes con roles distintos.

```prisma
model DiagnosticReportSigner {
  id                    String      @id @default(uuid())
  tenantId              String
  diagnosticReportId    String
  practitionerId        String?
  codeSnapshot          String
  nameSnapshot          String
  roleSnapshot          String?
  role                  SigningRole
  signatureOrder        Int
  signedAt              DateTime
  isActive              Boolean     @default(true)
  supersededBy          String?
  correctionReason      String?
  notes                 String?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, practitionerId])
  @@index([tenantId, role])
  @@schema("mod_lab")
}

enum SigningRole {
  PRIMARY_PATHOLOGIST
  CO_PATHOLOGIST
  SUPERVISING_PATHOLOGIST
  EXTERNAL_CONSULTANT
  SCREENING_TECH
  SUPERVISING_TECH
  VISTO_BUENO_TECH
  VALIDATION_CORRECTION
  QC_REVIEWER
  OTHER
  @@schema("mod_lab")
}
```

Mapeo desde FM:

| Campo FM | → SigningRole |
|---|---|
| `PATOLOGO` | PRIMARY_PATHOLOGIST |
| `Revisado por patólogo supervisor` | SUPERVISING_PATHOLOGIST |
| `caso corregido por PAT SUP` | SUPERVISING_PATHOLOGIST (supersede) |
| `caso corregido por validacion` | VALIDATION_CORRECTION |
| `LECTOR SCREANING` (PAP) | SCREENING_TECH |
| `SUPERVISORA PAP` (PAP) | SUPERVISING_TECH |
| `VISTO BUENO` (PAP) | VISTO_BUENO_TECH |
| `APROBACION PATOLOGO WEB` (PAP) | PRIMARY_PATHOLOGIST |

### 4.7 Observation

```prisma
model Observation {
  id                    String              @id @default(uuid())
  tenantId              String
  diagnosticReportId    String
  code                  String
  codeSystem            String
  display               String
  category              ObservationCategory
  severity              String?
  interpretation        String?
  specimenId            String?
  notes                 String?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  deletedAt             DateTime?

  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, code])
  @@schema("mod_lab")
}

enum ObservationCategory {
  DIAGNOSIS
  DIFFERENTIAL
  FINDING
  MARKER
  RECOMMENDATION
  @@schema("mod_lab")
}
```

### 4.8 ExamWorkflowEvent

```prisma
model ExamWorkflowEvent {
  id                        String            @id @default(uuid())
  tenantId                  String
  diagnosticReportId        String
  eventType                 WorkflowEventType
  sequenceOrder             Int?
  occurredAt                DateTime
  performedById             String?
  performedByNameSnapshot   String
  location                  String?
  notes                     String?
  sourceField               String
  createdAt                 DateTime          @default(now())

  @@index([tenantId, diagnosticReportId, occurredAt])
  @@index([tenantId, eventType, occurredAt])
  @@schema("mod_lab")
}

enum WorkflowEventType {
  ORIGIN_INTAKE
  ORIGIN_HANDOFF_TO_COURIER
  TRANSPORT
  RECEIVED_AT_LAB
  MACROSCOPY
  EMBEDDING
  CUTTING_STAINING
  HISTOLOGY_REPORTING
  VALIDATION
  APPROVAL
  DELIVERY
  INTAKE
  PROCESSING
  DIAGNOSIS_TRANSCRIPTION
  PRE_VALIDATION
  SECRETARY_VALIDATION
  PATHOLOGIST_APPROVAL_WEB
  WEB_VALIDATION
  PDF_GENERATED
  WEB_DELIVERY
  WEB_TRANSPORT
  WEB_RECEPTION
  WEB_EXAM_CYTOLOGY
  WEB_DOWNLOAD
  WEB_ACKNOWLEDGMENT
  CLIENT_NOTIFIED
  CASE_CORRECTION
  AMENDMENT
  CRITICAL_NOTIFICATION
  OTHER
  @@schema("mod_lab")
}
```

Volumen estimado: ~33M filas (4.2M informes × ~8 eventos promedio).

### 4.9 Communication

```prisma
model Communication {
  id                      String                @id @default(uuid())
  tenantId                String
  diagnosticReportId      String
  subjectPatientId        String?
  reason                  String?
  content                 String                @db.Text
  response                String?               @db.Text
  loggedAt                DateTime
  loggedById              String?
  loggedByNameSnapshot    String
  respondedAt             DateTime?
  respondedById           String?
  respondedByNameSnapshot String?
  category                CommunicationCategory?
  createdAt               DateTime              @default(now())
  updatedAt               DateTime              @updatedAt
  deletedAt               DateTime?

  @@index([tenantId, diagnosticReportId, loggedAt])
  @@index([tenantId, category])
  @@schema("mod_lab")
}

enum CommunicationCategory {
  SAMPLE_QUALITY_ISSUE
  ADDITIONAL_INFO_REQUEST
  INTERNAL_QC
  CRITICAL_RESULT
  CLIENT_INQUIRY
  CORRECTION_REQUEST
  OTHER
  @@schema("mod_lab")
}
```

Fuentes FM: portal `COMUNICACIONES` en biopsias (Validación Final*), tabla `COMUNICACIONES` en PAP (~1,978 registros).

### 4.10 AdverseEvent

```prisma
model AdverseEvent {
  id                      String          @id @default(uuid())
  tenantId                String
  diagnosticReportId      String?
  eventType               String
  severity                AdverseSeverity
  description             String          @db.Text
  occurredAt              DateTime
  detectedAt              DateTime?
  reportedAt              DateTime?
  reportedByNameSnapshot  String
  reportedById            String?
  correctiveAction        String?         @db.Text
  resolvedAt              DateTime?
  resolvedById            String?
  status                  AdverseStatus   @default(OPEN)
  createdAt               DateTime        @default(now())
  updatedAt               DateTime        @updatedAt
  deletedAt               DateTime?

  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, severity, status])
  @@schema("mod_lab")
}

enum AdverseSeverity { MINOR MODERATE MAJOR CRITICAL @@schema("mod_lab") }
enum AdverseStatus { OPEN INVESTIGATING RESOLVED CLOSED @@schema("mod_lab") }
```

### 4.11 TechnicalObservation

```prisma
model TechnicalObservation {
  id                      String             @id @default(uuid())
  tenantId                String
  diagnosticReportId      String
  workflowStage           WorkflowEventType?
  description             String             @db.Text
  observedAt              DateTime
  observedByNameSnapshot  String
  observedById            String?
  createdAt               DateTime           @default(now())

  @@index([tenantId, diagnosticReportId])
  @@schema("mod_lab")
}
```

### 4.12 DiagnosticReportAttachment

```prisma
model DiagnosticReportAttachment {
  id                        String                      @id @default(uuid())
  tenantId                  String
  diagnosticReportId        String
  category                  AttachmentCategory
  label                     String?
  sequenceOrder             Int?
  s3Bucket                  String
  s3Key                     String
  contentType               String
  sizeBytes                 Int?
  checksum                  String?
  fmSourceField             String
  fmContainerUrlOriginal    String?
  citolabS3KeyOriginal      String?
  migrationStatus           AttachmentMigrationStatus   @default(PENDING)
  migrationError            String?
  migrationAttempts         Int                         @default(0)
  migratedAt                DateTime?
  adverseEventId            String?
  createdAt                 DateTime                    @default(now())
  updatedAt                 DateTime                    @updatedAt

  @@index([tenantId, diagnosticReportId])
  @@index([migrationStatus])
  @@schema("mod_lab")
}

enum AttachmentCategory {
  REPORT_PDF
  CRITICAL_NOTIFICATION_PDF
  MACRO_PHOTO
  MICRO_PHOTO
  ENCAPSULATION_PHOTO
  MACRO_DICTATION
  DIAGNOSIS_MODIFICATION
  SCANNER_CARTON
  REQUEST_DOCUMENT
  MOLECULAR_CONTAINER
  ADVERSE_EVENT_PHOTO
  OTHER
  @@schema("mod_lab")
}

enum AttachmentMigrationStatus {
  PENDING
  DOWNLOADING
  UPLOADED
  FAILED
  SKIPPED
  @@schema("mod_lab")
}
```

PDFs determinísticos en S3 Citolab:
- Biopsias: `Biopsias/{procedencia}/{year(fecha)}/{month(fecha)}/{numero_informe}.pdf`
- PAP: `Papanicolaous/{procedencia}/{year(fecha)}/{month(fecha)}/{numero_informe}.pdf`
- Bucket: `archivos-citolab-virginia` (us-east-1)
- Solo versión principal del PDF (no AEN ni sin-cabecera)

Fotos/scans: descarga desde containers FM via Streaming_SSL URLs.

Todo se copia a S3 de Zeru durante la migración de attachments.

## 5. Cobranza

### 5.1 ExamCharge

```prisma
model ExamCharge {
  id                      String             @id @default(uuid())
  tenantId                String
  fmSource                ExamChargeSource
  fmRecordPk              Int
  diagnosticReportId      String
  billingConceptId        String?
  feeCodesText            String?
  feeCodes                String[]
  paymentMethod           PaymentMethod
  amount                  Decimal            @db.Decimal(14, 4)
  currency                String             @default("CLP")
  status                  ChargeStatus
  labOriginId             String
  labOriginCodeSnapshot   String
  legalEntityId           String?
  liquidationId           String?
  directPaymentBatchId    String?
  enteredAt               DateTime
  enteredByNameSnapshot   String
  enteredById             String?
  pointOfEntry            String?
  validatedAt             DateTime?
  validatedByNameSnapshot String?
  validatedById           String?
  cancelledAt             DateTime?
  cancelledByNameSnapshot String?
  cancelReason            String?
  notes                   String?
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt
  deletedAt               DateTime?

  @@unique([tenantId, fmSource, fmRecordPk])
  @@index([tenantId, diagnosticReportId])
  @@index([tenantId, liquidationId])
  @@index([tenantId, directPaymentBatchId])
  @@index([tenantId, status])
  @@index([tenantId, labOriginId, enteredAt])
  @@index([tenantId, legalEntityId, enteredAt])
  @@schema("mod_lab")
}

enum ExamChargeSource { BIOPSIAS_INGRESOS PAP_INGRESOS @@schema("mod_lab") }

enum PaymentMethod {
  CASH BANK_TRANSFER CHECK VOUCHER CREDIT_CARD DEBIT_CARD AGREEMENT PENDING_PAYMENT OTHER
  @@schema("mod_lab")
}

enum ChargeStatus {
  REGISTERED VALIDATED INVOICED PAID CANCELLED REVERSED
  @@schema("mod_lab")
}
```

Fuentes FM: `Biopsias_Ingresos` (140,068 registros), `PAP_ingresos` (174,610 registros).

Nota: `Tipo de Ingreso` en FM es **modo de pago** (11 valores: Efectivo, Bono, Cheque, Convenio, Transferencia...), NO concepto de cobro. Los conceptos son `BillingConcept` (CDC).

### 5.2 Liquidation

```prisma
model Liquidation {
  id                      String            @id @default(uuid())
  tenantId                String
  fmRecordId              String
  fmPk                    Int?
  legalEntityId           String
  billingAgreementId      String?
  period                  DateTime
  periodLabel             String
  totalAmount             Decimal           @db.Decimal(14, 2)
  biopsyAmount            Decimal           @db.Decimal(14, 2)
  papAmount               Decimal           @db.Decimal(14, 2)
  cytologyAmount          Decimal           @db.Decimal(14, 2)
  immunoAmount            Decimal           @db.Decimal(14, 2)
  biopsyCount             Int
  papCount                Int
  cytologyCount           Int
  immunoCount             Int
  previousDebt            Decimal           @db.Decimal(14, 2) @default(0)
  creditBalance           Decimal           @db.Decimal(14, 2) @default(0)
  status                  LiquidationStatus
  confirmedAt             DateTime?
  confirmedByNameSnapshot String?
  invoiceNumber           String?
  invoiceType             String?
  invoiceDate             DateTime?
  paymentAmount           Decimal?          @db.Decimal(14, 2)
  paymentDate             DateTime?
  paymentMethodText       String?
  liquidationPdfKey       String?
  invoicePdfKey           String?
  notes                   String?
  charges                 ExamCharge[]
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt
  deletedAt               DateTime?

  @@unique([tenantId, fmRecordId])
  @@index([tenantId, legalEntityId, period])
  @@index([tenantId, status])
  @@index([tenantId, period])
  @@schema("mod_lab")
}

enum LiquidationStatus {
  DRAFT CONFIRMED INVOICED PARTIALLY_PAID PAID OVERDUE CANCELLED
  @@schema("mod_lab")
}
```

Fuente FM: `Liquidaciones` (2,643 registros).

### 5.3 DirectPaymentBatch

```prisma
model DirectPaymentBatch {
  id                      String              @id @default(uuid())
  tenantId                String
  fmRecordId              String?
  fmPk                    Int?
  period                  DateTime
  periodFrom              DateTime?
  periodTo                DateTime?
  legalEntityId           String?
  rendicionType           RendicionType
  totalAmount             Decimal             @db.Decimal(14, 2)
  chargeCount             Int
  rendidoByNameSnapshot   String?
  rendidoById             String?
  rendidoAt               DateTime?
  status                  DirectPaymentStatus
  receiptNumber           String?
  receiptDate             DateTime?
  receiptPdfKey           String?
  notes                   String?
  charges                 ExamCharge[]
  createdAt               DateTime            @default(now())
  updatedAt               DateTime            @updatedAt
  deletedAt               DateTime?

  @@unique([tenantId, fmRecordId])
  @@index([tenantId, period, rendicionType])
  @@index([tenantId, legalEntityId])
  @@schema("mod_lab")
}

enum RendicionType { BIOPSY_DIRECT PAP_DIRECT MIXED @@schema("mod_lab") }
enum DirectPaymentStatus { OPEN RENDIDA RECONCILED CANCELLED @@schema("mod_lab") }
```

## 6. Transformers — layouts FM y mapeo

| Transformer | FM Database(s) | Layout(s) | Registros |
|---|---|---|---|
| `BiopsyTransformer` | BIOPSIAS, BIOPSIASRESPALDO | `Validación Final*` (236 campos, 8 portales) | ~1.4M |
| `PapTransformer` | PAPANICOLAOU, PAPANICOLAOUHISTORICO | `INGRESO` (135 campos, 4 portales) | ~2.8M |
| `TraceabilityTransformer` | BIOPSIAS, BIOPSIASRESPALDO | `TRAZA` (29 campos) | ~1.4M |
| `CommunicationTransformer` | BIOPSIAS (portal), PAPANICOLAOU (tabla) | `COMUNICACIONES` | ~15k |
| `ExamChargeTransformer` | BIOPSIAS | `Biopsias_Ingresos*` + `PAP_ingresos*` | ~315k |
| `LiquidationTransformer` | BIOPSIAS | `Liquidaciones` | ~2.6k |

Ambos `BiopsyTransformer` y `PapTransformer` producen un DTO `ExtractedExam` unificado. Después del transformer, el pipeline trata biopsias y paps idénticamente.

Campos clave mapeados:

| Campo FM (Biopsias) | Campo FM (PAP) | → Zeru |
|---|---|---|
| `NOMBRE` | `NOMBRES` | `ServiceRequest.subjectFirstName` |
| `A.PATERNO` | `A.PATERNO` | `ServiceRequest.subjectPaternalLastName` |
| `A.MATERNO` | `A.MATERNO` | `ServiceRequest.subjectMaternalLastName` |
| `RUT` | `RUT` | `ServiceRequest.subjectRut` + `Patient.rut` |
| `TIPO DE EXAMEN` | `EXAMEN` | `ServiceRequest.category` |
| `SUBTIPO EXAMEN` | — | `ServiceRequest.subcategory` |
| `SOLICITADA POR` | `SOLICITADO POR` | `ServiceRequest.requestingPhysicianName` |
| `PROCEDENCIA CODIGO UNICO` | `CODIGO UNICO PROCEDENCIA` | `ServiceRequest.labOriginCodeSnapshot` |
| `MUESTRA DE` | `MUESTRA DE` | `ServiceRequest.muestraDe` |
| `DIAGNOSTICO` | — | `DiagnosticReport.conclusion` |
| `TEXTO BIOPSIAS::TEXTO` | `PAP TEXTO::TEXTO` | `DiagnosticReport.fullText` |
| `PATOLOGO` | — | `DiagnosticReportSigner (PRIMARY_PATHOLOGIST)` |
| — | `LECTOR SCREANING` | `DiagnosticReportSigner (SCREENING_TECH)` |
| — | `SUPERVISORA PAP` | `DiagnosticReportSigner (SUPERVISING_TECH)` |
| `FECHA VALIDACIÓN` | `FECHA` | `DiagnosticReport.validatedAt` |
| `URGENTES` | — | `DiagnosticReport.isUrgent` |
| `Alterado o Crítico` | — | `DiagnosticReport.isAlteredOrCritical` |

## 7. Pipeline de import (BullMQ)

### 7.1 Fases

```
Fase 0: Catálogos (Practitioners, PaymentTypes)         — 1 job
Fase 1: Exámenes (ServiceRequest + Specimen + DR + Signers + AttachmentRefs) — N batches de 100
Fase 2: Workflow events + Communications + Adverse events — N batches
Fase 3: Liquidations + DirectPaymentBatches              — pocos jobs
Fase 4: ExamCharges (linkea con DR + Liquidation/DPB)    — N batches
Fase 5: Attachment migration (queue separada, paralela)   — M jobs (1 por attachment)
```

### 7.2 Orquestador

```typescript
POST /lab/import/start {
  sources: ['BIOPSIAS', 'PAPANICOLAOU', ...],
  dateFrom?: '2026-03-01',  // filtro test mode
  dateTo?: '2026-03-31',
  batchSize?: 100,
}
```

### 7.3 Tracking

Tablas `LabImportRun` y `LabImportBatch` en `mod_lab` para progreso, errores, timing. Dashboard API: `GET /lab/import/runs/:id/status`.

### 7.4 Modo test — marzo 2026

Filtro por `FECHA VALIDACIÓN ∈ [2026-03-01, 2026-03-31]`. Datos relacionados (charges, liquidaciones, workflow) se importan solo para los informes del scope. Estimación: ~10k registros, ~30-60 minutos.

### 7.5 Propiedades del pipeline

- **Idempotente:** cada batch hace upsert por `(fmSource, fmInformeNumber)`.
- **Resiliente:** un registro fallido no detiene el batch; queda logueado.
- **Pausable/cancelable:** via BullMQ queue pause/resume.
- **Observable:** progreso en DB + BullBoard + endpoint API.
- **Rate-limited:** attachments a 50 req/s contra FM.

## 8. Sync bidireccional

### 8.1 Principio

Event-driven, async, non-blocking. La UX nunca espera a FM.

### 8.2 Scope de write-back v1

**Módulo cobranzas (CRUD completo):**
- `ExamCharge`: crear, editar, cancelar, asignar a liquidación → escribe a `Biopsias_Ingresos*` / `PAP_ingresos*`
- `Liquidation`: crear, confirmar, facturar, registrar pago → escribe a `Liquidaciones`
- `DirectPaymentBatch`: crear, cerrar → escribe a rendiciones

**Módulo macroscopía (edición parcial):**
- `DiagnosticReport.macroscopicDescription` → escribe a `TEXTO*` / `MACRO*`
- `ExamWorkflowEvent` tipo MACROSCOPY → escribe a `Trazabilidad::Responsable_Macroscopía` + `Fecha_Macroscopía`
- `DiagnosticReportSigner` (patólogo macro + ayudante) → escribe a `Ingreso Trazabilidad Macroscopía*`
- Fotos macro (attachments) → upload a containers FM

**Explícitamente NO editable en v1:** diagnóstico final, validación/firma, datos del paciente, datos del specimen, comunicaciones.

### 8.3 Conflictos

Last-write-wins con detección. Cuando el `modId` de FM difiere del esperado → se loguea el conflicto en `FmSyncLog`, Zeru gana. UI de resolución de conflictos en v2.

### 8.4 Webhook FM → Zeru

Endpoint existente: `POST /filemaker/webhook`. Scripts `OnRecordCommit` a configurar en FM para tablas: `Tabla` (biopsias), `PAPANICOLAOU`, `COMUNICACIONES`, `Trazabilidad`.

## 9. Error handling, testing, observabilidad

### 9.1 Errores

- FM API (401/5xx/timeout): retry 3x exponential → batch FAILED → DLQ.
- Transformer (parsing): skip registro + log → batch continúa.
- DB (unique violation): upsert (idempotencia). FK missing: FK null + flag.
- S3 (download/upload): 10 reintentos → `migrationStatus=FAILED`.

### 9.2 Testing

- **Unit:** Transformers con mock `FmRecord` (máxima prioridad). Datos sucios, RUTs vacíos, múltiples firmantes.
- **Integration:** batch processors con PostgreSQL + Redis reales, FM mock.
- **E2E:** import marzo 2026 contra FM real (CI flag `FM_E2E_TEST=true`).

### 9.3 Observabilidad

- Logs estructurados (NestJS Logger).
- Dashboard progreso: `GET /lab/import/runs/:id/status`.
- BullBoard en `/admin/queues`.

## 10. Performance (4.2M registros)

| Tabla | Filas est. | Index clave |
|---|---|---|
| DiagnosticReport | 4.2M | `(tenantId, fmSource, fmInformeNumber)`, `(tenantId, status)`, `(tenantId, validatedAt)` |
| ExamWorkflowEvent | 33M | `(tenantId, diagnosticReportId, occurredAt)` — considerar partición por año |
| DiagnosticReportAttachment | 20M+ | `(tenantId, diagnosticReportId)`, `(migrationStatus)` |
| Observation | 10M+ | `(tenantId, diagnosticReportId)`, `(tenantId, code)` |

Full-text search en español:
```sql
CREATE INDEX idx_diagnostic_report_fulltext
  ON mod_lab."DiagnosticReport"
  USING GIN (to_tsvector('spanish', coalesce("fullText", '') || ' ' || coalesce("conclusion", '')));
```

## 11. Rollout

```
Fase 0: Preparación
├── Rotar credenciales AWS (P0 seguridad)
├── Crear schema mod_lab + migration Prisma
├── Deploy transformers + processors
└── Tests unitarios + integration green

Fase 1: Test marzo 2026
├── Import ~10k registros acotados a marzo 2026
├── Verificar dedup, signers, charges, PDFs en S3
├── UI consulta functional
└── Sign-off usuario → go/no-go

Fase 2: Import histórico completo
├── Import full ~4.2M (estimación: 1-3 días)
├── Attachment migration en background (días/semanas)
└── Verificar totales vs FM

Fase 3: Activar sync bidireccional
├── Webhooks FM configurados
├── Write-back cobranzas + macroscopía activo
└── Testing cruzado FM ↔ Zeru

Fase 4: Go-live UI
├── UI cobranzas operational
├── UI macroscopía operational
└── Usuarios Citolab empiezan a usar Zeru
```

## 12. Seguridad

| # | Acción | Prioridad |
|---|---|---|
| 1 | Rotar credenciales AWS Citolab (expuestas en conversación) | **P0** |
| 2 | IAM policy estricta: solo `s3:GetObject` + `s3:PutObject` sobre paths específicos | P1 |
| 3 | Endpoints import protegidos por `@RequirePermission('lab', 'admin')` | P1 |
| 4 | BullBoard protegido por `@RequirePermission('settings', 'manage')` | P1 |
| 5 | Rate limiting FM API: max 50 req/s | P1 |
| 6 | Audit log via `FmSyncLog` existente | P2 |

## 13. Fuera de alcance (v2+)

- Diagnóstico final editable en Zeru (patólogos migran gradualmente)
- UI de merge de pacientes duplicados (`needsMerge`)
- UI de resolución de conflictos de sync
- Comunicaciones editables desde Zeru
- Informes PDF generados por Zeru (reemplazar FM para generación)
- Dashboards de estadísticas por patólogo/procedencia/período
- Integración con SNOMED-CT / ICD-O-3 para codificación de diagnósticos
- Reimplementación de scripts FM (generación de liquidaciones, etc.)
