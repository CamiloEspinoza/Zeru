# DTE/SII Integration — Master Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full electronic invoicing integration with Chile's SII: emit, receive, void, correct, account, and certify DTEs.

**Architecture:** Fork `@devlas/dte-sii` as DTE engine. Wrap in NestJS services with Prisma persistence, BullMQ async processing, Redis token cache, Puppeteer for PDF/certification. Event-driven accounting integration. IMAP polling for received DTEs.

**Tech Stack:** NestJS, Prisma (PostgreSQL), BullMQ, Redis, `@devlas/dte-sii` fork, Puppeteer, bwip-js, imapflow, cockatiel, Handlebars, Jest

**Sub-plans (execute in order):**

| Sub-plan | Scope | File |
|----------|-------|------|
| **Plan A** | Schema + Infrastructure | `plan-a-schema-infrastructure.md` |
| **Plan B** | Core Emission (corrected) | `plan-b-core-emission.md` |
| **Plan C** | Void, Correct, Draft flows | `plan-c-void-correct-draft.md` |
| **Plan D** | PDF Generation | `plan-d-pdf-generation.md` |
| **Plan E** | Received DTEs + Exchange | `plan-e-received-exchange.md` |
| **Plan F** | Accounting Integration | `plan-f-accounting.md` |
| **Plan G** | Boletas + RCOF | `plan-g-boletas-rcof.md` |
| **Plan H** | Frontend UI | `plan-h-frontend.md` |
| **Plan I** | SII Certification | `plan-i-certification.md` |
| **Plan J** | Security Hardening | `plan-j-security.md` |

**Reference:** `docs/2026-04-12-dte-sii-research.md` — full technical research

---

## Critical Corrections from Review (10 agents)

These issues from Plan v1 MUST be fixed:

### Blocker fixes
1. **Folio assignment**: Assign folio BEFORE enqueueing (not in processor). Folio=0 violates unique constraint with multiple DRAFTs.
2. **Permissions**: ALL controllers must use `@RequirePermission()`. Plan v1 had zero permission checks.
3. **Tenant isolation**: ALL processors must use `prisma.forTenant(tenantId)`, never raw PrismaClient.
4. **CAF tenant filter**: `getDecryptedCaf()` must filter by tenantId.
5. **Encryption fallback**: Throw on missing `ENCRYPTION_KEY`, never fallback to empty string.
6. **DteReference model**: Required for NC/ND — was missing from schema entirely.

### Architecture corrections
7. **Processor idempotency**: Check DTE status at start — skip already-processed steps.
8. **Circuit breaker**: Mandatory in Plan A, not deferred. Use cockatiel.
9. **Single token cache**: Use @devlas/dte-sii's internal cache only. Remove custom Redis SiiAuthService (it conflicts).
10. **State machine**: Validate transitions with optimistic locking (`WHERE status = expectedStatus`).
11. **Receptor autocomplete**: New service wrapping `ce_consulta_rut` (mTLS scraping).
12. **Notifications**: Connect `dte.accepted`/`dte.rejected`/`dte.failed` events to NotificationService.
13. **DTEs recibidos**: Use SAME `Dte` model with `direction` field (EMITTED/RECEIVED), plus `emisorRut`/`emisorRazon`.
14. **Unique constraint**: Change to `@@unique([tenantId, dteType, folio, emisorRut])` — two emitters can have same tipo+folio.
15. **Receptor optional**: `receptorRut`/`receptorRazon` must be optional for boletas (consumidor final).
16. **RCOF**: Must be implemented as soon as boletas are enabled — mandatory daily report.

---

## Corrected File Structure

