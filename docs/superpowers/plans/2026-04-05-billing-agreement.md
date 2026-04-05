# BillingAgreement + BillingConcept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BillingAgreement (convenio), BillingConcept (catálogo maestro), BillingAgreementLine (precio negociado), and BillingContact models to Zeru. Replace LabOriginPricing. Unify the import as "Importar Convenios". Add webhook handlers for 3 new FM layouts.

**Architecture:** BillingAgreement belongs to the transversal cobranzas module (FK to LegalEntity). BillingConcept is a shared catalog. LabOrigin gets `billingAgreementId` FK. The import orchestrates 6 steps in dependency order. Webhook handlers process 5 different FM layouts.

**Tech Stack:** Prisma (PostgreSQL), NestJS (services/controllers), Zod (shared schemas), EventEmitter2, FmApiService

**Spec:** `docs/superpowers/specs/2026-04-05-billing-agreement-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/schemas/billing.schema.ts` | Zod schemas for BillingAgreement, BillingConcept, BillingAgreementLine, BillingContact |
| `apps/api/src/modules/billing/billing.module.ts` | NestJS module for billing CRUD |
| `apps/api/src/modules/billing/billing-agreements.service.ts` | BillingAgreement CRUD |
| `apps/api/src/modules/billing/billing-agreements.controller.ts` | BillingAgreement REST endpoints |
| `apps/api/src/modules/billing/billing-concepts.service.ts` | BillingConcept CRUD |
| `apps/api/src/modules/billing/billing-concepts.controller.ts` | BillingConcept REST endpoints |
| `apps/api/src/modules/filemaker/transformers/convenio.transformer.ts` | FM→Zeru mapping for convenios layout |

### Modified files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add 2 enums, 4 models. Add `billingAgreementId` to LabOrigin. Remove `paymentTerms`/`billingDayOfMonth` from LegalEntity. Remove contract fields from LabOrigin. Drop LabOriginPricing. Add Tenant relations. |
| `apps/api/src/prisma/extensions/soft-delete.extension.ts` | Register 4 new models, remove `labOriginPricing` |
| `apps/api/src/modules/filemaker/filemaker.module.ts` | Register ConvenioTransformer |
| `apps/api/src/modules/filemaker/services/fm-import.service.ts` | Rewrite as unified "Importar Convenios" with 6 steps |
| `apps/api/src/modules/filemaker/services/fm-sync.service.ts` | Add 3 new webhook handlers |
| `apps/api/src/modules/filemaker/controllers/fm-import.controller.ts` | Change endpoint to `/convenios` |
| `apps/api/src/modules/filemaker/transformers/procedencias.transformer.ts` | Remove pricing methods, remove contract fields from ExtractedLabOrigin |
| `apps/api/src/modules/legal-entities/legal-entities.service.ts` | Remove paymentTerms/billingDayOfMonth handling |
| `apps/api/src/modules/lab-origins/lab-origins.service.ts` | Remove contract date handling, add billingAgreementId |
| `apps/api/src/app.module.ts` | Import BillingModule |
| `packages/shared/src/schemas/lab-origin.schema.ts` | Remove contract fields and pricing schema |
| `packages/shared/src/schemas/legal-entity.schema.ts` | Remove paymentTerms/billingDayOfMonth |
| `packages/shared/src/index.ts` | Export billing schemas |
| `apps/web/app/(dashboard)/integrations/filemaker/page.tsx` | Update import button label |

---

### Task 1: Prisma schema — Add new models and enums

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

This is the foundation. All other tasks depend on it.

- [ ] **Step 1: Add 2 new enums**

Add after the existing `ReportDeliveryMethod` enum:

```prisma
enum BillingAgreementStatus {
  ACTIVE
  EXPIRED
  DRAFT

  @@schema("public")
}

enum BillingModality {
  MONTHLY_SETTLEMENT
  FONASA_VOUCHER
  ISAPRE_VOUCHER
  CASH
  CHECK
  BANK_TRANSFER
  OTHER

  @@schema("public")
}
```

- [ ] **Step 2: Add BillingConcept model**

Add before LabOriginPricing:

```prisma
model BillingConcept {
  id               String   @id @default(uuid())
  code             String
  name             String
  description      String?
  referencePrice   Decimal  @db.Decimal(18, 2)
  currency         String   @default("CLP")

  isActive         Boolean  @default(true)
  deletedAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  tenantId         String
  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  agreementLines   BillingAgreementLine[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@schema("public")
  @@map("billing_concepts")
}
```

- [ ] **Step 3: Add BillingAgreement model**

