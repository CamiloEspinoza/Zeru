# LegalEntity + LabOrigin + ProcedenciasTransformer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LegalEntity (persona jurídica transversal) and LabOrigin (procedencia de laboratorio) models to Zeru with a composite transformer that imports data from FileMaker's `Procedencias*` layout.

**Architecture:** Prisma models in `public` schema with 5 new enums. A `ProcedenciasTransformer` NestJS service maps 1 FM record → 2 Zeru entities (LegalEntity + LabOrigin) with deduplication by RUT. An import service orchestrates the initial bulk load from FM. The existing `FmSyncRecord` unique constraint is modified to support 1→N entity mapping per FM record.

**Tech Stack:** Prisma (PostgreSQL), NestJS (services/controllers), Zod (shared schemas), EventEmitter2 (sync events), EncryptionService (FTP credentials)

**Spec:** `docs/superpowers/specs/2026-04-04-legal-entity-lab-origin-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/schemas/legal-entity.schema.ts` | Zod validation schemas for LegalEntity CRUD |
| `packages/shared/src/schemas/lab-origin.schema.ts` | Zod validation schemas for LabOrigin CRUD |
| `apps/api/src/modules/legal-entities/legal-entities.module.ts` | NestJS module |
| `apps/api/src/modules/legal-entities/legal-entities.service.ts` | CRUD service |
| `apps/api/src/modules/legal-entities/legal-entities.controller.ts` | REST controller |
| `apps/api/src/modules/lab-origins/lab-origins.module.ts` | NestJS module |
| `apps/api/src/modules/lab-origins/lab-origins.service.ts` | CRUD service |
| `apps/api/src/modules/lab-origins/lab-origins.controller.ts` | REST controller |
| `apps/api/src/modules/filemaker/transformers/procedencias.transformer.ts` | Composite transformer FM↔Zeru |
| `apps/api/src/modules/filemaker/services/fm-import.service.ts` | Bulk import orchestrator |
| `apps/api/src/modules/filemaker/controllers/fm-import.controller.ts` | Import trigger endpoint |

### Modified files

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add 5 enums, 5 models, modify FmSyncRecord unique constraint, add Tenant relations |
| `apps/api/src/prisma/extensions/soft-delete.extension.ts` | Register 5 new models |
| `apps/api/src/modules/filemaker/filemaker.module.ts` | Register transformer, import service, import controller |
| `apps/api/src/modules/filemaker/services/fm-sync.service.ts` | Update handleWebhook for composite transformer (findMany instead of findUnique) |
| `apps/api/src/app.module.ts` | Import LegalEntitiesModule, LabOriginsModule |
| `packages/shared/src/index.ts` | Export new schemas |
| `packages/shared/src/utils/format-rut.ts` | Add `normalizeRut()` function |

---

### Task 1: Add `normalizeRut()` to shared utils

**Files:**
- Modify: `packages/shared/src/utils/format-rut.ts`

- [ ] **Step 1: Add normalizeRut function**

In `packages/shared/src/utils/format-rut.ts`, add after the existing `validateRut` function:

```typescript
/**
 * Normalizes a Chilean RUT by removing dots, dashes, and spaces.
 * Returns digits + verification digit (e.g. "12.345.678-9" -> "123456789").
 */
export function normalizeRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/utils/format-rut.ts
git commit -m "feat: add normalizeRut utility for RUT normalization"
```

---

### Task 2: Add Prisma enums and models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add the 5 new enums**

Add before the existing models section in `schema.prisma`:

```prisma
enum PaymentTerms {
  IMMEDIATE
  NET_15
  NET_30
  NET_45
  NET_60
  NET_90
  CUSTOM

  @@schema("public")
}

enum BankAccountType {
  CHECKING
  SAVINGS
  VISTA
  OTHER

  @@schema("public")
}

enum LabOriginCategory {
  CONSULTA
  CENTRO_MEDICO
  CLINICA_HOSPITAL
  LABORATORIO
  OTRO

  @@schema("public")
}

enum SampleReceptionMode {
  PRESENCIAL
  COURIER
  AMBAS

  @@schema("public")
}

enum ReportDeliveryMethod {
  WEB
  IMPRESO
  FTP
  EMAIL

  @@schema("public")
}
```

- [ ] **Step 2: Add the LegalEntity model**

```prisma
model LegalEntity {
  id                String       @id @default(uuid())

  rut               String
  legalName         String
  tradeName         String?
  businessActivity  String?

  isClient          Boolean      @default(false)
  isSupplier        Boolean      @default(false)

  street            String?
  streetNumber      String?
  unit              String?
  commune           String?
  city              String?

  email             String?
  phone             String?
  website           String?

  paymentTerms      PaymentTerms @default(NET_30)
  customPaymentDays Int?
  billingDayOfMonth Int?

  isActive          Boolean      @default(true)
  deletedAt         DateTime?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  tenantId          String
  tenant            Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  contacts          LegalEntityContact[]
  bankAccounts      LegalEntityBankAccount[]
  labOrigins        LabOrigin[]

  @@unique([tenantId, rut])
  @@index([tenantId])
  @@index([tenantId, isClient])
  @@index([tenantId, isSupplier])
  @@schema("public")
  @@map("legal_entities")
}
```

- [ ] **Step 3: Add LegalEntityContact model**