```
apps/api/src/modules/dte/
├── dte.module.ts
├── constants/
│   ├── dte-types.constants.ts
│   ├── sii-endpoints.constants.ts
│   ├── queue.constants.ts
│   └── state-machine.constants.ts          # NEW: valid state transitions
├── controllers/
│   ├── dte.controller.ts                    # Emit, list, get, download
│   ├── dte-draft.controller.ts             # NEW: CRUD drafts
│   ├── dte-void.controller.ts              # NEW: Void, correct, reissue
│   ├── dte-received.controller.ts          # NEW: Received DTEs bandeja
│   ├── dte-config.controller.ts
│   ├── certificate.controller.ts
│   ├── folio.controller.ts
│   ├── dte-reports.controller.ts           # NEW: Books, RCOF, IVA summary
│   └── dte-public.controller.ts            # NEW: Public link for clients
├── services/
│   ├── dte-emission.service.ts              # Orchestrator: validate → assign folio → queue
│   ├── dte-builder.service.ts               # Wraps @devlas/dte-sii DTE class
│   ├── dte-config.service.ts
│   ├── dte.service.ts                       # CRUD Dte records
│   ├── dte-draft.service.ts                # NEW: Draft CRUD before emission
│   ├── dte-void.service.ts                 # NEW: Void (NC CodRef=1), correct (2,3)
│   ├── dte-state-machine.service.ts        # NEW: Validate transitions with optimistic lock
│   ├── dte-pdf.service.ts                  # NEW: Puppeteer HTML→PDF + PDF417
│   ├── dte-received.service.ts             # NEW: Process received DTEs
│   ├── dte-reports.service.ts              # NEW: Books, RCOF, IVA
│   └── receptor-lookup.service.ts          # NEW: ce_consulta_rut + LegalEntity cache
├── sii/
│   ├── sii-sender.service.ts               # Wraps EnviadorSII (uses its internal token cache)
│   ├── sii-status.service.ts
│   ├── sii-portal.service.ts              # NEW: mTLS scraping (ce_consulta_rut, folios)
│   ├── sii-reclamo.service.ts             # NEW: WS RegistroReclamoDTE
│   └── sii-circuit-breaker.service.ts     # NEW: cockatiel wrapper (mandatory)
├── certificate/
│   ├── certificate.service.ts
│   └── certificate-parser.service.ts
├── folio/
│   ├── folio.service.ts
│   └── folio-allocation.service.ts
├── exchange/
│   ├── exchange.service.ts                 # NEW: Send DTE to receptor via email
│   ├── exchange-response.service.ts        # NEW: Generate RecepcionDTE/ResultadoDTE/EnvioRecibos
│   └── imap-polling.service.ts            # NEW: Poll exchange email for received DTEs
├── processors/
│   ├── dte-emission.processor.ts            # Idempotent: checks status before each step
│   ├── sii-status-check.processor.ts
│   ├── dte-exchange.processor.ts           # NEW: Send to receptor after SIGNED (not after SII accepts)
│   ├── dte-received.processor.ts           # NEW: Parse + validate received XML
│   └── rcof.processor.ts                  # NEW: Daily RCOF generation + send
├── listeners/
│   ├── dte-notification.listener.ts        # NEW: dte.signed/accepted/rejected/failed → notify user
│   ├── dte-accounting.listener.ts          # NEW: dte.signed → journal entry (DRAFT), dte.rejected → reverse
│   └── dte-exchange.listener.ts           # NEW: dte.signed → queue send to receptor (SII-independent)
├── templates/
│   ├── factura.hbs                         # NEW: PDF template for facturas/NC/ND
│   ├── boleta.hbs                          # NEW: PDF template for boletas
│   ├── guia-despacho.hbs                  # NEW: PDF template for guías
│   ├── boleta-thermal.hbs                 # NEW: 80mm thermal receipt
│   └── partials/
│       ├── header.hbs                     # Logo + emisor + recuadro rojo
│       ├── detalle.hbs                    # Items table
│       ├── totales.hbs                    # Neto/IVA/Total
│       ├── timbre.hbs                     # PDF417 + leyenda SII
│       └── acuse-recibo.hbs              # Ley 19.983 zone
├── dto/
│   └── index.ts
└── cron/
    ├── rcof.cron.ts                       # NEW: Daily 23:00 RCOF generation
    ├── deadline.cron.ts                   # NEW: Daily 08:00 tacit acceptance + alerts
    ├── certificate-expiry.cron.ts         # NEW: Daily check for expiring certs
    └── orphan-recovery.cron.ts            # NEW: Every 15min recover SIGNED orphans

apps/api/src/modules/browser/               # NEW: Shared Puppeteer pool
├── browser.module.ts
└── browser-pool.service.ts

packages/shared/src/
├── schemas/dte.schema.ts                   # Zod schemas (corrected)
└── permissions/module-definitions.ts       # Add missing permissions
```

---

## Corrected Prisma Schema (complete)

### Enums

```prisma
enum DteType {
  FACTURA_ELECTRONICA
  FACTURA_EXENTA_ELECTRONICA
  BOLETA_ELECTRONICA
  BOLETA_EXENTA_ELECTRONICA
  LIQUIDACION_FACTURA_ELECTRONICA
  FACTURA_COMPRA_ELECTRONICA
  GUIA_DESPACHO_ELECTRONICA
  NOTA_DEBITO_ELECTRONICA
  NOTA_CREDITO_ELECTRONICA
  @@schema("public")
}

enum DteStatus {
  DRAFT
  QUEUED
  SIGNED
  SENT
  ACCEPTED
  ACCEPTED_WITH_OBJECTION
  REJECTED
  VOIDED
  ERROR
  @@schema("public")
}

enum DteEnvironment {
  CERTIFICATION
  PRODUCTION
  @@schema("public")
}

enum DteDirection {
  EMITTED
  RECEIVED
  @@schema("public")
}

enum DteLogAction {
  CREATED
  QUEUED
  FOLIO_ASSIGNED
  SIGNED
  SENT_TO_SII
  SII_RESPONSE
  ACCEPTED
  REJECTED
  VOIDED
  ERROR
  EXCHANGE_SENT
  EXCHANGE_RECEIVED
  ACCOUNTING_POSTED
  PDF_GENERATED
  @@schema("public")
}

enum CertificateStatus {
  ACTIVE
  EXPIRED
  REVOKED
  @@schema("public")
}

enum ExchangeStatus {
  PENDING_SEND
  SENT
  RECEIPT_CONFIRMED
  ACCEPTED
  REJECTED
  CLAIMED
  TACIT_ACCEPTANCE
  @@schema("public")
}

enum RcofStatus {
  PENDING
  GENERATED
  SENT
  ACCEPTED
  REJECTED
  ERROR
  @@schema("public")
}

enum DteReferenceCode {
  ANULA_DOCUMENTO
  CORRIGE_TEXTO
  CORRIGE_MONTOS
  @@schema("public")
}
```