```prisma
model BillingAgreement {
  id                     String                  @id @default(uuid())
  code                   String
  name                   String

  legalEntityId          String
  legalEntity            LegalEntity             @relation(fields: [legalEntityId], references: [id], onDelete: Cascade)

  status                 BillingAgreementStatus  @default(ACTIVE)
  contractDate           DateTime?
  effectiveFrom          DateTime?
  effectiveTo            DateTime?

  paymentTerms           PaymentTerms            @default(NET_30)
  customPaymentDays      Int?
  billingDayOfMonth      Int?
  isMonthlySettlement    Boolean                 @default(false)
  billingModalities      BillingModality[]

  examTypes              String[]
  operationalFlags       Json?

  notes                  String?
  isActive               Boolean                 @default(true)
  deletedAt              DateTime?
  createdAt              DateTime                @default(now())
  updatedAt              DateTime                @updatedAt

  tenantId               String
  tenant                 Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  lines                  BillingAgreementLine[]
  contacts               BillingContact[]
  labOrigins             LabOrigin[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([legalEntityId])
  @@schema("public")
  @@map("billing_agreements")
}
```

- [ ] **Step 4: Add BillingAgreementLine model**

```prisma
model BillingAgreementLine {
  id                  String           @id @default(uuid())

  billingAgreementId  String
  billingAgreement    BillingAgreement @relation(fields: [billingAgreementId], references: [id], onDelete: Cascade)

  billingConceptId    String
  billingConcept      BillingConcept   @relation(fields: [billingConceptId], references: [id], onDelete: Restrict)

  factor              Decimal          @default(1) @db.Decimal(8, 4)
  negotiatedPrice     Decimal          @db.Decimal(18, 2)
  referencePrice      Decimal?         @db.Decimal(18, 2)
  currency            String           @default("CLP")

  isActive            Boolean          @default(true)
  deletedAt           DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  tenantId            String

  @@unique([billingAgreementId, billingConceptId])
  @@index([billingAgreementId])
  @@index([billingConceptId])
  @@index([tenantId])
  @@schema("public")
  @@map("billing_agreement_lines")
}
```

- [ ] **Step 5: Add BillingContact model**

```prisma
model BillingContact {
  id                    String           @id @default(uuid())
  name                  String
  role                  String?
  email                 String?
  phone                 String?
  mobile                String?
  isPrimary             Boolean          @default(false)
  notes                 String?
  isActive              Boolean          @default(true)
  deletedAt             DateTime?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  billingAgreementId    String
  billingAgreement      BillingAgreement @relation(fields: [billingAgreementId], references: [id], onDelete: Cascade)
  tenantId              String

  @@index([billingAgreementId])
  @@index([tenantId])
  @@schema("public")
  @@map("billing_contacts")
}
```

- [ ] **Step 6: Modify LegalEntity — remove billing fields, add agreement relation**

Remove these fields from LegalEntity:
```prisma
  // REMOVE:
  paymentTerms      PaymentTerms @default(NET_30)
  customPaymentDays Int?
  billingDayOfMonth Int?
```

Add relation:
```prisma
  billingAgreements    BillingAgreement[]
```

- [ ] **Step 7: Modify LabOrigin — remove contract fields, add billingAgreementId, remove pricing relation**

Remove these fields from LabOrigin:
```prisma
  // REMOVE:
  contractDate               DateTime?
  contractActive             Boolean             @default(false)
  incorporationDate          DateTime?
  agreementDate              DateTime?
  lastAddendumNumber         String?
  lastAddendumDate           DateTime?
  lastAddendumDetail         String?
```

Remove the pricing relation:
```prisma
  // REMOVE:
  pricing                    LabOriginPricing[]
```

Add:
```prisma
  billingAgreementId         String?
  billingAgreement           BillingAgreement? @relation(fields: [billingAgreementId], references: [id], onDelete: SetNull)
```

Add index:
```prisma
  @@index([billingAgreementId])
```

- [ ] **Step 8: Delete LabOriginPricing model entirely**

Remove the entire `model LabOriginPricing { ... }` block.

- [ ] **Step 9: Add Tenant relations**

Add to the Tenant model:
```prisma
  billingAgreements   BillingAgreement[]
  billingConcepts     BillingConcept[]
```

- [ ] **Step 10: Create and apply migration**

```bash
mkdir -p apps/api/prisma/migrations/20260405100000_add_billing_agreement
```

Write the migration SQL manually (shadow DB has known issues), then:
```bash
cd apps/api && npx prisma db push --accept-data-loss
npx prisma migrate resolve --applied 20260405100000_add_billing_agreement
```