```prisma
model LegalEntityContact {
  id              String   @id @default(uuid())
  name            String
  role            String?
  email           String?
  phone           String?
  mobile          String?
  isPrimary       Boolean  @default(false)
  notes           String?
  isActive        Boolean  @default(true)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  legalEntityId   String
  legalEntity     LegalEntity @relation(fields: [legalEntityId], references: [id], onDelete: Cascade)
  tenantId        String

  @@index([legalEntityId])
  @@index([tenantId])
  @@schema("public")
  @@map("legal_entity_contacts")
}
```

- [ ] **Step 4: Add LegalEntityBankAccount model**

```prisma
model LegalEntityBankAccount {
  id              String          @id @default(uuid())
  bankName        String
  accountType     BankAccountType
  accountNumber   String
  holderName      String
  holderRut       String?
  isPrimary       Boolean         @default(false)
  isActive        Boolean         @default(true)
  deletedAt       DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  legalEntityId   String
  legalEntity     LegalEntity     @relation(fields: [legalEntityId], references: [id], onDelete: Cascade)
  tenantId        String

  @@index([legalEntityId])
  @@index([tenantId])
  @@schema("public")
  @@map("legal_entity_bank_accounts")
}
```

- [ ] **Step 5: Add LabOrigin model**

```prisma
model LabOrigin {
  id                         String              @id @default(uuid())
  code                       String
  name                       String
  category                   LabOriginCategory   @default(OTRO)

  legalEntityId              String?
  legalEntity                LegalEntity?        @relation(fields: [legalEntityId], references: [id], onDelete: SetNull)

  parentId                   String?
  parent                     LabOrigin?          @relation("LabOriginHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children                   LabOrigin[]         @relation("LabOriginHierarchy")

  street                     String?
  streetNumber               String?
  unit                       String?
  commune                    String?
  city                       String?
  phone                      String?
  email                      String?

  sampleReceptionMode        SampleReceptionMode @default(PRESENCIAL)
  reportDeliveryMethods      ReportDeliveryMethod[]

  deliveryDaysBiopsy         Int?
  deliveryDaysPap            Int?
  deliveryDaysCytology       Int?
  deliveryDaysIhc            Int?
  deliveryDaysDefault        Int?

  encryptedFtpHost           String?
  encryptedFtpUser           String?
  encryptedFtpPassword       String?
  ftpPath                    String?

  criticalNotificationEmails String[]
  sendsQualityReports        Boolean             @default(false)

  contractDate               DateTime?
  notes                      String?
  isActive                   Boolean             @default(true)
  deletedAt                  DateTime?
  createdAt                  DateTime            @default(now())
  updatedAt                  DateTime            @updatedAt

  tenantId                   String
  tenant                     Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  pricing                    LabOriginPricing[]

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([tenantId, category])
  @@index([tenantId, isActive])
  @@index([legalEntityId])
  @@schema("public")
  @@map("lab_origins")
}
```

- [ ] **Step 6: Add LabOriginPricing model**

```prisma
model LabOriginPricing {
  id              String   @id @default(uuid())
  billingConcept  String
  description     String?
  basePrice       Decimal  @db.Decimal(18, 2)
  referencePrice  Decimal? @db.Decimal(18, 2)
  multiplier      Decimal  @default(1) @db.Decimal(8, 4)
  isActive        Boolean  @default(true)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  labOriginId     String
  labOrigin       LabOrigin @relation(fields: [labOriginId], references: [id], onDelete: Cascade)
  tenantId        String

  @@unique([labOriginId, billingConcept])
  @@index([labOriginId])
  @@index([tenantId])
  @@schema("public")
  @@map("lab_origin_pricing")
}
```

- [ ] **Step 7: Add Tenant relations**

Add to the existing `Tenant` model relations list (after `fmSyncRecords`):

```prisma
  legalEntities      LegalEntity[]
  labOrigins         LabOrigin[]
```

- [ ] **Step 8: Modify FmSyncRecord unique constraint**

In the `FmSyncRecord` model, change the second `@@unique` from:

```prisma
  @@unique([tenantId, fmDatabase, fmLayout, fmRecordId])
```

to:

```prisma
  @@unique([tenantId, fmDatabase, fmLayout, fmRecordId, entityType])
```

- [ ] **Step 9: Run Prisma migration**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter api prisma migrate dev --name add-legal-entity-lab-origin
```

Expected: Migration creates tables `legal_entities`, `legal_entity_contacts`, `legal_entity_bank_accounts`, `lab_origins`, `lab_origin_pricing` and modifies `fm_sync_records` unique constraint.

- [ ] **Step 10: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add LegalEntity, LabOrigin, and related Prisma models"
```

---

### Task 3: Register soft-deletable models

**Files:**
- Modify: `apps/api/src/prisma/extensions/soft-delete.extension.ts`

- [ ] **Step 1: Add the 5 new model names to SOFT_DELETABLE_MODELS**

Add to the `SOFT_DELETABLE_MODELS` set (these are camelCase Prisma delegate names):

```typescript
  'legalEntity',
  'legalEntityContact',
  'legalEntityBankAccount',
  'labOrigin',
  'labOriginPricing',
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/prisma/extensions/soft-delete.extension.ts
git commit -m "feat: register LegalEntity and LabOrigin models for soft delete"
```

---

### Task 4: Create Zod validation schemas