### Models

```prisma
model DteConfig {
  id               String         @id @default(uuid())
  rut              String
  razonSocial      String
  giro             String
  actividadEco     Int
  direccion        String
  comuna           String
  ciudad           String
  codigoSucursal   Int?
  environment      DteEnvironment @default(CERTIFICATION)
  resolutionNum    Int
  resolutionDate   DateTime
  exchangeEmail    String?
  // IMAP config for receiving DTEs
  imapHost         String?
  imapPort         Int?           @default(993)
  imapUser         String?
  imapPass         String?        // encrypted with EncryptionService
  imapEnabled      Boolean        @default(false)
  imapLastPollAt   DateTime?
  imapLastUid      Int?
  // Accounting config
  autoCreateJournalEntry  Boolean @default(true)
  autoPostJournalEntry    Boolean @default(false)
  isActive         Boolean        @default(true)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  tenantId         String         @unique
  tenant           Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@map("dte_configs")
  @@schema("public")
}

model DteCertificate {
  id                String            @id @default(uuid())
  subjectName       String
  subjectRut        String
  issuer            String
  serialNumber      String
  validFrom         DateTime
  validUntil        DateTime
  status            CertificateStatus @default(ACTIVE)
  encryptedP12      String
  encryptedPassword String
  sha256Fingerprint String
  isPrimary         Boolean           @default(false)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  tenantId          String
  tenant            Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, sha256Fingerprint])
  @@index([tenantId, isPrimary])
  @@map("dte_certificates")
  @@schema("public")
}

model DteFolio {
  id              String         @id @default(uuid())
  dteType         DteType
  environment     DteEnvironment
  rangeFrom       Int
  rangeTo         Int
  nextFolio       Int
  encryptedCafXml String
  authorizedAt    DateTime
  expiresAt       DateTime
  isActive        Boolean        @default(true)
  isExhausted     Boolean        @default(false)
  alertThreshold  Int            @default(10)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  tenantId        String
  tenant          Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  dtes            Dte[]
  @@unique([tenantId, dteType, environment, rangeFrom])
  @@index([tenantId, dteType, environment, isActive, isExhausted])
  @@map("dte_folios")
  @@schema("public")
}

model Dte {
  id             String         @id @default(uuid())
  dteType        DteType
  folio          Int
  environment    DteEnvironment
  status         DteStatus      @default(DRAFT)
  direction      DteDirection   @default(EMITTED)

  // Emisor (for received DTEs, this is the supplier)
  emisorRut      String
  emisorRazon    String
  emisorGiro     String?

  // Receptor (optional for boletas — consumidor final)
  receptorRut    String?
  receptorRazon  String?
  receptorGiro   String?
  receptorDir    String?
  receptorComuna String?
  receptorCiudad String?

  // IdDoc fields
  formaPago      Int?
  medioPago      String?
  indServicio    Int?
  periodoDesde   DateTime?
  periodoHasta   DateTime?
  fechaVenc      DateTime?

  // Totales
  montoNeto      Int            @default(0)
  montoExento    Int            @default(0)
  montoBruto     Int?           // For boletas (IVA included)
  tasaIva        Decimal        @default(19) @db.Decimal(5, 2)
  iva            Int            @default(0)
  ivaRetTotal    Int            @default(0)
  montoTotal     Int            @default(0)

  // Dates
  fechaEmision   DateTime

  // XML and signatures
  xmlContent     String?        @db.Text
  tedXml         String?        @db.Text

  // Storage
  xmlS3Key       String?
  pdfS3Key       String?

  // SII tracking
  siiTrackId     String?
  siiResponse    Json?

  // Received DTE specific
  receptionDate  DateTime?      // When email was received
  deadlineDate   DateTime?      // receptionDate + 8 business days
  decidedAt      DateTime?
  decidedById    String?
  decidedBy      User?          @relation("DteDecidedBy", fields: [decidedById], references: [id])

  // Metadata
  deletedAt      DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  // Relations
  tenantId       String
  tenant         Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  folioRangeId   String?
  folioRange     DteFolio?      @relation(fields: [folioRangeId], references: [id])
  legalEntityId  String?
  legalEntity    LegalEntity?   @relation(fields: [legalEntityId], references: [id])
  journalEntryId String?        @unique
  journalEntry   JournalEntry?  @relation(fields: [journalEntryId], references: [id])
  createdById    String?
  createdBy      User?          @relation("DteCreatedBy", fields: [createdById], references: [id])

  items          DteItem[]
  references     DteReference[]
  globalDiscounts DteGlobalDiscount[]
  logs           DteLog[]
  exchanges      DteExchange[]

  @@unique([tenantId, dteType, folio, emisorRut])
  @@index([tenantId, status])
  @@index([tenantId, dteType])
  @@index([tenantId, direction])
  @@index([tenantId, direction, status])
  @@index([tenantId, fechaEmision])
  @@index([tenantId, receptorRut])
  @@index([tenantId, emisorRut])
  @@index([tenantId, legalEntityId])
  @@index([tenantId, deadlineDate])
  @@index([siiTrackId])
  @@map("dtes")
  @@schema("public")
}

model DteItem {
  id             String   @id @default(uuid())
  lineNumber     Int
  itemName       String
  description    String?
  indExe         Int?     // null=afecto, 1=no afecto, 2=no facturable, 6=prod no facturable
  quantity       Decimal  @db.Decimal(18, 6)
  unit           String?
  unitPrice      Decimal  @db.Decimal(18, 6)
  descuentoPct   Decimal? @db.Decimal(5, 2)
  descuentoMonto Decimal? @db.Decimal(18, 2)
  recargoPct     Decimal? @db.Decimal(5, 2)
  recargoMonto   Decimal? @db.Decimal(18, 2)
  montoItem      Decimal  @db.Decimal(18, 2)
  codigosItem    Json?    // [{tipo: "EAN-13", valor: "123456"}]
  dteId          String
  dte            Dte      @relation(fields: [dteId], references: [id], onDelete: Cascade)
  @@index([dteId])
  @@map("dte_items")
  @@schema("public")
}

model DteReference {
  id              String            @id @default(uuid())
  lineNumber      Int
  tipoDocRef      Int               // 33, 34, 56, 61, 801=OC, etc.
  folioRef        Int
  fechaRef        DateTime
  codRef          DteReferenceCode?
  razonRef        String?
  dteId           String
  dte             Dte               @relation(fields: [dteId], references: [id], onDelete: Cascade)
  referencedDteId String?           // FK to referenced DTE if it exists in our system
  @@index([dteId])
  @@map("dte_references")
  @@schema("public")
}

model DteGlobalDiscount {
  id             String  @id @default(uuid())
  lineNumber     Int
  tipoMovimiento String  // D=Descuento, R=Recargo
  glosa          String?
  tipoValor      String  // T=Porcentaje, $=Monto
  valor          Decimal @db.Decimal(18, 2)
  indExeDR       Int?    // 1=Afecto, 2=Exento
  dteId          String
  dte            Dte     @relation(fields: [dteId], references: [id], onDelete: Cascade)
  @@index([dteId])
  @@map("dte_global_discounts")
  @@schema("public")
}

model DteLog {
  id        String       @id @default(uuid())
  action    DteLogAction
  message   String?
  metadata  Json?
  actorId   String?
  createdAt DateTime     @default(now())
  dteId     String
  dte       Dte          @relation(fields: [dteId], references: [id], onDelete: Cascade)
  @@index([dteId, action])
  @@index([createdAt])
  @@map("dte_logs")
  @@schema("public")
}

model DteExchange {
  id             String         @id @default(uuid())
  status         ExchangeStatus @default(PENDING_SEND)
  recipientEmail String
  deadlineAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  dteId          String
  dte            Dte            @relation(fields: [dteId], references: [id], onDelete: Cascade)
  tenantId       String
  events         DteExchangeEvent[]
  @@index([tenantId, status])
  @@index([tenantId, deadlineAt])
  @@map("dte_exchanges")
  @@schema("public")
}

model DteExchangeEvent {
  id         String   @id @default(uuid())
  eventType  String   // ENVIO_DTE, RECEPCION_DTE, RESULTADO_DTE, ENVIO_RECIBOS, RECLAMO_*
  xmlContent String?  @db.Text
  metadata   Json?
  actorId    String?
  createdAt  DateTime @default(now())
  exchangeId String
  exchange   DteExchange @relation(fields: [exchangeId], references: [id], onDelete: Cascade)
  @@index([exchangeId])
  @@map("dte_exchange_events")
  @@schema("public")
}

model DteRcof {
  id          String         @id @default(uuid())
  date        DateTime       @db.Date
  environment DteEnvironment
  status      RcofStatus     @default(PENDING)
  summary     Json           // [{tipoDte, emitidos, anulados, rangoDesde, rangoHasta, montoTotal}]
  xmlContent  String?        @db.Text
  siiTrackId  String?
  siiResponse Json?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  tenantId    String
  tenant      Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, date, environment])
  @@index([tenantId, status])
  @@map("dte_rcofs")
  @@schema("public")
}

model DteAccountMapping {
  id                      String       @id @default(uuid())
  dteTypeCode             Int
  direction               DteDirection
  receivableAccountId     String?      // CxC (ventas a crédito)
  payableAccountId        String?      // CxP (compras a crédito)
  cashAccountId           String?      // Caja/Banco (boletas, contado)
  revenueAccountId        String?      // Ventas afectas
  revenueExemptAccountId  String?      // Ventas exentas
  purchaseAccountId       String?      // Compras/Gastos
  ivaDebitoAccountId      String?      // IVA Débito Fiscal
  ivaCreditoAccountId     String?      // IVA Crédito Fiscal
  salesReturnAccountId    String?      // Dev. y Rebajas s/ Ventas
  purchaseReturnAccountId String?      // Dev. y Rebajas s/ Compras
  isActive                Boolean      @default(true)
  createdAt               DateTime     @default(now())
  updatedAt               DateTime     @updatedAt
  tenantId                String
  tenant                  Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, dteTypeCode, direction])
  @@map("dte_account_mappings")
  @@schema("public")
}
```