- [ ] **Step 11: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add BillingAgreement, BillingConcept, BillingAgreementLine, BillingContact models"
```

---

### Task 2: Soft-delete registration + Zod schemas + shared exports

**Files:**
- Modify: `apps/api/src/prisma/extensions/soft-delete.extension.ts`
- Create: `packages/shared/src/schemas/billing.schema.ts`
- Modify: `packages/shared/src/schemas/lab-origin.schema.ts`
- Modify: `packages/shared/src/schemas/legal-entity.schema.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Update soft-delete extension**

Add to `SOFT_DELETABLE_MODELS`:
```typescript
  'billingAgreement',
  'billingAgreementLine',
  'billingContact',
  'billingConcept',
```

Remove:
```typescript
  'labOriginPricing',
```

- [ ] **Step 2: Create billing.schema.ts**

```typescript
import { z } from 'zod';

const BILLING_AGREEMENT_STATUSES = ['ACTIVE', 'EXPIRED', 'DRAFT'] as const;
const BILLING_MODALITIES = [
  'MONTHLY_SETTLEMENT', 'FONASA_VOUCHER', 'ISAPRE_VOUCHER',
  'CASH', 'CHECK', 'BANK_TRANSFER', 'OTHER',
] as const;
const PAYMENT_TERMS = [
  'IMMEDIATE', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'CUSTOM',
] as const;

export const createBillingConceptSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  referencePrice: z.number().min(0, 'Precio debe ser >= 0'),
  currency: z.string().length(3).optional(),
});

export const updateBillingConceptSchema = createBillingConceptSchema.partial();

export const createBillingAgreementSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  legalEntityId: z.string().uuid('Persona jurídica requerida'),
  status: z.enum(BILLING_AGREEMENT_STATUSES).optional(),
  contractDate: z.string().date().optional(),
  effectiveFrom: z.string().date().optional(),
  effectiveTo: z.string().date().optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  customPaymentDays: z.number().int().min(1).optional(),
  billingDayOfMonth: z.number().int().min(1).max(28).optional(),
  isMonthlySettlement: z.boolean().optional(),
  billingModalities: z.array(z.enum(BILLING_MODALITIES)).optional(),
  examTypes: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const updateBillingAgreementSchema = createBillingAgreementSchema.partial();

export const createBillingAgreementLineSchema = z.object({
  billingConceptId: z.string().uuid('Concepto requerido'),
  factor: z.number().min(0).optional(),
  negotiatedPrice: z.number().min(0, 'Precio debe ser >= 0'),
  referencePrice: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
});

export const createBillingContactSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  role: z.string().optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

export type CreateBillingConceptSchema = z.infer<typeof createBillingConceptSchema>;
export type UpdateBillingConceptSchema = z.infer<typeof updateBillingConceptSchema>;
export type CreateBillingAgreementSchema = z.infer<typeof createBillingAgreementSchema>;
export type UpdateBillingAgreementSchema = z.infer<typeof updateBillingAgreementSchema>;
export type CreateBillingAgreementLineSchema = z.infer<typeof createBillingAgreementLineSchema>;
export type CreateBillingContactSchema = z.infer<typeof createBillingContactSchema>;
```

- [ ] **Step 3: Update lab-origin.schema.ts**

Remove from `createLabOriginSchema`:
- `contractDate`, `contractActive`, `incorporationDate`, `agreementDate`, `lastAddendumNumber`, `lastAddendumDate`, `lastAddendumDetail`

Add:
```typescript
  billingAgreementId: z.string().uuid().nullable().optional(),
```

Remove `createLabOriginPricingSchema` and its type export entirely.

- [ ] **Step 4: Update legal-entity.schema.ts**

Remove from `createLegalEntitySchema`:
- `paymentTerms`, `customPaymentDays`, `billingDayOfMonth`

- [ ] **Step 5: Export from shared index**

Add to `packages/shared/src/index.ts`:
```typescript
export * from './schemas/billing.schema';
```

- [ ] **Step 6: Build shared and verify**

```bash
pnpm --filter @zeru/shared build
pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: add billing Zod schemas, update lab-origin and legal-entity schemas"
```

---

### Task 3: Billing CRUD module

**Files:**
- Create: `apps/api/src/modules/billing/billing-concepts.service.ts`
- Create: `apps/api/src/modules/billing/billing-concepts.controller.ts`
- Create: `apps/api/src/modules/billing/billing-agreements.service.ts`
- Create: `apps/api/src/modules/billing/billing-agreements.controller.ts`
- Create: `apps/api/src/modules/billing/billing.module.ts`
- Modify: `apps/api/src/app.module.ts`