**Files:**
- Create: `packages/shared/src/schemas/legal-entity.schema.ts`
- Create: `packages/shared/src/schemas/lab-origin.schema.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create legal-entity.schema.ts**

```typescript
import { z } from 'zod';

const PAYMENT_TERMS = [
  'IMMEDIATE', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'CUSTOM',
] as const;

const BANK_ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'VISTA', 'OTHER'] as const;

export const createLegalEntitySchema = z.object({
  rut: z.string().min(3, 'RUT requerido'),
  legalName: z.string().min(1, 'Razón social requerida'),
  tradeName: z.string().optional(),
  businessActivity: z.string().optional(),
  isClient: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  unit: z.string().optional(),
  commune: z.string().optional(),
  city: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  customPaymentDays: z.number().int().min(1).optional(),
  billingDayOfMonth: z.number().int().min(1).max(28).optional(),
});

export const updateLegalEntitySchema = createLegalEntitySchema.partial();

export const createLegalEntityContactSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  role: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Banco requerido'),
  accountType: z.enum(BANK_ACCOUNT_TYPES),
  accountNumber: z.string().min(1, 'Número de cuenta requerido'),
  holderName: z.string().min(1, 'Titular requerido'),
  holderRut: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export type CreateLegalEntitySchema = z.infer<typeof createLegalEntitySchema>;
export type UpdateLegalEntitySchema = z.infer<typeof updateLegalEntitySchema>;
export type CreateLegalEntityContactSchema = z.infer<typeof createLegalEntityContactSchema>;
export type CreateBankAccountSchema = z.infer<typeof createBankAccountSchema>;
```

- [ ] **Step 2: Create lab-origin.schema.ts**

```typescript
import { z } from 'zod';

const LAB_ORIGIN_CATEGORIES = [
  'CONSULTA', 'CENTRO_MEDICO', 'CLINICA_HOSPITAL', 'LABORATORIO', 'OTRO',
] as const;

const SAMPLE_RECEPTION_MODES = ['PRESENCIAL', 'COURIER', 'AMBAS'] as const;

const REPORT_DELIVERY_METHODS = ['WEB', 'IMPRESO', 'FTP', 'EMAIL'] as const;

export const createLabOriginSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  category: z.enum(LAB_ORIGIN_CATEGORIES).optional(),
  legalEntityId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  street: z.string().optional(),
  streetNumber: z.string().optional(),
  unit: z.string().optional(),
  commune: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  sampleReceptionMode: z.enum(SAMPLE_RECEPTION_MODES).optional(),
  reportDeliveryMethods: z.array(z.enum(REPORT_DELIVERY_METHODS)).optional(),
  deliveryDaysBiopsy: z.number().int().min(0).optional(),
  deliveryDaysPap: z.number().int().min(0).optional(),
  deliveryDaysCytology: z.number().int().min(0).optional(),
  deliveryDaysIhc: z.number().int().min(0).optional(),
  deliveryDaysDefault: z.number().int().min(0).optional(),
  criticalNotificationEmails: z.array(z.string().email()).optional(),
  sendsQualityReports: z.boolean().optional(),
  contractDate: z.string().date().optional(),
  notes: z.string().optional(),
});

export const updateLabOriginSchema = createLabOriginSchema.partial();

export const createLabOriginPricingSchema = z.object({
  billingConcept: z.string().min(1, 'Concepto requerido'),
  description: z.string().optional(),
  basePrice: z.number().min(0, 'Precio debe ser >= 0'),
  referencePrice: z.number().min(0).optional(),
  multiplier: z.number().min(0).optional(),
});

export type CreateLabOriginSchema = z.infer<typeof createLabOriginSchema>;
export type UpdateLabOriginSchema = z.infer<typeof updateLabOriginSchema>;
export type CreateLabOriginPricingSchema = z.infer<typeof createLabOriginPricingSchema>;
```

- [ ] **Step 3: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './schemas/legal-entity.schema';
export * from './schemas/lab-origin.schema';
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter @zeru/shared build
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/legal-entity.schema.ts packages/shared/src/schemas/lab-origin.schema.ts packages/shared/src/index.ts
git commit -m "feat: add Zod validation schemas for LegalEntity and LabOrigin"
```

---

### Task 5: Create LegalEntities NestJS module

**Files:**
- Create: `apps/api/src/modules/legal-entities/legal-entities.service.ts`
- Create: `apps/api/src/modules/legal-entities/legal-entities.controller.ts`
- Create: `apps/api/src/modules/legal-entities/legal-entities.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the service**

Create `apps/api/src/modules/legal-entities/legal-entities.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeRut } from '@zeru/shared';
import type { CreateLegalEntitySchema, UpdateLegalEntitySchema } from '@zeru/shared';