### LegalEntity additions

```prisma
// Add to existing LegalEntity model:
dteExchangeEmail   String?
isAuthorizedDte    Boolean   @default(false)
siiLastRefresh     DateTime?
```

### Tenant additions

```prisma
// Add to existing Tenant model:
dteConfig          DteConfig?
dteCertificates    DteCertificate[]
dteFolios          DteFolio[]
dtes               Dte[]
dteRcofs           DteRcof[]
dteAccountMappings DteAccountMapping[]
```

---

## Corrected Permissions

```typescript
// packages/shared/src/permissions/module-definitions.ts
{
  key: 'invoicing',
  label: 'Facturación',
  section: 'business',
  granularPermissions: [
    { key: 'view-dte', label: 'Ver DTEs', minLevel: 'VIEW' },
    { key: 'emit-dte', label: 'Emitir DTE', minLevel: 'MANAGE' },
    { key: 'void-dte', label: 'Anular DTE', minLevel: 'MANAGE' },
    { key: 'manage-certificate', label: 'Gestionar certificados', minLevel: 'MANAGE' },
    { key: 'manage-caf', label: 'Gestionar folios CAF', minLevel: 'MANAGE' },
    { key: 'view-config', label: 'Ver configuración', minLevel: 'VIEW' },
    { key: 'manage-config', label: 'Modificar configuración', minLevel: 'MANAGE' },
    { key: 'switch-environment', label: 'Cambiar ambiente SII', minLevel: 'MANAGE' },
    { key: 'manage-received', label: 'Aceptar/rechazar DTEs recibidos', minLevel: 'EDIT' },
    { key: 'view-reports', label: 'Ver libros y reportes', minLevel: 'VIEW' },
    { key: 'download-xml', label: 'Descargar XML', minLevel: 'EDIT' },
  ],
}
```