Follow the same patterns as LegalEntitiesService/Controller (forTenant, JwtAuthGuard, TenantGuard, ZodValidationPipe, EventEmitter2 for fm.sync events).

- [ ] **Step 1: Create BillingConceptsService** with findAll, findById, create, update, delete. Emit `fm.sync` events with `entityType: 'billing-concept'`.

- [ ] **Step 2: Create BillingConceptsController** at route `billing-concepts` with GET, GET/:id, POST, PATCH/:id, DELETE/:id.

- [ ] **Step 3: Create BillingAgreementsService** with findAll (include legalEntity, _count lines), findById (include lines with billingConcept, contacts, labOrigins), create, update, delete. Emit `fm.sync` events with `entityType: 'billing-agreement'`.

- [ ] **Step 4: Create BillingAgreementsController** at route `billing-agreements` with full CRUD. Also add nested endpoints for lines and contacts:
- `POST billing-agreements/:id/lines` — add a pricing line
- `POST billing-agreements/:id/contacts` — add a contact

- [ ] **Step 5: Create BillingModule** importing PrismaModule, registering services/controllers, exporting services.

- [ ] **Step 6: Register in AppModule**

- [ ] **Step 7: Build and commit**

```bash
git commit -m "feat: add Billing CRUD module (agreements + concepts)"
```

---

### Task 4: Update existing modules (LegalEntity, LabOrigin)

**Files:**
- Modify: `apps/api/src/modules/legal-entities/legal-entities.service.ts`
- Modify: `apps/api/src/modules/lab-origins/lab-origins.service.ts`

- [ ] **Step 1: Update LegalEntitiesService**

Remove `paymentTerms`/`billingDayOfMonth` from create/update handling. Add `billingAgreements` to findById include.

- [ ] **Step 2: Update LabOriginsService**

Remove all contract date conversions (`contractDate`, `incorporationDate`, `agreementDate`, `lastAddendumDate`). Add `billingAgreementId` to create/update. Add `billingAgreement` to findAll/findById includes.

- [ ] **Step 3: Build and commit**

```bash
git commit -m "feat: update LegalEntity and LabOrigin services for billing agreement FK"
```

---