@Injectable()
export class LegalEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.legalEntity.findMany({
      orderBy: { legalName: 'asc' },
      include: { _count: { select: { labOrigins: true } } },
    });
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await client.legalEntity.findUnique({
      where: { id },
      include: {
        contacts: { where: { isActive: true } },
        bankAccounts: { where: { isActive: true } },
        labOrigins: { where: { isActive: true }, select: { id: true, code: true, name: true, category: true } },
      },
    });
    if (!entity) throw new NotFoundException(`LegalEntity ${id} not found`);
    return entity;
  }

  async create(tenantId: string, data: CreateLegalEntitySchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.legalEntity.create({
      data: {
        ...data,
        rut: normalizeRut(data.rut),
        isClient: data.isClient ?? false,
        isSupplier: data.isSupplier ?? false,
      },
    });
  }

  async update(id: string, tenantId: string, data: UpdateLegalEntitySchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await client.legalEntity.findUnique({ where: { id } });
    if (!entity) throw new NotFoundException(`LegalEntity ${id} not found`);
    return client.legalEntity.update({
      where: { id },
      data: {
        ...data,
        ...(data.rut && { rut: normalizeRut(data.rut) }),
      },
    });
  }

  async delete(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await client.legalEntity.findUnique({ where: { id } });
    if (!entity) throw new NotFoundException(`LegalEntity ${id} not found`);
    await client.legalEntity.delete({ where: { id } });
  }
}
```

- [ ] **Step 2: Create the controller**

Create `apps/api/src/modules/legal-entities/legal-entities.controller.ts`:

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import {
  createLegalEntitySchema, updateLegalEntitySchema,
  type CreateLegalEntitySchema, type UpdateLegalEntitySchema,
} from '@zeru/shared';
import { LegalEntitiesService } from './legal-entities.service';

@Controller('legal-entities')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LegalEntitiesController {
  constructor(private readonly service: LegalEntitiesService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createLegalEntitySchema)) body: CreateLegalEntitySchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateLegalEntitySchema)) body: UpdateLegalEntitySchema,
  ) {
    return this.service.update(id, tenantId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.delete(id, tenantId);
  }
}
```

- [ ] **Step 3: Create the module**

Create `apps/api/src/modules/legal-entities/legal-entities.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LegalEntitiesService } from './legal-entities.service';
import { LegalEntitiesController } from './legal-entities.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LegalEntitiesController],
  providers: [LegalEntitiesService],
  exports: [LegalEntitiesService],
})
export class LegalEntitiesModule {}
```

- [ ] **Step 4: Register in AppModule**

In `apps/api/src/app.module.ts`, add import:

```typescript
import { LegalEntitiesModule } from './modules/legal-entities/legal-entities.module';
```

And add `LegalEntitiesModule` to the `imports` array.

- [ ] **Step 5: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter api build
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/legal-entities/ apps/api/src/app.module.ts
git commit -m "feat: add LegalEntities CRUD module"
```

---

### Task 6: Create LabOrigins NestJS module

**Files:**
- Create: `apps/api/src/modules/lab-origins/lab-origins.service.ts`
- Create: `apps/api/src/modules/lab-origins/lab-origins.controller.ts`
- Create: `apps/api/src/modules/lab-origins/lab-origins.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the service**

Create `apps/api/src/modules/lab-origins/lab-origins.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLabOriginSchema, UpdateLabOriginSchema } from '@zeru/shared';

@Injectable()
export class LabOriginsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.labOrigin.findMany({
      orderBy: { name: 'asc' },
      include: {
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true, pricing: true } },
      },
    });
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({
      where: { id },
      include: {
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        parent: { select: { id: true, code: true, name: true } },
        children: { where: { isActive: true }, select: { id: true, code: true, name: true, category: true } },
        pricing: { where: { isActive: true }, orderBy: { billingConcept: 'asc' } },
      },
    });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    return origin;
  }

  async create(tenantId: string, data: CreateLabOriginSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.labOrigin.create({
      data: {
        ...data,
        contractDate: data.contractDate ? new Date(data.contractDate) : undefined,
      },
    });
  }

  async update(id: string, tenantId: string, data: UpdateLabOriginSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({ where: { id } });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    return client.labOrigin.update({
      where: { id },
      data: {
        ...data,
        ...(data.contractDate !== undefined && {
          contractDate: data.contractDate ? new Date(data.contractDate) : null,
        }),
      },
    });
  }

  async delete(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({ where: { id } });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    await client.labOrigin.delete({ where: { id } });
  }
}
```

- [ ] **Step 2: Create the controller**

Create `apps/api/src/modules/lab-origins/lab-origins.controller.ts`:

```typescript
import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import {
  createLabOriginSchema, updateLabOriginSchema,
  type CreateLabOriginSchema, type UpdateLabOriginSchema,
} from '@zeru/shared';
import { LabOriginsService } from './lab-origins.service';

@Controller('lab-origins')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LabOriginsController {
  constructor(private readonly service: LabOriginsService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createLabOriginSchema)) body: CreateLabOriginSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateLabOriginSchema)) body: UpdateLabOriginSchema,
  ) {
    return this.service.update(id, tenantId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.delete(id, tenantId);
  }
}
```

- [ ] **Step 3: Create the module**

Create `apps/api/src/modules/lab-origins/lab-origins.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LabOriginsService } from './lab-origins.service';
import { LabOriginsController } from './lab-origins.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LabOriginsController],
  providers: [LabOriginsService],
  exports: [LabOriginsService],
})
export class LabOriginsModule {}
```

- [ ] **Step 4: Register in AppModule**

In `apps/api/src/app.module.ts`, add import:

```typescript
import { LabOriginsModule } from './modules/lab-origins/lab-origins.module';
```

And add `LabOriginsModule` to the `imports` array.