---

## Corrected State Machine (SII-offline tolerant)

**Key design decision:** `SIGNED` = commercially usable. The DTE is legally valid once signed
with the digital certificate and TED. SII acceptance is a fiscal reporting obligation, not a
prerequisite for commercial use. This means:
- PDF is generated at SIGNED (not ACCEPTED)
- XML can be sent to receptor at SIGNED (not ACCEPTED)
- Accounting entry is created at SIGNED (not ACCEPTED) — reversed if SII rejects
- The business can operate normally even if the SII is down for hours

```
DRAFT → QUEUED → SIGNED ─────────→ SENT → ACCEPTED
                   │                         ↓
                   │                    REJECTED → [user can reissue]
                   │
                   ├── ✅ PDF generated (with PDF417)
                   ├── ✅ Deliverable to client
                   ├── ✅ XML sent to receptor via email
                   ├── ✅ Accounting entry created (DRAFT)
                   └── ⏳ SII submission retries in background
```

```typescript
// constants/state-machine.constants.ts
export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:                    ['QUEUED', 'ERROR'],
  QUEUED:                   ['SIGNED', 'ERROR'],
  SIGNED:                   ['SENT', 'ERROR'],      // Commercially usable
  SENT:                     ['ACCEPTED', 'REJECTED', 'ACCEPTED_WITH_OBJECTION', 'ERROR'],
  ACCEPTED:                 ['VOIDED'],
  ACCEPTED_WITH_OBJECTION:  ['VOIDED'],
  REJECTED:                 [],     // Terminal — user can reissue with new folio
  VOIDED:                   [],     // Terminal
  ERROR:                    ['QUEUED'], // Can retry
};

// SIGNED is the "commercially ready" state:
export const COMMERCIALLY_USABLE_STATES: DteStatus[] = [
  'SIGNED', 'SENT', 'ACCEPTED', 'ACCEPTED_WITH_OBJECTION',
];
```