### Task 5: ConvenioTransformer

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/convenio.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/transformers/procedencias.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/filemaker.module.ts`

- [ ] **Step 1: Create ConvenioTransformer**

Maps FM `CONVENIOS Conceptos de cobro*` layout to Zeru BillingAgreement + BillingAgreementLine + BillingContact. Methods:
- `extractBillingAgreement(record)` — maps fields per spec section 5.2
- `extractPricingLines(record)` — reads portal `portal_cdc`, maps per spec section 5.3
- `extractContacts(record)` — reads portal `CONTACTOS Cobranzas`
- `extractBillingConcept(record)` — maps `Conceptos de cobro (CDC)*` layout per spec section 5.4

Include parsing for `Modalidades Cobro` (multivalue → BillingModality[]), `Exámenes` (checkbox → string[]), `Estado Revisión Convenio` (→ BillingAgreementStatus), and operational flags (→ JSON).

- [ ] **Step 2: Update ProcedenciasTransformer**

Remove from `ExtractedLabOrigin` interface: `contractDate`, `contractActive`, `incorporationDate`, `agreementDate`, `lastAddendumNumber`, `lastAddendumDate`, `lastAddendumDetail`.

Remove from `extractLabOrigin()`: the 7 contract field extractions (lines ~129-135).

Remove methods: `extractPricing()`, `extractPricingFromRecord()`, and `ExtractedPricing` interface.

Remove `extractGeneralContacts()` if contacts are now managed through BillingAgreement.

- [ ] **Step 3: Register ConvenioTransformer in FileMakerModule**

Add to providers and exports.

- [ ] **Step 4: Build and commit**

```bash
git commit -m "feat: add ConvenioTransformer, simplify ProcedenciasTransformer"
```

---

### Task 6: Unified import — "Importar Convenios"

**Files:**
- Modify: `apps/api/src/modules/filemaker/services/fm-import.service.ts`
- Modify: `apps/api/src/modules/filemaker/controllers/fm-import.controller.ts`

- [ ] **Step 1: Rewrite ImportResult interface**

```typescript
export interface ImportResult {
  billingConceptsCreated: number;
  billingConceptsUpdated: number;
  legalEntitiesCreated: number;
  legalEntitiesUpdated: number;
  billingAgreementsCreated: number;
  billingAgreementsUpdated: number;
  billingLinesImported: number;
  billingContactsImported: number;
  labOriginsCreated: number;
  labOriginsUpdated: number;
  labOriginsSkippedDeleted: number;
  legalEntitiesSkippedDeleted: number;
  errors: Array<{ step: string; fmRecordId: string; error: string }>;
}
```

- [ ] **Step 2: Implement importConvenios method**

6-step orchestration:
1. Fetch and import BillingConcepts from `Conceptos de cobro (CDC)*` layout
2. Build LegalEntity cache (existing + deleted), import from Procedencias
3. Import BillingAgreements from `CONVENIOS Conceptos de cobro*` layout
4. Import BillingAgreementLines from portal `portal_cdc` on each agreement
5. Import BillingContacts from portal `CONTACTOS Cobranzas` on each agreement
6. Import LabOrigins from `Procedencias*`, set `billingAgreementId` via `_fk_convenio`

Each step has its own try/catch and counter tracking.

Build 3 FK translation maps:
- `fmConceptRecordId → billingConceptId` (Map<string, string>)
- `fmConvenioCode → billingAgreementId` (Map<string, string>)
- `rut → legalEntityId` (Map<string, string>)

- [ ] **Step 3: Update controller endpoint**

Change from `POST /filemaker/import/procedencias` to `POST /filemaker/import/convenios`. Keep the old endpoint as alias for backwards compatibility.

- [ ] **Step 4: Build and commit**

```bash
git commit -m "feat: unified import 'Importar Convenios' with 6-step pipeline"
```

---

### Task 7: Webhook handlers for new layouts

**Files:**
- Modify: `apps/api/src/modules/filemaker/services/fm-sync.service.ts`

- [ ] **Step 1: Add processConvenioWebhook handler**

For layout `CONVENIOS Conceptos de cobro*`:
- Read FM record via getRecord
- Extract BillingAgreement data via ConvenioTransformer
- Find LegalEntity by RUT, upsert BillingAgreement
- Replace contacts and upsert pricing lines

- [ ] **Step 2: Add processBillingConceptWebhook handler**

For layout `Conceptos de cobro (CDC)*`:
- Read FM record
- Upsert BillingConcept by code

- [ ] **Step 3: Add processPricingLineWebhook handler**

For layout `conceptos de cobro procedencia`:
- Read FM record
- Find BillingAgreement by Convenio_fk
- Find BillingConcept by Concepto de cobro_fk
- Upsert BillingAgreementLine

- [ ] **Step 4: Update handleWebhook dispatcher**

Add layout detection for the 3 new layouts before the existing logic:

```typescript
if (data.layout === 'CONVENIOS Conceptos de cobro*') {
  await this.processConvenioWebhook(tenantId, data.recordId, data.action);
  // log + return
}
if (data.layout === 'Conceptos de cobro (CDC)*') {
  await this.processBillingConceptWebhook(tenantId, data.recordId);
  // log + return
}
if (data.layout === 'conceptos de cobro procedencia') {
  await this.processPricingLineWebhook(tenantId, data.recordId);
  // log + return
}
```

- [ ] **Step 5: Update doPendingToFm for new entity types**

Add handling for `billing-agreement` and `billing-concept` entity types in `doPendingToFm` (read Zeru entity, transform to FM, call updateRecord).

- [ ] **Step 6: Build and commit**

```bash
git commit -m "feat: add webhook handlers for convenios, billing concepts, and pricing lines"
```

---

### Task 8: Update UI + sync service institution handler

**Files:**
- Modify: `apps/web/app/(dashboard)/integrations/filemaker/page.tsx`
- Modify: `apps/api/src/modules/filemaker/services/fm-sync.service.ts`

- [ ] **Step 1: Update ImportPanel in UI**

Change button label from "Importar Procedencias" to "Importar Convenios". Update the API call from `/filemaker/import/procedencias` to `/filemaker/import/convenios`. Update result display to show all new counters.

- [ ] **Step 2: Update processInstitutionWebhook**

Remove `paymentTerms`/`billingDayOfMonth` updates from this handler (they now live on BillingAgreement, not LegalEntity). Only update `legalName` and `email`.

- [ ] **Step 3: Lint, build, commit**

```bash
pnpm lint
pnpm build
git commit -m "feat: update UI for unified import, clean up institution webhook handler"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

- [ ] **Step 2: Run full build**

```bash
pnpm build
```

- [ ] **Step 3: Verify Prisma**

```bash
cd apps/api && npx prisma generate
```

- [ ] **Step 4: Commit any fixes**