- [ ] **Step 5: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter api build
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/lab-origins/ apps/api/src/app.module.ts
git commit -m "feat: add LabOrigins CRUD module"
```

---

### Task 7: Create ProcedenciasTransformer

**Files:**
- Create: `apps/api/src/modules/filemaker/transformers/procedencias.transformer.ts`
- Modify: `apps/api/src/modules/filemaker/filemaker.module.ts`

This is the core transformation logic. The transformer maps FM `Procedencias*` records to Zeru `LegalEntity` + `LabOrigin` entities.

- [ ] **Step 1: Create the transformer**

Create `apps/api/src/modules/filemaker/transformers/procedencias.transformer.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../../common/services/encryption.service';
import { normalizeRut } from '@zeru/shared';
import type { FmRecord } from '@zeru/shared';

// ── Extracted DTO shapes ──

export interface ExtractedLegalEntity {
  rut: string;
  legalName: string;
  email: string | null;
  paymentTerms: 'IMMEDIATE' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60' | 'NET_90' | 'CUSTOM';
  customPaymentDays: number | null;
  billingDayOfMonth: number | null;
  isClient: boolean;
}

export interface ExtractedLabOrigin {
  code: string;
  name: string;
  category: 'CONSULTA' | 'CENTRO_MEDICO' | 'CLINICA_HOSPITAL' | 'LABORATORIO' | 'OTRO';
  street: string | null;
  streetNumber: string | null;
  unit: string | null;
  commune: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  sampleReceptionMode: 'PRESENCIAL' | 'COURIER' | 'AMBAS';
  reportDeliveryMethods: ('WEB' | 'IMPRESO' | 'FTP' | 'EMAIL')[];
  deliveryDaysBiopsy: number | null;
  deliveryDaysPap: number | null;
  deliveryDaysCytology: number | null;
  deliveryDaysIhc: number | null;
  deliveryDaysDefault: number | null;
  encryptedFtpHost: string | null;
  encryptedFtpUser: string | null;
  encryptedFtpPassword: string | null;
  ftpPath: string | null;
  criticalNotificationEmails: string[];
  sendsQualityReports: boolean;
  contractDate: Date | null;
  notes: string | null;
  isActive: boolean;
}

export interface ExtractedContact {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

export interface ExtractedPricing {
  billingConcept: string;
  description: string | null;
  basePrice: number;
  referencePrice: number | null;
  multiplier: number;
}

@Injectable()
export class ProcedenciasTransformer {
  readonly database = 'BIOPSIAS';
  readonly layout = 'Procedencias*';

  constructor(private readonly encryption: EncryptionService) {}

  // ── FM → Zeru extraction ──

  extractLegalEntity(record: FmRecord): ExtractedLegalEntity | null {
    const d = record.fieldData;
    const rawRut = str(d['INSTITUCIONES::Rut']);
    if (!rawRut) return null;

    const rut = normalizeRut(rawRut);
    if (rut.length < 3) return null;

    return {
      rut,
      legalName: str(d['INSTITUCIONES::Razón Social']) || `Sin razón social (${rut})`,
      email: str(d['INSTITUCIONES::Email encargado cuentas médicas']) || null,
      paymentTerms: parsePaymentTerms(str(d['INSTITUCIONES::PlazoPago'])),
      customPaymentDays: parseCustomPaymentDays(str(d['INSTITUCIONES::PlazoPago'])),
      billingDayOfMonth: parseBillingDay(str(d['INSTITUCIONES::Día de Facturación'])),
      isClient: true,
    };
  }

  extractLabOrigin(record: FmRecord): ExtractedLabOrigin {
    const d = record.fieldData;

    return {
      code: str(d['codigo_unico']) || record.recordId,
      name: str(d['nombre_procedencia']) || 'Sin nombre',
      category: parseCategory(str(d['Categoria'])),
      street: str(d['calle']) || null,
      streetNumber: str(d['numero']) || null,
      unit: str(d['oficina']) || null,
      commune: str(d['comuna']) || null,
      city: str(d['ciudad']) || null,
      phone: str(d['telefono']) || null,
      email: str(d['email']) || null,
      sampleReceptionMode: parseReceptionMode(str(d['modalidad_recepcion _examenes'])),
      reportDeliveryMethods: parseDeliveryMethods(str(d['VIA ENTREGA INFORMES'])),
      deliveryDaysBiopsy: parseInt(d['PLAZO BIOPSIAS']) || null,
      deliveryDaysPap: parseInt(d['PLAZO PAP']) || null,
      deliveryDaysCytology: parseInt(d['PLAZO THIN PREP']) || null,
      deliveryDaysIhc: null,
      deliveryDaysDefault: null,
      encryptedFtpHost: this.encryptIfPresent(str(d['FTP Servidor'])),
      encryptedFtpUser: this.encryptIfPresent(str(d['FTP Usuario'])),
      encryptedFtpPassword: this.encryptIfPresent(str(d['FTP Constraseña'])),
      ftpPath: str(d['FTP Path']) || null,
      criticalNotificationEmails: collectEmails(d, [
        'email_receptor_critico_1', 'email_receptor_critico_2',
        'email_receptor_critico_3', 'email_receptor_critico_4',
        'email_receptor_critico_5', 'email_receptor_critico_6',
      ]),
      sendsQualityReports: isYes(str(d['ENVÍO INFORMES CALIDAD'])),
      contractDate: parseDate(str(d['FECHA FIRMA CONTRATO'])),
      notes: str(d['OBSERVACIONES']) || null,
      isActive: isYes(str(d['Activo'])),
    };
  }