**SII offline behavior:**
- Circuit breaker opens after 5 consecutive SII failures
- DTEs accumulate in SIGNED state (fully usable commercially)
- Orphan recovery cron re-queues SIGNED→SENT every 15min
- When SII recovers, pending DTEs are sent automatically (FIFO)
- If a DTE stays in SIGNED >4 hours, alert admin (but don't block operations)
- If SII rejects after the fact: notify user, reverse accounting entry, mark REJECTED
```

---

## Corrected Emission Flow (SII-offline tolerant)

The processor has TWO PHASES. Phase 1 (sign) never depends on SII connectivity.
Phase 2 (send to SII) is async and tolerates SII downtime. The DTE is commercially
usable after Phase 1 completes.

```
USER                          API                           BULLMQ                    SII
  |                             |                             |                        |
  |-- POST /dte/draft --------->|                             |                        |
  |<-- 201 { id, DRAFT } ------|                             |                        |
  |                             |                             |                        |
  |-- PUT /dte/:id/draft ------>| (edit items, receptor)      |                        |
  |<-- 200 updated ------------|                             |                        |
  |                             |                             |                        |
  |-- POST /dte/:id/emit ----->|                             |                        |
  |   (sync validations:       |                             |                        |
  |    config exists?          |                             |                        |
  |    cert active?            |                             |                        |
  |    folios available?       |                             |                        |
  |    NC has reference?)      |                             |                        |
  |                             |-- allocate folio (atomic) --|                        |
  |                             |-- update Dte (folio, QUEUED)|                        |
  |                             |-- enqueue job ------------->|                        |
  |<-- 202 { id, folio, QUEUED}|                             |                        |
  |                             |                             |                        |
  |                             |         === PHASE 1: SIGN (no SII dependency) ===    |
  |                             |                     if status==QUEUED:                |
  |                             |                       build XML                      |
  |                             |                       timbrar (TED with CAF key)     |
  |                             |                       firmar (XMLDSig with cert)     |
  |                             |                       generate PDF (Puppeteer+PDF417)|
  |                             |                       upload XML+PDF to S3           |
  |                             |                       update → SIGNED                |
  |                             |                       emit 'dte.signed'              |
  |                             |                             |                        |
  | <~~~~ WS: "Factura #1234 firmada y lista" ~~~~~~~~~~~~~~~~|                        |
  |                             |                             |                        |
  |                             |         [Listeners triggered by dte.signed:]         |
  |                             |         - Exchange: send XML to receptor via email    |
  |                             |         - Accounting: create JournalEntry (DRAFT)    |
  |                             |         - Notification: "DTE listo"                  |
  |                             |                             |                        |
  |                             |         === PHASE 2: SII SEND (async, tolerates downtime) ===
  |                             |                     if status==SIGNED:                |
  |                             |                       build envelope (EnvioDTE)      |
  |                             |                       try: send via SOAP --->| DTEUpload
  |                             |                         update → SENT        |<- trackId
  |                             |                         queue status check   |
  |                             |                       catch (SII down):      |
  |                             |                         stay in SIGNED       |
  |                             |                         retry via BullMQ     |
  |                             |                         (circuit breaker)    |
  |                             |                             |                        |
  |                             |         [StatusCheck processor — only if SENT]        |
  |                             |                       poll QueryEstUp ------>| status?
  |                             |                       if EPR+accepted:      |<- EPR
  |                             |                         update → ACCEPTED    |
  |                             |                         emit 'dte.accepted'  |
  |                             |                       if EPR+rejected:       |
  |                             |                         update → REJECTED    |
  |                             |                         emit 'dte.rejected'  |
  |                             |                         (reverse accounting) |
  |                             |                       else: re-queue (delay) |
  |                             |                             |                        |
  | <~~~~ WS: "Factura #1234 aceptada por SII" ~~~~~~~~~~~~~~|                        |
  |   or                        |                             |                        |
  | <~~~~ WS: "Factura #1234 RECHAZADA por SII — revisar" ~~~|                        |
```

**What happens when SII is down:**
1. Phase 1 completes normally (no SII dependency)
2. User gets notification: "Factura #1234 firmada y lista" with PDF download
3. XML is sent to receptor via email (SII-independent)
4. Accounting entry is created in DRAFT
5. Phase 2 fails → BullMQ retries with exponential backoff
6. Circuit breaker opens after 5 failures → stops hammering SII
7. Orphan recovery cron re-queues every 15min when circuit half-opens
8. When SII recovers → pending DTEs sent automatically (FIFO order)
9. If SII eventually rejects → user notified, accounting entry reversed
10. Alert at 4 hours: "X DTEs pendientes de confirmación SII"
```

---

## Key Code Patterns (corrected)

### Idempotent Processor (two-phase, SII-offline tolerant)

```typescript
async process(job: Job<{ dteId: string; tenantId: string }>) {
  const { dteId, tenantId } = job.data;
  const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
  const dte = await db.dte.findUniqueOrThrow({ where: { id: dteId }, include: { items: true } });

  // Already fully processed? Skip.
  if (['ACCEPTED', 'REJECTED', 'VOIDED'].includes(dte.status)) return;

  // Crashed after send but before status update? Resume status check.
  if (dte.siiTrackId && dte.status === 'SIGNED') {
    await this.stateMachine.transition(dteId, 'SIGNED', 'SENT', db);
    await this.queueStatusCheck(dteId, tenantId, dte.siiTrackId);
    return;
  }

  // ═══ PHASE 1: SIGN (no SII dependency — always succeeds if cert+CAF valid) ═══
  if (dte.status === 'QUEUED') {
    const config = await this.configService.get(tenantId);
    const cert = await this.certService.getPrimaryCert(tenantId);
    const caf = await this.folioService.getDecryptedCaf(dte.folioRangeId);

    // Build XML → timbrar (TED) → firmar (XMLDSig)
    const result = this.builder.build(buildInput, caf, cert);

    // Generate PDF immediately (user needs it even if SII is down)
    const pdfBuffer = await this.pdfService.generate(tenantId, dte, result.xml);

    // Upload XML + PDF to S3
    const xmlKey = await this.s3.upload(tenantId, xmlPath, result.xml);
    const pdfKey = await this.s3.upload(tenantId, pdfPath, pdfBuffer);

    // Update DTE → SIGNED (commercially usable from this point)
    await db.dte.update({
      where: { id: dteId },
      data: { status: 'SIGNED', xmlContent: result.xml, xmlS3Key: xmlKey, pdfS3Key: pdfKey },
    });
    await this.stateMachine.transition(dteId, 'QUEUED', 'SIGNED', db);

    // Emit event — triggers: send to receptor, create accounting entry, notify user
    this.eventEmitter.emit('dte.signed', { tenantId, dteId, folio: dte.folio });
  }

  // ═══ PHASE 2: SII SEND (async, tolerates SII downtime) ═══
  if (dte.status === 'SIGNED') {
    try {
      const config = await this.configService.get(tenantId);
      const cert = await this.certService.getPrimaryCert(tenantId);
      const envelopeXml = this.builder.buildEnvelope([dte.xmlContent], config, cert);

      const sendResult = await this.circuitBreaker.execute(() =>
        this.siiSender.sendDte(envelopeXml, cert, config.environment)
      );

      await db.dte.update({
        where: { id: dteId },
        data: { status: 'SENT', siiTrackId: sendResult.trackId, siiResponse: sendResult },
      });
      await this.queueStatusCheck(dteId, tenantId, sendResult.trackId);
    } catch (error) {
      // SII down? DTE stays in SIGNED (commercially usable). BullMQ will retry.
      this.logger.warn(`SII send failed for DTE ${dteId}, will retry: ${error.message}`);
      throw error; // Let BullMQ handle retry with backoff
    }
  }
}
```

### State Machine with Optimistic Lock

```typescript
async transition(dteId: string, from: DteStatus, to: DteStatus, db: PrismaClient) {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new ConflictException(`Invalid transition: ${from} → ${to}`);
  }
  const result = await db.dte.updateMany({
    where: { id: dteId, status: from },
    data: { status: to },
  });
  if (result.count === 0) {
    throw new ConflictException(`DTE ${dteId} is no longer in state ${from}`);
  }
  await db.dteLog.create({ data: { dteId, action: to as any, message: `${from} → ${to}` } });
}
```

### Folio Allocation (corrected — in service, not processor)

```typescript
// In DteEmissionService.emit() — BEFORE enqueueing
const config = await this.configService.get(tenantId);
await this.certService.validatePrimaryCertExists(tenantId);
const { folio, folioRangeId } = await this.folioAllocation.allocate(
  tenantId, data.dteType, config.environment
);
const dte = await db.dte.create({
  data: { ...dteData, folio, folioRangeId, status: 'QUEUED', emisorRut: config.rut, emisorRazon: config.razonSocial },
});
await this.emissionQueue.add('dte.emit', { dteId: dte.id, tenantId }, { jobId: `emit-${dte.id}` });
```

### Circuit Breaker (mandatory)

```typescript
import { circuitBreaker, retry, wrap, handleAll, ConsecutiveBreaker, ExponentialBackoff } from 'cockatiel';

@Injectable()
export class SiiCircuitBreakerService {
  private readonly policy = wrap(
    retry(handleAll, { maxAttempts: 3, backoff: new ExponentialBackoff({ initialDelay: 1000, maxDelay: 30000 }) }),
    circuitBreaker(handleAll, { halfOpenAfter: 30_000, breaker: new ConsecutiveBreaker(5) }),
  );

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.policy.execute(fn);
  }
}
```

---

## Frontend Routes

```
apps/web/app/(dashboard)/
  invoicing/
    page.tsx                    → Dashboard (totals, charts, alerts)
    new/page.tsx                → Emit DTE form
    emitidos/page.tsx           → Emitted DTEs bandeja
    recibidos/page.tsx          → Received DTEs bandeja
    [id]/page.tsx               → DTE detail (timeline, items, actions)
    certification/page.tsx      → SII certification progress

  settings/
    invoicing/page.tsx          → Issuer config + environment
    invoicing/certificates/page.tsx → Digital certificates
    invoicing/folios/page.tsx   → CAF/folio management
    invoicing/accounting/page.tsx → DTE→Account mapping
```

---

## Implementation Order

### Plan A — Schema + Infrastructure (foundation)
1. Install @devlas/dte-sii + cockatiel + bwip-js + imapflow + handlebars
2. Prisma schema: all enums + DteConfig + DteCertificate + DteFolio
3. Prisma schema: Dte + DteItem + DteReference + DteGlobalDiscount + DteLog
4. Prisma schema: DteExchange + DteExchangeEvent + DteRcof + DteAccountMapping
5. LegalEntity additions (dteExchangeEmail, isAuthorizedDte, siiLastRefresh)
6. Tenant + User + JournalEntry relation additions
7. Run migrations
8. Constants: dte-types, sii-endpoints, queue, state-machine
9. Zod schemas (corrected: receptor optional, references for NC/ND)
10. Permissions: add 8 new granular permissions
11. SiiCircuitBreakerService (cockatiel)
12. DteStateMachineService
13. BrowserPoolService (shared Puppeteer singleton)
14. DteModule skeleton + registration in AppModule

### Plan B — Core Emission (corrected)
15. CertificateParserService + CertificateService
16. FolioService (CAF upload) + FolioAllocationService (atomic, FOR UPDATE)
17. DteConfigService
18. ReceptorLookupService (ce_consulta_rut mTLS + LegalEntity cache)
19. DteBuilderService (wraps @devlas/dte-sii, includes References support)
20. SiiSenderService (uses library's internal token cache, wraps with circuit breaker)
21. SiiStatusService
22. DteDraftService (create/edit/delete drafts)
23. DteEmissionService (validate → allocate folio → QUEUED → enqueue)
24. DteEmissionProcessor (idempotent, resumes from last successful step)
25. SiiStatusCheckProcessor
26. DteNotificationListener (dte.signed → "lista", dte.accepted → "confirmada SII", dte.rejected → "RECHAZADA, revisar")
27. DteExchangeListener (dte.signed → queue send XML to receptor — SII-independent)
28. OrphanRecoveryCron (every 15min, re-queue SIGNED DTEs stuck >15min)
29. Controllers: dte-config, certificate, folio, dte (with RequirePermission)
30. DteService (list, getById with filters)
31. Tests: emission service, folio allocation, state machine

### Plan C — Void, Correct, Draft
32. DteVoidService (NC CodRef=1 generation + emission)
33. DteCorrectionService (NC CodRef=2 text, CodRef=3 amounts)
34. DteReissueService (re-emit rejected DTEs with new folio)
35. Validation: can-void checks (state, double void, cession, fiscal period)
36. Controllers: dte-void, dte-draft
37. Tests

### Plan D — PDF Generation
38. PDF417 generation with bwip-js (latin1 encoding)
39. Handlebars templates: factura.hbs, boleta.hbs, guia-despacho.hbs, boleta-thermal.hbs
40. DtePdfService (BrowserPool → HTML→PDF, cache in S3)
41. Endpoints: GET /dte/:id/pdf, GET /dte/:id/xml
42. DtePublicController (public link with token)
43. Tests

### Plan E — Received DTEs + Exchange
44. ImapPollingService (connect, fetch new, parse XML attachment)
45. DteXmlParserService (parse EnvioDTE XML)
46. DteValidationService (verify XMLDSig, TED, receiver data)
47. DteReceivedService (persist, auto-link LegalEntity, calculate deadline)
48. ExchangeResponseService (generate RecepcionDTE, ResultadoDTE, EnvioRecibos XML)
49. SiiReclamoService (WS RegistroReclamoDTE: ACD/RCD/ERM/RFP/RFT)
50. DeadlineCron (daily: tacit acceptance + alerts)
51. Controllers: dte-received (bandeja, decide, upload manual)
52. Tests

### Plan F — Accounting Integration
53. DteAccountMapping seed (defaults per DTE type)
54. DteAccountingListener (dte.signed → create JournalEntry DRAFT, dte.rejected → reverse entry)
55. Sale posting: F33→CxC/Ventas/IVA-DF, F34→CxC/Ventas-Ex, B39→Caja/Ventas/IVA-DF
56. Purchase posting: received F33→Compras/IVA-CF/CxP
57. NC reversal posting
58. VAT summary report (IVA DF - IVA CF = IVA por pagar)
59. Controller: dte-reports (books, IVA summary)
60. Tests

### Plan G — Boletas + RCOF
61. BoletaBuilderService (EnvioBOLETA, montoBruto, API REST)
62. SiiBoletaRestService (REST endpoints apicert.sii.cl / api.sii.cl)
63. Rate limiter (600 req/hour token bucket)
64. RcofService (wraps ConsumoFolio from @devlas/dte-sii)
65. RcofCron (daily 23:00, generate + send RCOF)
66. FolioAllocationService.allocateBatch(count) for bulk
67. BulkBoletaProcessor (batch 50 per REST call)
68. Tests

### Plan H — Frontend UI
69. Settings: DteConfig form, certificates, folios, accounting mapping
70. Emission: DTE form (type selector, receptor autocomplete, items table, totals, references)
71. Bandejas: emitted DTEs, received DTEs (with deadline indicators)
72. Detail: DTE view (timeline, items, actions, PDF preview)
73. Dashboard: monthly totals, daily chart, alerts
74. Certification: 6-stage progress panel

### Plan I — SII Certification
75. Adapt cert/CertRunner as NestJS service
76. Stage 1: Generate + send test sets (facturas, NC, ND)
77. Stage 2: Simulation with real data
78. Stage 3: Exchange via Puppeteer (www4.sii.cl/pfeInternet GWT)
79. Stage 4: Upload printed samples via Puppeteer (www4.sii.cl/pdfdteInternet ExtJS)
80. Stage 5-6: Compliance declaration + registration
81. Boleta certification (www4.sii.cl/certBolElectDteInternet GWT)

### Plan J — Security Hardening
82. Validate ENCRYPTION_KEY on startup (throw if missing/short)
83. Migrate to AES-256-GCM (with CBC backwards compat)
84. Audit log on every certificate/CAF decryption
85. Rate limiting on emission endpoints (@nestjs/throttler)
86. RUT validation (módulo 11) in Zod schema
87. XML input sanitization before builder
88. File size/MIME validation for .p12 upload
89. CAF RUT validation (must match tenant config)
90. Sensitive data masking in logs