  extractContacts(record: FmRecord): ExtractedContact[] {
    const portalData = record.portalData?.['CONTACTOS Cobranzas'];
    if (!portalData || !Array.isArray(portalData)) return [];

    return portalData
      .map((row: Record<string, unknown>) => {
        const firstName = str(row['CONTACTOS Cobranzas::Nombre']);
        const lastName = str(row['CONTACTOS Cobranzas::Apellido']);
        const name = [firstName, lastName].filter(Boolean).join(' ');
        if (!name) return null;

        return {
          name,
          role: str(row['CONTACTOS Cobranzas::Cargo']) || null,
          email: str(row['CONTACTOS Cobranzas::Email']) || null,
          phone: str(row['CONTACTOS Cobranzas::Tel Fijo']) || null,
          mobile: str(row['CONTACTOS Cobranzas::Tel Celular']) || null,
        };
      })
      .filter((c): c is ExtractedContact => c !== null);
  }

  extractPricing(record: FmRecord): ExtractedPricing[] {
    const portalData = record.portalData?.['conceptos de cobro procedencia'];
    if (!portalData || !Array.isArray(portalData)) return [];

    return portalData
      .map((row: Record<string, unknown>) => {
        const concept = str(row['conceptos de cobro procedencia::Concepto de cobro_fk'])
          || str(row['conceptos de cobro procedencia::Código']);
        if (!concept) return null;

        return {
          billingConcept: concept,
          description: str(row['conceptos de cobro procedencia::Descripción']) || null,
          basePrice: parseNum(row['conceptos de cobro procedencia::Valor']),
          referencePrice: parseNum(row['conceptos de cobro procedencia::Valor Referencia']) || null,
          multiplier: parseNum(row['conceptos de cobro procedencia::Factor']) || 1,
        };
      })
      .filter((p): p is ExtractedPricing => p !== null);
  }

  // ── Zeru → FM (write-back) ──

  legalEntityToFm(entity: {
    legalName: string;
    email?: string | null;
  }): Record<string, unknown> {
    return {
      'INSTITUCIONES::Razón Social': entity.legalName,
      ...(entity.email && { 'INSTITUCIONES::Email encargado cuentas médicas': entity.email }),
    };
  }

  labOriginToFm(origin: {
    name: string;
    street?: string | null;
    streetNumber?: string | null;
    commune?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
    isActive: boolean;
  }): Record<string, unknown> {
    return {
      nombre_procedencia: origin.name,
      calle: origin.street ?? '',
      numero: origin.streetNumber ?? '',
      comuna: origin.commune ?? '',
      ciudad: origin.city ?? '',
      telefono: origin.phone ?? '',
      email: origin.email ?? '',
      Activo: origin.isActive ? 'SI' : 'No',
    };
  }

  // ── Private helpers ──

  private encryptIfPresent(value: string | null): string | null {
    if (!value) return null;
    return this.encryption.encrypt(value);
  }
}

// ── Pure helper functions ──

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseInt(val: unknown): number | null {
  const s = str(val);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : Math.round(n);
}

function parseNum(val: unknown): number {
  const s = str(val);
  if (!s) return 0;
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function isYes(val: string): boolean {
  return /^s[ií]/i.test(val);
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseCategory(val: string): ExtractedLabOrigin['category'] {
  const lower = val.toLowerCase();
  if (lower.includes('consulta')) return 'CONSULTA';
  if (lower.includes('centro') && lower.includes('méd')) return 'CENTRO_MEDICO';
  if (lower.includes('clínica') || lower.includes('hospital')) return 'CLINICA_HOSPITAL';
  if (lower.includes('laboratorio')) return 'LABORATORIO';
  return 'OTRO';
}

function parseReceptionMode(val: string): ExtractedLabOrigin['sampleReceptionMode'] {
  const lower = val.toLowerCase();
  if (lower.includes('ambas') || (lower.includes('presencial') && lower.includes('courier'))) return 'AMBAS';
  if (lower.includes('courier') || lower.includes('transporte')) return 'COURIER';
  return 'PRESENCIAL';
}

function parseDeliveryMethods(val: string): ExtractedLabOrigin['reportDeliveryMethods'] {
  if (!val) return [];
  const upper = val.toUpperCase();
  const methods: ExtractedLabOrigin['reportDeliveryMethods'] = [];
  if (upper.includes('WEB')) methods.push('WEB');
  if (upper.includes('FTP')) methods.push('FTP');
  if (upper.includes('IMPRES') || upper.includes('PAPEL')) methods.push('IMPRESO');
  if (upper.includes('EMAIL') || upper.includes('MAIL') || upper.includes('CORREO')) methods.push('EMAIL');
  return methods;
}

function parsePaymentTerms(val: string): ExtractedLegalEntity['paymentTerms'] {
  const n = Number(val?.replace(/[^0-9]/g, ''));
  if (!n || isNaN(n)) return 'NET_30';
  if (n <= 0) return 'IMMEDIATE';
  if (n <= 15) return 'NET_15';
  if (n <= 30) return 'NET_30';
  if (n <= 45) return 'NET_45';
  if (n <= 60) return 'NET_60';
  if (n <= 90) return 'NET_90';
  return 'CUSTOM';
}

function parseCustomPaymentDays(val: string): number | null {
  const n = Number(val?.replace(/[^0-9]/g, ''));
  if (!n || isNaN(n) || n <= 90) return null;
  return n;
}

function parseBillingDay(val: string): number | null {
  if (!val) return null;
  const n = Number(val.replace(/[^0-9]/g, ''));
  if (!n || isNaN(n) || n < 1 || n > 28) return null;
  return n;
}

function collectEmails(data: Record<string, unknown>, fields: string[]): string[] {
  const emails: string[] = [];
  for (const field of fields) {
    const val = str(data[field]);
    if (val && val.includes('@')) emails.push(val);
  }
  return emails;
}
```

- [ ] **Step 2: Register in FileMakerModule**

In `apps/api/src/modules/filemaker/filemaker.module.ts`, add import and provider:

```typescript
import { ProcedenciasTransformer } from './transformers/procedencias.transformer';
```

Add `ProcedenciasTransformer` to `providers` and `exports` arrays.

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter api build
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/filemaker/transformers/procedencias.transformer.ts apps/api/src/modules/filemaker/filemaker.module.ts
git commit -m "feat: add ProcedenciasTransformer for FM-to-Zeru field mapping"
```

---

### Task 8: Create FM Import Service

**Files:**
- Create: `apps/api/src/modules/filemaker/services/fm-import.service.ts`
- Create: `apps/api/src/modules/filemaker/controllers/fm-import.controller.ts`
- Modify: `apps/api/src/modules/filemaker/filemaker.module.ts`

The import service orchestrates bulk loading of FM data into Zeru, handling deduplication and FmSyncRecord creation.

- [ ] **Step 1: Create the import service**

Create `apps/api/src/modules/filemaker/services/fm-import.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from './fm-api.service';
import { FmSyncService } from './fm-sync.service';
import { ProcedenciasTransformer } from '../transformers/procedencias.transformer';

interface ImportResult {
  legalEntitiesCreated: number;
  legalEntitiesReused: number;
  labOriginsCreated: number;
  contactsCreated: number;
  pricingCreated: number;
  errors: Array<{ fmRecordId: string; error: string }>;
}

@Injectable()
export class FmImportService {
  private readonly logger = new Logger(FmImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly syncService: FmSyncService,
    private readonly transformer: ProcedenciasTransformer,
  ) {}

  async importProcedencias(tenantId: string): Promise<ImportResult> {
    const result: ImportResult = {
      legalEntitiesCreated: 0,
      legalEntitiesReused: 0,
      labOriginsCreated: 0,
      contactsCreated: 0,
      pricingCreated: 0,
      errors: [],
    };

    this.logger.log('Starting Procedencias import...');

    // 1. Fetch all FM records with portals
    const fmRecords = await this.fmApi.findAll(
      this.transformer.database,
      this.transformer.layout,
      [{}],
      {
        portals: ['CONTACTOS Cobranzas', 'conceptos de cobro procedencia'],
        dateformats: 2,
      },
    );

    this.logger.log(`Fetched ${fmRecords.length} FM records`);

    // 2. Build LegalEntity dedup cache: rut → id
    const existingEntities = await this.prisma.legalEntity.findMany({
      where: { tenantId },
      select: { id: true, rut: true },
    });
    const rutCache = new Map<string, string>();
    for (const e of existingEntities) {
      rutCache.set(e.rut, e.id);
    }

    // 3. Process each FM record
    for (const record of fmRecords) {
      try {
        await this.importSingleProcedencia(tenantId, record, rutCache, result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error importing FM record ${record.recordId}: ${msg}`);
        result.errors.push({ fmRecordId: record.recordId, error: msg });
      }
    }

    this.logger.log(
      `Import complete: ${result.legalEntitiesCreated} LE created, ` +
      `${result.legalEntitiesReused} LE reused, ${result.labOriginsCreated} origins, ` +
      `${result.contactsCreated} contacts, ${result.pricingCreated} pricing, ` +
      `${result.errors.length} errors`,
    );

    return result;
  }

  private async importSingleProcedencia(
    tenantId: string,
    record: { recordId: string; modId?: string; fieldData: Record<string, unknown>; portalData?: Record<string, unknown[]> },
    rutCache: Map<string, string>,
    result: ImportResult,
  ) {
    // Extract LegalEntity (may be null for 31% of records)
    const leData = this.transformer.extractLegalEntity(record);
    let legalEntityId: string | null = null;

    if (leData) {
      const cached = rutCache.get(leData.rut);
      if (cached) {
        legalEntityId = cached;
        result.legalEntitiesReused++;
      } else {
        const le = await this.prisma.legalEntity.create({
          data: { ...leData, tenantId },
        });
        legalEntityId = le.id;
        rutCache.set(leData.rut, le.id);
        result.legalEntitiesCreated++;

        // Create sync record for LegalEntity
        await this.prisma.fmSyncRecord.create({
          data: {
            tenantId,
            entityType: 'legal-entity',
            entityId: le.id,
            fmDatabase: this.transformer.database,
            fmLayout: this.transformer.layout,
            fmRecordId: record.recordId,
            fmModId: record.modId,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
          },
        });
      }

      // Import contacts (associated with LegalEntity)
      const contacts = this.transformer.extractContacts(record);
      for (const contact of contacts) {
        await this.prisma.legalEntityContact.create({
          data: { ...contact, legalEntityId, tenantId },
        });
        result.contactsCreated++;
      }
    }

    // Extract and create LabOrigin
    const originData = this.transformer.extractLabOrigin(record);
    const origin = await this.prisma.labOrigin.create({
      data: {
        ...originData,
        legalEntityId,
        tenantId,
      },
    });
    result.labOriginsCreated++;

    // Create sync record for LabOrigin
    await this.prisma.fmSyncRecord.create({
      data: {
        tenantId,
        entityType: 'lab-origin',
        entityId: origin.id,
        fmDatabase: this.transformer.database,
        fmLayout: this.transformer.layout,
        fmRecordId: record.recordId,
        fmModId: record.modId,
        syncStatus: 'SYNCED',
        lastSyncAt: new Date(),
      },
    });

    // Import pricing (associated with LabOrigin)
    const pricingItems = this.transformer.extractPricing(record);
    for (const pricing of pricingItems) {
      await this.prisma.labOriginPricing.create({
        data: { ...pricing, labOriginId: origin.id, tenantId },
      });
      result.pricingCreated++;
    }

    // Log the import
    await this.syncService.logSync({
      tenantId,
      entityType: 'lab-origin',
      entityId: origin.id,
      fmRecordId: record.recordId,
      action: 'import',
      direction: 'fm_to_zeru',
      details: {
        legalEntityId,
        contactsCount: leData ? this.transformer.extractContacts(record).length : 0,
        pricingCount: pricingItems.length,
      },
    });
  }
}
```

- [ ] **Step 2: Create the import controller**

Create `apps/api/src/modules/filemaker/controllers/fm-import.controller.ts`:

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FmImportService } from '../services/fm-import.service';

@Controller('filemaker/import')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FmImportController {
  constructor(private readonly importService: FmImportService) {}

  @Post('procedencias')
  importProcedencias(@CurrentTenant() tenantId: string) {
    return this.importService.importProcedencias(tenantId);
  }
}
```

- [ ] **Step 3: Register in FileMakerModule**

In `apps/api/src/modules/filemaker/filemaker.module.ts`, add imports:

```typescript
import { FmImportService } from './services/fm-import.service';
import { FmImportController } from './controllers/fm-import.controller';
```

Add `FmImportController` to `controllers` array. Add `FmImportService` to `providers` array.

- [ ] **Step 4: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter api build
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/filemaker/services/fm-import.service.ts apps/api/src/modules/filemaker/controllers/fm-import.controller.ts apps/api/src/modules/filemaker/filemaker.module.ts
git commit -m "feat: add FM import service for Procedencias bulk import"
```

---

### Task 9: Update FmSyncService for composite transformer

**Files:**
- Modify: `apps/api/src/modules/filemaker/services/fm-sync.service.ts`

The existing `handleWebhook` uses `findUnique` on `[tenantId, fmDatabase, fmLayout, fmRecordId]`, but after the schema change this is `[tenantId, fmDatabase, fmLayout, fmRecordId, entityType]`. We need to use `findMany` instead to find all sync records for a given FM record (could be 2 for Procedencias).

- [ ] **Step 1: Update handleWebhook to use findMany**

In `apps/api/src/modules/filemaker/services/fm-sync.service.ts`, replace the `handleWebhook` method:

```typescript
  async handleWebhook(tenantId: string, data: {
    database: string;
    layout: string;
    recordId: string;
    action: 'create' | 'update' | 'delete';
  }) {
    this.logger.log(`FM webhook: ${data.action} ${data.database}/${data.layout}/${data.recordId}`);

    // Find all sync records for this FM record (may be multiple for composite transformers)
    const existing = await this.prisma.fmSyncRecord.findMany({
      where: {
        tenantId,
        fmDatabase: data.database,
        fmLayout: data.layout,
        fmRecordId: data.recordId,
      },
    });

    if (existing.length > 0) {
      // Mark all as pending to sync from FM to Zeru
      for (const record of existing) {
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: { syncStatus: 'PENDING_TO_ZERU' },
        });
      }
    } else {
      // New record in FM — create a sync record for future processing
      await this.prisma.fmSyncRecord.create({
        data: {
          tenantId,
          entityType: 'unknown',
          entityId: '',
          fmDatabase: data.database,
          fmLayout: data.layout,
          fmRecordId: data.recordId,
          syncStatus: 'PENDING_TO_ZERU',
          lastSyncAt: new Date(),
        },
      });
    }

    await this.logSync({
      tenantId,
      entityType: existing[0]?.entityType ?? 'unknown',
      fmRecordId: data.recordId,
      action: `webhook:${data.action}`,
      direction: 'fm_to_zeru',
      details: { ...data, syncRecordCount: existing.length },
    });
  }
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter api build
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/filemaker/services/fm-sync.service.ts
git commit -m "fix: update handleWebhook to support composite transformer (findMany)"
```

---

### Task 10: Lint, build, and final verification

**Files:** All modified files

- [ ] **Step 1: Run lint**

```bash
cd /Users/camiloespinoza/Zeru && pnpm lint
```

Fix any lint errors.

- [ ] **Step 2: Run full build**

```bash
cd /Users/camiloespinoza/Zeru && pnpm build
```

- [ ] **Step 3: Verify Prisma client generation**

```bash
cd /Users/camiloespinoza/Zeru && pnpm --filter api prisma generate
```

- [ ] **Step 4: Final commit (if any lint fixes)**

```bash
git add -A
git commit -m "chore: lint fixes"
```
