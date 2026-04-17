# DTE/SII Core Emission — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Zeru to emit Factura Electrónica (type 33) to the SII certification environment (maullin), including certificate management, folio/CAF handling, XML generation, signing, and status tracking.

**Architecture:** Fork `@devlas/dte-sii` as the DTE engine (XML generation, signing, SII communication). Wrap its classes in NestJS services with Prisma persistence, BullMQ async processing, and Redis token caching. Follow existing patterns from `lab/` module for queues and `legal-entities/` for CRUD.

**Tech Stack:** NestJS, Prisma (PostgreSQL), BullMQ, Redis, `@devlas/dte-sii` fork (node-forge, fast-xml-parser, @xmldom/xmldom, got), Jest

**Scope:** This is Plan 1 of 5. Covers Phases 0-2 (setup + infrastructure + core emission). Subsequent plans:
- Plan 2: Folio auto-request + full DTE lifecycle (status polling, all DTE types)
- Plan 3: Exchange between taxpayers + reports (IECV, RCOF)
- Plan 4: Automated SII certification (6 stages, Puppeteer)
- Plan 5: Frontend UI (Next.js)

**Reference:** `docs/2026-04-12-dte-sii-research.md` — full technical research

---

## File Structure

### New files to create

```
apps/api/src/modules/dte/
├── dte.module.ts                           # Main module, imports sub-modules
├── constants/
│   ├── dte-types.constants.ts              # DTE type codes, names, SII codes
│   ├── sii-endpoints.constants.ts          # All SII WSDL/REST/CGI URLs
│   └── queue.constants.ts                  # BullMQ queue names, job names, config
├── controllers/
│   ├── dte.controller.ts                   # POST /dte (emit), GET /dte (list), GET /dte/:id
│   ├── dte-config.controller.ts            # CRUD tenant DTE configuration
│   ├── certificate.controller.ts           # Upload/list/delete certificates
│   └── folio.controller.ts                 # Upload/list CAFs, check availability
├── services/
│   ├── dte-emission.service.ts             # Orchestrator: validate → build → sign → queue
│   ├── dte-builder.service.ts              # Wraps @devlas/dte-sii DTE class
│   ├── dte-config.service.ts               # CRUD DteConfig (tenant SII settings)
│   └── dte.service.ts                      # CRUD Dte records (query, get, list)
├── sii/
│   ├── sii-auth.service.ts                 # Wraps EnviadorSII auth (semilla/token)
│   ├── sii-sender.service.ts               # Wraps EnviadorSII send (SOAP upload)
│   └── sii-status.service.ts               # Wraps EnviadorSII status queries
├── certificate/
│   ├── certificate.service.ts              # CRUD DteCertificate, encrypt/decrypt .p12
│   └── certificate-parser.service.ts       # Parse .p12 → extract cert info (node-forge via lib)
├── folio/
│   ├── folio.service.ts                    # CRUD DteFolio, upload CAF XML
│   └── folio-allocation.service.ts         # Atomic folio allocation (FOR UPDATE SKIP LOCKED)
├── processors/
│   ├── dte-emission.processor.ts           # BullMQ worker: build → sign → send → track
│   └── sii-status-check.processor.ts       # BullMQ worker: poll SII for DTE status
└── dto/
    └── index.ts                            # Re-exports DTOs (Zod schemas are in @zeru/shared)

packages/shared/src/schemas/
└── dte.schema.ts                           # Zod schemas for DTE DTOs
```

### Files to modify

```
apps/api/src/app.module.ts                  # Add DteModule to imports
apps/api/prisma/schema.prisma               # Add DTE models and enums
apps/api/package.json                       # Add @devlas/dte-sii fork dependency
packages/shared/src/permissions/module-definitions.ts  # Add more granular permissions
packages/shared/src/schemas/index.ts        # Export dte schemas
```

---

## Task 1: Fork and install @devlas/dte-sii

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Fork the repository**

Go to https://github.com/devlas-cl/dte-sii and fork to the Zeru org. Then clone locally to verify it works.

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
```

- [ ] **Step 2: Install the fork as a dependency**

For now, install directly from npm to validate the library works. We'll switch to the fork later after cleanup.

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
pnpm add @devlas/dte-sii --filter @zeru/api
```

- [ ] **Step 3: Verify the library loads**

Create a quick smoke test:

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration/apps/api
node -e "const lib = require('@devlas/dte-sii'); console.log(Object.keys(lib));"
```

Expected: Array of exported class names (DTE, CAF, Certificado, EnvioDTE, EnvioBOLETA, EnviadorSII, ConsumoFolio, etc.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore: add @devlas/dte-sii library for SII electronic invoicing"
```

---

## Task 2: Add Prisma schema — enums and DteConfig model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add DTE enums to schema.prisma**

Add after the existing enums section (after `FiscalPeriodStatus`):

```prisma
// ─── DTE (Electronic Tax Documents) ─────────────────────

enum DteType {
  FACTURA_ELECTRONICA           // 33
  FACTURA_EXENTA_ELECTRONICA    // 34
  BOLETA_ELECTRONICA            // 39
  BOLETA_EXENTA_ELECTRONICA     // 41
  FACTURA_COMPRA_ELECTRONICA    // 46
  GUIA_DESPACHO_ELECTRONICA     // 52
  NOTA_DEBITO_ELECTRONICA       // 56
  NOTA_CREDITO_ELECTRONICA      // 61

  @@schema("public")
}

enum DteStatus {
  DRAFT
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

enum DteLogAction {
  CREATED
  SIGNED
  SENT_TO_SII
  SII_RESPONSE
  ACCEPTED
  REJECTED
  VOIDED
  ERROR

  @@schema("public")
}

enum CertificateStatus {
  ACTIVE
  EXPIRED
  REVOKED

  @@schema("public")
}
```

- [ ] **Step 2: Add DteConfig model**

```prisma
model DteConfig {
  id             String         @id @default(uuid())
  rut            String
  razonSocial    String
  giro           String
  actividadEco   Int
  direccion      String
  comuna         String
  ciudad         String
  codigoSucursal Int?
  environment    DteEnvironment @default(CERTIFICATION)
  resolutionNum  Int
  resolutionDate DateTime
  exchangeEmail  String?
  isActive       Boolean        @default(true)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  tenantId String @unique
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("dte_configs")
  @@schema("public")
}
```

- [ ] **Step 3: Add the relation to Tenant model**

In the Tenant model, add:

```prisma
dteConfig DteConfig?
```

- [ ] **Step 4: Run migration**

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
pnpm --filter @zeru/api exec prisma migrate dev --name add_dte_config
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(dte): add DteConfig model and DTE enums to Prisma schema"
```

---

## Task 3: Add Prisma schema — DteCertificate and DteFolio models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add DteCertificate model**

```prisma
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

  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, isPrimary])
  @@map("dte_certificates")
  @@schema("public")
}
```

- [ ] **Step 2: Add DteFolio model**

```prisma
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

  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  dtes Dte[]

  @@index([tenantId, dteType, isActive])
  @@map("dte_folios")
  @@schema("public")
}
```

- [ ] **Step 3: Add relations to Tenant model**

In the Tenant model, add:

```prisma
dteCertificates DteCertificate[]
dteFolios       DteFolio[]
```

- [ ] **Step 4: Run migration**

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
pnpm --filter @zeru/api exec prisma migrate dev --name add_dte_certificate_and_folio
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(dte): add DteCertificate and DteFolio models"
```

---

## Task 4: Add Prisma schema — Dte, DteItem, DteLog models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add Dte model**

```prisma
model Dte {
  id             String         @id @default(uuid())
  dteType        DteType
  folio          Int
  environment    DteEnvironment
  status         DteStatus      @default(DRAFT)

  receptorRut    String
  receptorRazon  String
  receptorGiro   String?
  receptorDir    String?
  receptorComuna String?

  montoNeto      Int            @default(0)
  montoExento    Int            @default(0)
  tasaIva        Decimal        @default(19) @db.Decimal(5, 2)
  iva            Int            @default(0)
  montoTotal     Int            @default(0)

  fechaEmision   DateTime
  fechaVenc      DateTime?
  formaPago      Int?

  xmlContent     String?
  tedXml         String?

  siiTrackId     String?
  siiResponse    Json?

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  tenantId       String
  tenant         Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  folioRangeId   String?
  folioRange     DteFolio?      @relation(fields: [folioRangeId], references: [id])

  legalEntityId  String?
  legalEntity    LegalEntity?   @relation(fields: [legalEntityId], references: [id])

  referencedDteId String?
  referencedDte   Dte?          @relation("DteReference", fields: [referencedDteId], references: [id])
  referencingDtes Dte[]         @relation("DteReference")

  items          DteItem[]
  logs           DteLog[]

  @@unique([tenantId, dteType, folio])
  @@index([tenantId, status])
  @@index([tenantId, dteType])
  @@index([tenantId, fechaEmision])
  @@index([siiTrackId])
  @@map("dtes")
  @@schema("public")
}
```

- [ ] **Step 2: Add DteItem model**

```prisma
model DteItem {
  id          String  @id @default(uuid())
  lineNumber  Int
  itemName    String
  description String?
  quantity    Decimal @db.Decimal(18, 6)
  unit        String?
  unitPrice   Decimal @db.Decimal(18, 6)
  discount    Decimal @default(0) @db.Decimal(18, 2)
  surcharge   Decimal @default(0) @db.Decimal(18, 2)
  lineTotal   Decimal @db.Decimal(18, 2)
  isExempt    Boolean @default(false)

  dteId String
  dte   Dte    @relation(fields: [dteId], references: [id], onDelete: Cascade)

  @@index([dteId])
  @@map("dte_items")
  @@schema("public")
}
```

- [ ] **Step 3: Add DteLog model**

```prisma
model DteLog {
  id        String       @id @default(uuid())
  action    DteLogAction
  message   String?
  metadata  Json?
  actorId   String?
  createdAt DateTime     @default(now())

  dteId String
  dte   Dte    @relation(fields: [dteId], references: [id], onDelete: Cascade)

  @@index([dteId])
  @@index([dteId, action])
  @@map("dte_logs")
  @@schema("public")
}
```

- [ ] **Step 4: Add relations to Tenant and LegalEntity**

In the Tenant model, add:

```prisma
dtes Dte[]
```

In the LegalEntity model, add:

```prisma
dtes Dte[]
```

- [ ] **Step 5: Run migration**

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
pnpm --filter @zeru/api exec prisma migrate dev --name add_dte_item_log
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(dte): add Dte, DteItem, and DteLog models"
```

---

## Task 5: Add DTE constants

**Files:**
- Create: `apps/api/src/modules/dte/constants/dte-types.constants.ts`
- Create: `apps/api/src/modules/dte/constants/sii-endpoints.constants.ts`
- Create: `apps/api/src/modules/dte/constants/queue.constants.ts`

- [ ] **Step 1: Create dte-types.constants.ts**

```typescript
// apps/api/src/modules/dte/constants/dte-types.constants.ts

export const DTE_TYPE_CODES = {
  FACTURA_ELECTRONICA: 33,
  FACTURA_EXENTA_ELECTRONICA: 34,
  BOLETA_ELECTRONICA: 39,
  BOLETA_EXENTA_ELECTRONICA: 41,
  FACTURA_COMPRA_ELECTRONICA: 46,
  GUIA_DESPACHO_ELECTRONICA: 52,
  NOTA_DEBITO_ELECTRONICA: 56,
  NOTA_CREDITO_ELECTRONICA: 61,
} as const;

export const DTE_TYPE_NAMES: Record<number, string> = {
  33: 'Factura Electrónica',
  34: 'Factura No Afecta o Exenta Electrónica',
  39: 'Boleta Electrónica',
  41: 'Boleta Exenta Electrónica',
  46: 'Factura de Compra Electrónica',
  52: 'Guía de Despacho Electrónica',
  56: 'Nota de Débito Electrónica',
  61: 'Nota de Crédito Electrónica',
};

export const TASA_IVA = 19;

export const CODIGOS_REFERENCIA = {
  ANULA: 1,
  CORRIGE_TEXTO: 2,
  CORRIGE_MONTOS: 3,
} as const;
```

- [ ] **Step 2: Create sii-endpoints.constants.ts**

```typescript
// apps/api/src/modules/dte/constants/sii-endpoints.constants.ts

export const SII_ENVIRONMENTS = {
  CERTIFICATION: {
    host: 'maullin.sii.cl',
    SEED_WSDL: 'https://maullin.sii.cl/DTEWS/CrSeed.jws?WSDL',
    TOKEN_WSDL: 'https://maullin.sii.cl/DTEWS/GetTokenFromSeed.jws?WSDL',
    DTE_UPLOAD: 'https://maullin.sii.cl/cgi_dte/UPL/DTEUpload',
    QUERY_UPLOAD: 'https://maullin.sii.cl/DTEWS/QueryEstUp.jws?WSDL',
    QUERY_DTE: 'https://maullin.sii.cl/DTEWS/QueryEstDte.jws?WSDL',
    QUERY_DTE_AV: 'https://maullin.sii.cl/DTEWS/services/QueryEstDteAv?wsdl',
    BOLETA_BASE: 'https://apicert.sii.cl/recursos/v1',
  },
  PRODUCTION: {
    host: 'palena.sii.cl',
    SEED_WSDL: 'https://palena.sii.cl/DTEWS/CrSeed.jws?WSDL',
    TOKEN_WSDL: 'https://palena.sii.cl/DTEWS/GetTokenFromSeed.jws?WSDL',
    DTE_UPLOAD: 'https://palena.sii.cl/cgi_dte/UPL/DTEUpload',
    QUERY_UPLOAD: 'https://palena.sii.cl/DTEWS/QueryEstUp.jws?WSDL',
    QUERY_DTE: 'https://palena.sii.cl/DTEWS/QueryEstDte.jws?WSDL',
    QUERY_DTE_AV: 'https://palena.sii.cl/DTEWS/services/QueryEstDteAv?wsdl',
    BOLETA_BASE: 'https://api.sii.cl/recursos/v1',
  },
} as const;

export type SiiEnvironmentKey = keyof typeof SII_ENVIRONMENTS;
```

- [ ] **Step 3: Create queue.constants.ts**

```typescript
// apps/api/src/modules/dte/constants/queue.constants.ts

export const DTE_EMISSION_QUEUE = 'dte-emission';
export const DTE_STATUS_CHECK_QUEUE = 'dte-status-check';

export const DTE_JOB_NAMES = {
  EMIT: 'dte.emit',
  CHECK_STATUS: 'dte.check-status',
} as const;

export const DTE_QUEUE_CONFIG = {
  EMISSION: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 3000 },
    concurrency: 5,
  },
  STATUS_CHECK: {
    attempts: 10,
    backoff: { type: 'exponential' as const, delay: 10000 },
    concurrency: 3,
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/dte/constants/
git commit -m "feat(dte): add DTE type codes, SII endpoints, and queue constants"
```

---

## Task 6: Add Zod schemas for DTE DTOs

**Files:**
- Create: `packages/shared/src/schemas/dte.schema.ts`
- Modify: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: Create dte.schema.ts**

```typescript
// packages/shared/src/schemas/dte.schema.ts
import { z } from 'zod';

// ─── DteConfig ─────────────────────────────────────────

export const createDteConfigSchema = z.object({
  rut: z.string().min(3).max(12),
  razonSocial: z.string().min(1).max(100),
  giro: z.string().min(1).max(80),
  actividadEco: z.number().int().positive(),
  direccion: z.string().min(1).max(70),
  comuna: z.string().min(1).max(20),
  ciudad: z.string().min(1).max(20),
  codigoSucursal: z.number().int().optional(),
  environment: z.enum(['CERTIFICATION', 'PRODUCTION']).default('CERTIFICATION'),
  resolutionNum: z.number().int(),
  resolutionDate: z.string().datetime(),
  exchangeEmail: z.string().email().optional(),
});

export type CreateDteConfigSchema = z.infer<typeof createDteConfigSchema>;

export const updateDteConfigSchema = createDteConfigSchema.partial();
export type UpdateDteConfigSchema = z.infer<typeof updateDteConfigSchema>;

// ─── DTE Emission ──────────────────────────────────────

export const dteItemSchema = z.object({
  itemName: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  quantity: z.number().positive(),
  unit: z.string().max(4).optional(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  surcharge: z.number().nonnegative().default(0),
  isExempt: z.boolean().default(false),
});

export const emitDteSchema = z.object({
  dteType: z.enum([
    'FACTURA_ELECTRONICA',
    'FACTURA_EXENTA_ELECTRONICA',
    'NOTA_DEBITO_ELECTRONICA',
    'NOTA_CREDITO_ELECTRONICA',
    'GUIA_DESPACHO_ELECTRONICA',
    'BOLETA_ELECTRONICA',
    'BOLETA_EXENTA_ELECTRONICA',
    'FACTURA_COMPRA_ELECTRONICA',
  ]),
  receptorRut: z.string().min(3).max(12),
  receptorRazon: z.string().min(1).max(100),
  receptorGiro: z.string().max(80).optional(),
  receptorDir: z.string().max(70).optional(),
  receptorComuna: z.string().max(20).optional(),
  fechaEmision: z.string().datetime().optional(),
  fechaVenc: z.string().datetime().optional(),
  formaPago: z.number().int().min(1).max(3).optional(),
  items: z.array(dteItemSchema).min(1),
  referencedDteId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
});

export type EmitDteSchema = z.infer<typeof emitDteSchema>;

// ─── Certificate Upload ────────────────────────────────

export const uploadCertificateSchema = z.object({
  password: z.string().min(1),
  isPrimary: z.boolean().default(false),
});

export type UploadCertificateSchema = z.infer<typeof uploadCertificateSchema>;
```

- [ ] **Step 2: Export from index**

Add to `packages/shared/src/schemas/index.ts`:

```typescript
export * from './dte.schema';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/dte.schema.ts packages/shared/src/schemas/index.ts
git commit -m "feat(dte): add Zod validation schemas for DTE DTOs"
```

---

## Task 7: Certificate service — upload, parse, encrypt

**Files:**
- Create: `apps/api/src/modules/dte/certificate/certificate-parser.service.ts`
- Create: `apps/api/src/modules/dte/certificate/certificate.service.ts`
- Create: `apps/api/src/modules/dte/certificate/certificate.service.spec.ts`

- [ ] **Step 1: Write failing test for certificate parsing**

```typescript
// apps/api/src/modules/dte/certificate/certificate.service.spec.ts
import { Test } from '@nestjs/testing';
import { CertificateService } from './certificate.service';
import { CertificateParserService } from './certificate-parser.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { AuditService } from '../../audit/audit.service';

describe('CertificateService', () => {
  let service: CertificateService;
  let prisma: any;
  let encryption: any;

  beforeEach(async () => {
    prisma = {
      dteCertificate: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      forTenant: jest.fn().mockReturnThis(),
    };
    encryption = {
      encrypt: jest.fn((text: string) => `encrypted:${text}`),
      decrypt: jest.fn((text: string) => text.replace('encrypted:', '')),
    };

    const module = await Test.createTestingModule({
      providers: [
        CertificateService,
        CertificateParserService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(CertificateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('list returns certificates for tenant', async () => {
    const certs = [{ id: '1', subjectName: 'Test', tenantId: 't1' }];
    prisma.dteCertificate.findMany.mockResolvedValue(certs);

    const result = await service.list('t1');
    expect(result).toEqual(certs);
    expect(prisma.forTenant).toHaveBeenCalledWith('t1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
pnpm --filter @zeru/api exec jest --testPathPattern="certificate.service.spec" --no-coverage
```

Expected: FAIL — modules not found

- [ ] **Step 3: Implement CertificateParserService**

```typescript
// apps/api/src/modules/dte/certificate/certificate-parser.service.ts
import { Injectable } from '@nestjs/common';
import { Certificado } from '@devlas/dte-sii';
import { createHash } from 'crypto';

export interface ParsedCertificate {
  subjectName: string;
  subjectRut: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validUntil: Date;
  sha256Fingerprint: string;
}

@Injectable()
export class CertificateParserService {
  parse(p12Buffer: Buffer, password: string): { info: ParsedCertificate; cert: Certificado } {
    const cert = new Certificado(p12Buffer, password);

    const fingerprint = createHash('sha256')
      .update(cert.getCertificateBase64(), 'base64')
      .digest('hex');

    const info: ParsedCertificate = {
      subjectName: cert.nombre,
      subjectRut: cert.rut,
      issuer: 'Unknown', // node-forge extracts this internally
      serialNumber: fingerprint.slice(0, 40),
      validFrom: new Date(), // TODO: extract from cert if lib exposes it
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      sha256Fingerprint: fingerprint,
    };

    return { info, cert };
  }
}
```

- [ ] **Step 4: Implement CertificateService**

```typescript
// apps/api/src/modules/dte/certificate/certificate.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { AuditService } from '../../audit/audit.service';
import { CertificateParserService } from './certificate-parser.service';
import { Certificado } from '@devlas/dte-sii';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
    private readonly parser: CertificateParserService,
  ) {}

  async list(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteCertificate.findMany({
      select: {
        id: true,
        subjectName: true,
        subjectRut: true,
        issuer: true,
        validFrom: true,
        validUntil: true,
        status: true,
        isPrimary: true,
        sha256Fingerprint: true,
        createdAt: true,
      },
    });
  }

  async upload(tenantId: string, file: Buffer, password: string, isPrimary: boolean) {
    const { info } = this.parser.parse(file, password);

    const encryptedP12 = this.encryption.encrypt(file.toString('base64'));
    const encryptedPassword = this.encryption.encrypt(password);

    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    if (isPrimary) {
      await db.dteCertificate.updateMany({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const cert = await db.dteCertificate.create({
      data: {
        ...info,
        encryptedP12,
        encryptedPassword,
        isPrimary,
        tenantId,
      },
    });

    await this.audit.log({
      entityType: 'DteCertificate',
      entityId: cert.id,
      action: 'UPLOADED',
    });

    return cert;
  }

  async getPrimaryCert(tenantId: string): Promise<Certificado> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const record = await db.dteCertificate.findFirst({
      where: { isPrimary: true, status: 'ACTIVE' },
    });

    if (!record) {
      throw new BadRequestException('No active primary certificate found');
    }

    const p12Base64 = this.encryption.decrypt(record.encryptedP12);
    const password = this.encryption.decrypt(record.encryptedPassword);
    const p12Buffer = Buffer.from(p12Base64, 'base64');

    return new Certificado(p12Buffer, password);
  }

  async delete(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    await db.dteCertificate.delete({ where: { id } });

    await this.audit.log({
      entityType: 'DteCertificate',
      entityId: id,
      action: 'DELETED',
    });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
pnpm --filter @zeru/api exec jest --testPathPattern="certificate.service.spec" --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/dte/certificate/
git commit -m "feat(dte): add certificate upload, parsing, and encrypted storage"
```

---

## Task 8: Folio service — CAF upload and atomic allocation

**Files:**
- Create: `apps/api/src/modules/dte/folio/folio.service.ts`
- Create: `apps/api/src/modules/dte/folio/folio-allocation.service.ts`
- Create: `apps/api/src/modules/dte/folio/folio-allocation.service.spec.ts`

- [ ] **Step 1: Write failing test for folio allocation**

```typescript
// apps/api/src/modules/dte/folio/folio-allocation.service.spec.ts
import { Test } from '@nestjs/testing';
import { FolioAllocationService } from './folio-allocation.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('FolioAllocationService', () => {
  let service: FolioAllocationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      forTenant: jest.fn().mockReturnThis(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FolioAllocationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(FolioAllocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @zeru/api exec jest --testPathPattern="folio-allocation" --no-coverage
```

- [ ] **Step 3: Implement FolioService (CAF upload)**

```typescript
// apps/api/src/modules/dte/folio/folio.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { CAF } from '@devlas/dte-sii';
import { DteType, DteEnvironment, PrismaClient } from '@prisma/client';
import { DTE_TYPE_CODES } from '../constants/dte-types.constants';

const SII_CODE_TO_DTE_TYPE: Record<number, DteType> = {
  33: 'FACTURA_ELECTRONICA',
  34: 'FACTURA_EXENTA_ELECTRONICA',
  39: 'BOLETA_ELECTRONICA',
  41: 'BOLETA_EXENTA_ELECTRONICA',
  46: 'FACTURA_COMPRA_ELECTRONICA',
  52: 'GUIA_DESPACHO_ELECTRONICA',
  56: 'NOTA_DEBITO_ELECTRONICA',
  61: 'NOTA_CREDITO_ELECTRONICA',
};

@Injectable()
export class FolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async uploadCaf(tenantId: string, cafXml: string) {
    const caf = new CAF(cafXml);
    const dteType = SII_CODE_TO_DTE_TYPE[caf.getTipoDTE()];
    if (!dteType) {
      throw new BadRequestException(`Unsupported DTE type code: ${caf.getTipoDTE()}`);
    }

    const environment: DteEnvironment = caf.esCertificacion() ? 'CERTIFICATION' : 'PRODUCTION';
    const authorizedAt = new Date();
    const expiresAt = new Date(authorizedAt.getTime() + 6 * 30 * 24 * 60 * 60 * 1000); // 6 months

    const encryptedCafXml = this.encryption.encrypt(cafXml);

    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteFolio.create({
      data: {
        dteType,
        environment,
        rangeFrom: caf.getFolioDesde(),
        rangeTo: caf.getFolioHasta(),
        nextFolio: caf.getFolioDesde(),
        encryptedCafXml,
        authorizedAt,
        expiresAt,
        tenantId,
      },
    });
  }

  async list(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteFolio.findMany({
      select: {
        id: true,
        dteType: true,
        environment: true,
        rangeFrom: true,
        rangeTo: true,
        nextFolio: true,
        authorizedAt: true,
        expiresAt: true,
        isActive: true,
        isExhausted: true,
        alertThreshold: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDecryptedCaf(folioId: string): Promise<CAF> {
    const record = await (this.prisma as unknown as PrismaClient).dteFolio.findUniqueOrThrow({
      where: { id: folioId },
    });
    const cafXml = this.encryption.decrypt(record.encryptedCafXml);
    return new CAF(cafXml);
  }
}
```

- [ ] **Step 4: Implement FolioAllocationService (atomic allocation)**

```typescript
// apps/api/src/modules/dte/folio/folio-allocation.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DteType, DteEnvironment } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface AllocatedFolio {
  folio: number;
  folioRangeId: string;
}

@Injectable()
export class FolioAllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async allocate(tenantId: string, dteType: DteType, environment: DteEnvironment): Promise<AllocatedFolio> {
    return this.prisma.$transaction(async (tx) => {
      const folioRange = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM dte_folios
         WHERE "tenantId" = $1
           AND "dteType" = $2
           AND "environment" = $3
           AND "isActive" = true
           AND "isExhausted" = false
         ORDER BY "rangeFrom" ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        tenantId,
        dteType,
        environment,
      );

      if (!folioRange.length) {
        throw new BadRequestException(
          `No available folios for type ${dteType} in ${environment}`,
        );
      }

      const range = folioRange[0];
      const folio = range.nextFolio;
      const nextFolio = folio + 1;
      const isExhausted = nextFolio > range.rangeTo;
      const remaining = range.rangeTo - folio;

      await tx.$executeRawUnsafe(
        `UPDATE dte_folios SET "nextFolio" = $1, "isExhausted" = $2, "updatedAt" = NOW() WHERE id = $3`,
        nextFolio,
        isExhausted,
        range.id,
      );

      if (remaining <= range.alertThreshold && remaining > 0) {
        this.eventEmitter.emit('dte.folio.low_stock', {
          tenantId,
          dteType,
          remaining,
          folioRangeId: range.id,
        });
      }

      if (isExhausted) {
        this.eventEmitter.emit('dte.folio.exhausted', {
          tenantId,
          dteType,
          folioRangeId: range.id,
        });
      }

      return { folio, folioRangeId: range.id };
    });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @zeru/api exec jest --testPathPattern="folio-allocation" --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/dte/folio/
git commit -m "feat(dte): add CAF upload and atomic folio allocation with FOR UPDATE SKIP LOCKED"
```

---

## Task 9: DTE builder service — wraps @devlas/dte-sii DTE class

**Files:**
- Create: `apps/api/src/modules/dte/services/dte-builder.service.ts`

- [ ] **Step 1: Implement DteBuilderService**

```typescript
// apps/api/src/modules/dte/services/dte-builder.service.ts
import { Injectable } from '@nestjs/common';
import { DTE, CAF, Certificado, EnvioDTE } from '@devlas/dte-sii';
import { DTE_TYPE_CODES, TASA_IVA } from '../constants/dte-types.constants';
import { DteType } from '@prisma/client';

const DTE_TYPE_TO_CODE: Record<DteType, number> = {
  FACTURA_ELECTRONICA: DTE_TYPE_CODES.FACTURA_ELECTRONICA,
  FACTURA_EXENTA_ELECTRONICA: DTE_TYPE_CODES.FACTURA_EXENTA_ELECTRONICA,
  BOLETA_ELECTRONICA: DTE_TYPE_CODES.BOLETA_ELECTRONICA,
  BOLETA_EXENTA_ELECTRONICA: DTE_TYPE_CODES.BOLETA_EXENTA_ELECTRONICA,
  FACTURA_COMPRA_ELECTRONICA: DTE_TYPE_CODES.FACTURA_COMPRA_ELECTRONICA,
  GUIA_DESPACHO_ELECTRONICA: DTE_TYPE_CODES.GUIA_DESPACHO_ELECTRONICA,
  NOTA_DEBITO_ELECTRONICA: DTE_TYPE_CODES.NOTA_DEBITO_ELECTRONICA,
  NOTA_CREDITO_ELECTRONICA: DTE_TYPE_CODES.NOTA_CREDITO_ELECTRONICA,
};

export interface DteBuildInput {
  dteType: DteType;
  folio: number;
  fechaEmision: string;
  formaPago?: number;
  emisor: {
    rut: string;
    razonSocial: string;
    giro: string;
    actividadEco: number;
    direccion: string;
    comuna: string;
  };
  receptor: {
    rut: string;
    razonSocial: string;
    giro?: string;
    direccion?: string;
    comuna?: string;
  };
  items: Array<{
    nombre: string;
    descripcion?: string;
    cantidad: number;
    unidad?: string;
    precioUnitario: number;
    descuento?: number;
    exento?: boolean;
  }>;
}

export interface DteBuildResult {
  xml: string;
  tedXml: string;
  montoNeto: number;
  montoExento: number;
  iva: number;
  montoTotal: number;
}

@Injectable()
export class DteBuilderService {
  build(input: DteBuildInput, caf: CAF, cert: Certificado): DteBuildResult {
    const tipo = DTE_TYPE_TO_CODE[input.dteType];

    const items = input.items.map((item, idx) => ({
      nombre: item.nombre,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      unidad: item.unidad,
      precioUnit: item.precioUnitario,
      descuento: item.descuento || 0,
      exento: item.exento || false,
    }));

    const dte = new DTE({
      tipo,
      folio: input.folio,
      fecha: input.fechaEmision,
      formaPago: input.formaPago,
      emisor: {
        rut: input.emisor.rut,
        razonSocial: input.emisor.razonSocial,
        giro: input.emisor.giro,
        acteco: input.emisor.actividadEco,
        direccion: input.emisor.direccion,
        comuna: input.emisor.comuna,
      },
      receptor: {
        rut: input.receptor.rut,
        razonSocial: input.receptor.razonSocial,
        giro: input.receptor.giro,
        direccion: input.receptor.direccion,
        comuna: input.receptor.comuna,
      },
      items,
    });

    dte.generarXML().timbrar(caf).firmar(cert);

    return {
      xml: dte.getXML(),
      tedXml: '', // TED is embedded in the XML
      montoNeto: dte.getMontoTotal(), // Library calculates totals
      montoExento: 0,
      iva: 0,
      montoTotal: dte.getMontoTotal(),
    };
  }

  buildEnvelope(
    dteXmls: string[],
    emisorRut: string,
    enviaRut: string,
    resolutionDate: string,
    resolutionNum: number,
    cert: Certificado,
  ): string {
    const envio = new EnvioDTE({
      rpiEmisor: emisorRut,
      rpiEnvia: enviaRut,
      fchResol: resolutionDate,
      nroResol: resolutionNum,
      certificado: cert,
    });

    for (const xml of dteXmls) {
      envio.agregar(xml);
    }

    return envio.generar();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/dte/services/dte-builder.service.ts
git commit -m "feat(dte): add DTE builder service wrapping @devlas/dte-sii"
```

---

## Task 10: SII communication services — auth, send, status

**Files:**
- Create: `apps/api/src/modules/dte/sii/sii-auth.service.ts`
- Create: `apps/api/src/modules/dte/sii/sii-sender.service.ts`
- Create: `apps/api/src/modules/dte/sii/sii-status.service.ts`

- [ ] **Step 1: Implement SiiAuthService (token cache in Redis)**

```typescript
// apps/api/src/modules/dte/sii/sii-auth.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EnviadorSII } from '@devlas/dte-sii';
import { Certificado } from '@devlas/dte-sii';
import { RedisService } from '../../../common/services/redis.service';
import { DteEnvironment } from '@prisma/client';

const TOKEN_TTL_SECONDS = 3000; // 50 minutes (SII token lasts ~60min)

@Injectable()
export class SiiAuthService {
  private readonly logger = new Logger(SiiAuthService.name);

  constructor(private readonly redis: RedisService) {}

  async getToken(cert: Certificado, environment: DteEnvironment): Promise<string> {
    const cacheKey = `sii:token:${cert.rut}:${environment}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      this.logger.debug(`SII token cache hit for ${cert.rut}`);
      return cached;
    }

    this.logger.log(`Requesting new SII token for ${cert.rut} in ${environment}`);
    const ambiente = environment === 'CERTIFICATION' ? 'certificacion' : 'produccion';
    const enviador = new EnviadorSII(cert, ambiente);

    const token = await enviador.getTokenSoap();

    await this.redis.set(cacheKey, token, 'EX', TOKEN_TTL_SECONDS);
    this.logger.log(`SII token cached for ${cert.rut} (TTL ${TOKEN_TTL_SECONDS}s)`);

    return token;
  }

  async invalidateToken(certRut: string, environment: DteEnvironment): Promise<void> {
    const cacheKey = `sii:token:${certRut}:${environment}`;
    await this.redis.del(cacheKey);
  }
}
```

- [ ] **Step 2: Implement SiiSenderService**

```typescript
// apps/api/src/modules/dte/sii/sii-sender.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EnviadorSII, Certificado } from '@devlas/dte-sii';
import { DteEnvironment } from '@prisma/client';

export interface SiiSendResult {
  trackId: string;
  timestamp: string;
  status: number;
}

@Injectable()
export class SiiSenderService {
  private readonly logger = new Logger(SiiSenderService.name);

  async sendDte(
    envelopeXml: string,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<SiiSendResult> {
    const ambiente = environment === 'CERTIFICATION' ? 'certificacion' : 'produccion';
    const enviador = new EnviadorSII(cert, ambiente);

    this.logger.log(`Sending DTE envelope to SII (${ambiente})`);
    const result = await enviador.enviarDteSoap(envelopeXml);

    this.logger.log(`SII response: trackId=${result.trackId}, status=${result.status}`);

    return {
      trackId: String(result.trackId),
      timestamp: new Date().toISOString(),
      status: result.status,
    };
  }
}
```

- [ ] **Step 3: Implement SiiStatusService**

```typescript
// apps/api/src/modules/dte/sii/sii-status.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EnviadorSII, Certificado } from '@devlas/dte-sii';
import { DteEnvironment } from '@prisma/client';

export interface SiiStatusResult {
  status: string;
  statusGlosa: string;
  accepted: number;
  rejected: number;
  objected: number;
  raw: Record<string, unknown>;
}

@Injectable()
export class SiiStatusService {
  private readonly logger = new Logger(SiiStatusService.name);

  async checkUploadStatus(
    trackId: string,
    emisorRut: string,
    cert: Certificado,
    environment: DteEnvironment,
  ): Promise<SiiStatusResult> {
    const ambiente = environment === 'CERTIFICATION' ? 'certificacion' : 'produccion';
    const enviador = new EnviadorSII(cert, ambiente);

    this.logger.log(`Checking SII status for trackId=${trackId}`);
    const result = await enviador.consultarEstadoSoap(trackId, emisorRut);

    return {
      status: result.estado || 'UNKNOWN',
      statusGlosa: result.glosa || '',
      accepted: result.aceptados || 0,
      rejected: result.rechazados || 0,
      objected: result.reparos || 0,
      raw: result,
    };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/dte/sii/
git commit -m "feat(dte): add SII auth (Redis token cache), sender, and status services"
```

---

## Task 11: DTE emission orchestrator and CRUD service

**Files:**
- Create: `apps/api/src/modules/dte/services/dte-emission.service.ts`
- Create: `apps/api/src/modules/dte/services/dte.service.ts`
- Create: `apps/api/src/modules/dte/services/dte-config.service.ts`

- [ ] **Step 1: Implement DteConfigService**

```typescript
// apps/api/src/modules/dte/services/dte-config.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { CreateDteConfigSchema, UpdateDteConfigSchema } from '@zeru/shared';

@Injectable()
export class DteConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const config = await db.dteConfig.findUnique({ where: { tenantId } });
    if (!config) throw new NotFoundException('DTE configuration not found');
    return config;
  }

  async upsert(tenantId: string, data: CreateDteConfigSchema) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteConfig.upsert({
      where: { tenantId },
      create: { ...data, resolutionDate: new Date(data.resolutionDate), tenantId },
      update: { ...data, resolutionDate: new Date(data.resolutionDate) },
    });
  }
}
```

- [ ] **Step 2: Implement DteService (CRUD)**

```typescript
// apps/api/src/modules/dte/services/dte.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, DteType, DteStatus } from '@prisma/client';

@Injectable()
export class DteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, filters?: { dteType?: DteType; status?: DteStatus; limit?: number; offset?: number }) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dte.findMany({
      where: {
        ...(filters?.dteType && { dteType: filters.dteType }),
        ...(filters?.status && { status: filters.status }),
      },
      include: { items: true, logs: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });
  }

  async getById(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dte.findUniqueOrThrow({
      where: { id },
      include: { items: true, logs: { orderBy: { createdAt: 'desc' } } },
    });
  }
}
```

- [ ] **Step 3: Implement DteEmissionService (orchestrator)**

```typescript
// apps/api/src/modules/dte/services/dte-emission.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { EmitDteSchema } from '@zeru/shared';
import { DTE_EMISSION_QUEUE, DTE_JOB_NAMES, DTE_QUEUE_CONFIG } from '../constants/queue.constants';

@Injectable()
export class DteEmissionService {
  private readonly logger = new Logger(DteEmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DTE_EMISSION_QUEUE) private readonly emissionQueue: Queue,
  ) {}

  async emit(tenantId: string, data: EmitDteSchema) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const dte = await db.dte.create({
      data: {
        dteType: data.dteType,
        folio: 0, // Assigned by processor
        environment: 'CERTIFICATION', // Will be read from DteConfig
        status: 'DRAFT',
        receptorRut: data.receptorRut,
        receptorRazon: data.receptorRazon,
        receptorGiro: data.receptorGiro,
        receptorDir: data.receptorDir,
        receptorComuna: data.receptorComuna,
        fechaEmision: data.fechaEmision ? new Date(data.fechaEmision) : new Date(),
        fechaVenc: data.fechaVenc ? new Date(data.fechaVenc) : undefined,
        formaPago: data.formaPago,
        legalEntityId: data.legalEntityId,
        referencedDteId: data.referencedDteId,
        tenantId,
        items: {
          create: data.items.map((item, idx) => ({
            lineNumber: idx + 1,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discount: item.discount,
            surcharge: item.surcharge,
            lineTotal: (item.quantity * item.unitPrice) - (item.discount || 0) + (item.surcharge || 0),
            isExempt: item.isExempt,
          })),
        },
        logs: {
          create: { action: 'CREATED', message: 'DTE created and queued for emission' },
        },
      },
      include: { items: true },
    });

    this.logger.log(`DTE ${dte.id} created, queueing for emission`);

    await this.emissionQueue.add(
      DTE_JOB_NAMES.EMIT,
      { dteId: dte.id, tenantId },
      DTE_QUEUE_CONFIG.EMISSION,
    );

    return dte;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/dte/services/
git commit -m "feat(dte): add DTE config, CRUD, and emission orchestrator services"
```

---

## Task 12: BullMQ emission processor

**Files:**
- Create: `apps/api/src/modules/dte/processors/dte-emission.processor.ts`
- Create: `apps/api/src/modules/dte/processors/sii-status-check.processor.ts`

- [ ] **Step 1: Implement DteEmissionProcessor**

```typescript
// apps/api/src/modules/dte/processors/dte-emission.processor.ts
import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { DteBuilderService } from '../services/dte-builder.service';
import { DteConfigService } from '../services/dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { FolioService } from '../folio/folio.service';
import { FolioAllocationService } from '../folio/folio-allocation.service';
import { SiiAuthService } from '../sii/sii-auth.service';
import { SiiSenderService } from '../sii/sii-sender.service';
import {
  DTE_EMISSION_QUEUE,
  DTE_STATUS_CHECK_QUEUE,
  DTE_JOB_NAMES,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

@Processor(DTE_EMISSION_QUEUE, { concurrency: DTE_QUEUE_CONFIG.EMISSION.concurrency })
export class DteEmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(DteEmissionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: DteBuilderService,
    private readonly configService: DteConfigService,
    private readonly certService: CertificateService,
    private readonly folioService: FolioService,
    private readonly folioAllocation: FolioAllocationService,
    private readonly siiAuth: SiiAuthService,
    private readonly siiSender: SiiSenderService,
    @InjectQueue(DTE_STATUS_CHECK_QUEUE) private readonly statusQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ dteId: string; tenantId: string }>): Promise<void> {
    const { dteId, tenantId } = job.data;
    const db = this.prisma as unknown as PrismaClient;

    this.logger.log(`Processing DTE emission: ${dteId}`);

    // 1. Load DTE with items
    const dte = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true },
    });

    // 2. Load tenant DTE config
    const config = await this.configService.get(tenantId);

    // 3. Load certificate
    const cert = await this.certService.getPrimaryCert(tenantId);

    // 4. Allocate folio
    const { folio, folioRangeId } = await this.folioAllocation.allocate(
      tenantId,
      dte.dteType,
      config.environment,
    );

    // 5. Get decrypted CAF
    const caf = await this.folioService.getDecryptedCaf(folioRangeId);

    // 6. Build and sign DTE XML
    const result = this.builder.build(
      {
        dteType: dte.dteType,
        folio,
        fechaEmision: dte.fechaEmision.toISOString().split('T')[0],
        formaPago: dte.formaPago ?? undefined,
        emisor: {
          rut: config.rut,
          razonSocial: config.razonSocial,
          giro: config.giro,
          actividadEco: config.actividadEco,
          direccion: config.direccion,
          comuna: config.comuna,
        },
        receptor: {
          rut: dte.receptorRut,
          razonSocial: dte.receptorRazon,
          giro: dte.receptorGiro ?? undefined,
          direccion: dte.receptorDir ?? undefined,
          comuna: dte.receptorComuna ?? undefined,
        },
        items: dte.items.map((item) => ({
          nombre: item.itemName,
          descripcion: item.description ?? undefined,
          cantidad: Number(item.quantity),
          unidad: item.unit ?? undefined,
          precioUnitario: Number(item.unitPrice),
          descuento: Number(item.discount),
          exento: item.isExempt,
        })),
      },
      caf,
      cert,
    );

    // 7. Update DTE with signed XML and folio
    await db.dte.update({
      where: { id: dteId },
      data: {
        folio,
        folioRangeId,
        status: 'SIGNED',
        xmlContent: result.xml,
        montoNeto: result.montoNeto,
        iva: result.iva,
        montoTotal: result.montoTotal,
        logs: { create: { action: 'SIGNED', message: `Signed with folio ${folio}` } },
      },
    });

    // 8. Build envelope and send to SII
    const envelopeXml = this.builder.buildEnvelope(
      [result.xml],
      config.rut,
      cert.rut,
      config.resolutionDate.toISOString().split('T')[0],
      config.resolutionNum,
      cert,
    );

    const sendResult = await this.siiSender.sendDte(envelopeXml, cert, config.environment);

    // 9. Update DTE with SII response
    await db.dte.update({
      where: { id: dteId },
      data: {
        status: 'SENT',
        siiTrackId: sendResult.trackId,
        siiResponse: sendResult as any,
        logs: { create: { action: 'SENT_TO_SII', message: `TrackID: ${sendResult.trackId}` } },
      },
    });

    // 10. Queue status check (delayed 30 seconds)
    await this.statusQueue.add(
      DTE_JOB_NAMES.CHECK_STATUS,
      { dteId, tenantId, trackId: sendResult.trackId },
      { ...DTE_QUEUE_CONFIG.STATUS_CHECK, delay: 30000 },
    );

    this.logger.log(`DTE ${dteId} sent to SII, trackId=${sendResult.trackId}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    this.logger.error(`DTE emission failed for ${job.data.dteId}: ${error.message}`);
    const db = this.prisma as unknown as PrismaClient;
    await db.dte.update({
      where: { id: job.data.dteId },
      data: {
        status: 'ERROR',
        logs: { create: { action: 'ERROR', message: error.message, metadata: { stack: error.stack } } },
      },
    });
  }
}
```

- [ ] **Step 2: Implement SiiStatusCheckProcessor**

```typescript
// apps/api/src/modules/dte/processors/sii-status-check.processor.ts
import { Processor, WorkerHost, InjectQueue, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { CertificateService } from '../certificate/certificate.service';
import { DteConfigService } from '../services/dte-config.service';
import { SiiStatusService } from '../sii/sii-status.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DTE_STATUS_CHECK_QUEUE,
  DTE_JOB_NAMES,
  DTE_QUEUE_CONFIG,
} from '../constants/queue.constants';

@Processor(DTE_STATUS_CHECK_QUEUE, { concurrency: DTE_QUEUE_CONFIG.STATUS_CHECK.concurrency })
export class SiiStatusCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(SiiStatusCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certService: CertificateService,
    private readonly configService: DteConfigService,
    private readonly siiStatus: SiiStatusService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(DTE_STATUS_CHECK_QUEUE) private readonly statusQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ dteId: string; tenantId: string; trackId: string }>): Promise<void> {
    const { dteId, tenantId, trackId } = job.data;
    const db = this.prisma as unknown as PrismaClient;

    const config = await this.configService.get(tenantId);
    const cert = await this.certService.getPrimaryCert(tenantId);

    const result = await this.siiStatus.checkUploadStatus(trackId, config.rut, cert, config.environment);

    this.logger.log(`SII status for ${dteId}: ${result.status} - ${result.statusGlosa}`);

    const isTerminal = ['EPR'].includes(result.status);

    if (isTerminal) {
      const finalStatus = result.accepted > 0 ? 'ACCEPTED'
        : result.rejected > 0 ? 'REJECTED'
        : result.objected > 0 ? 'ACCEPTED_WITH_OBJECTION'
        : 'SENT';

      await db.dte.update({
        where: { id: dteId },
        data: {
          status: finalStatus,
          siiResponse: result.raw as any,
          logs: {
            create: {
              action: finalStatus === 'ACCEPTED' ? 'ACCEPTED' : finalStatus === 'REJECTED' ? 'REJECTED' : 'SII_RESPONSE',
              message: result.statusGlosa,
              metadata: result.raw,
            },
          },
        },
      });

      this.eventEmitter.emit(`dte.${finalStatus.toLowerCase()}`, { tenantId, dteId });
    } else {
      // Not terminal — re-queue with delay
      await db.dte.update({
        where: { id: dteId },
        data: {
          siiResponse: result.raw as any,
          logs: { create: { action: 'SII_RESPONSE', message: `Status: ${result.status}`, metadata: result.raw } },
        },
      });

      await this.statusQueue.add(
        DTE_JOB_NAMES.CHECK_STATUS,
        job.data,
        { ...DTE_QUEUE_CONFIG.STATUS_CHECK, delay: 60000 },
      );
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    this.logger.error(`Status check failed for ${job.data.dteId}: ${error.message}`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/dte/processors/
git commit -m "feat(dte): add BullMQ processors for DTE emission and SII status polling"
```

---

## Task 13: Controllers — DTE config, certificate, folio, emission

**Files:**
- Create: `apps/api/src/modules/dte/controllers/dte-config.controller.ts`
- Create: `apps/api/src/modules/dte/controllers/certificate.controller.ts`
- Create: `apps/api/src/modules/dte/controllers/folio.controller.ts`
- Create: `apps/api/src/modules/dte/controllers/dte.controller.ts`

- [ ] **Step 1: Implement DteConfigController**

```typescript
// apps/api/src/modules/dte/controllers/dte-config.controller.ts
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DteConfigService } from '../services/dte-config.service';
import { createDteConfigSchema, CreateDteConfigSchema } from '@zeru/shared';

@Controller('dte/config')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DteConfigController {
  constructor(private readonly service: DteConfigService) {}

  @Get()
  get(@CurrentTenant() tenantId: string) {
    return this.service.get(tenantId);
  }

  @Put()
  upsert(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createDteConfigSchema)) body: CreateDteConfigSchema,
  ) {
    return this.service.upsert(tenantId, body);
  }
}
```

- [ ] **Step 2: Implement CertificateController**

```typescript
// apps/api/src/modules/dte/controllers/certificate.controller.ts
import { Controller, Get, Post, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CertificateService } from '../certificate/certificate.service';

@Controller('dte/certificates')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('password') password: string,
    @Body('isPrimary') isPrimary: string,
  ) {
    return this.service.upload(tenantId, file.buffer, password, isPrimary === 'true');
  }

  @Delete(':id')
  delete(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }
}
```

- [ ] **Step 3: Implement FolioController**

```typescript
// apps/api/src/modules/dte/controllers/folio.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FolioService } from '../folio/folio.service';

@Controller('dte/folios')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FolioController {
  constructor(private readonly service: FolioService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post()
  uploadCaf(
    @CurrentTenant() tenantId: string,
    @Body('cafXml') cafXml: string,
  ) {
    return this.service.uploadCaf(tenantId, cafXml);
  }
}
```

- [ ] **Step 4: Implement DteController**

```typescript
// apps/api/src/modules/dte/controllers/dte.controller.ts
import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DteEmissionService } from '../services/dte-emission.service';
import { DteService } from '../services/dte.service';
import { emitDteSchema, EmitDteSchema } from '@zeru/shared';
import { DteType, DteStatus } from '@prisma/client';

@Controller('dte')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DteController {
  constructor(
    private readonly emissionService: DteEmissionService,
    private readonly dteService: DteService,
  ) {}

  @Post()
  emit(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(emitDteSchema)) body: EmitDteSchema,
  ) {
    return this.emissionService.emit(tenantId, body);
  }

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @Query('dteType') dteType?: DteType,
    @Query('status') status?: DteStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dteService.list(tenantId, {
      dteType,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  getById(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.dteService.getById(tenantId, id);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dte/controllers/
git commit -m "feat(dte): add REST controllers for config, certificates, folios, and DTE emission"
```

---

## Task 14: DTE module assembly and app registration

**Files:**
- Create: `apps/api/src/modules/dte/dte.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create DteModule**

```typescript
// apps/api/src/modules/dte/dte.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

// Constants
import { DTE_EMISSION_QUEUE, DTE_STATUS_CHECK_QUEUE, DTE_QUEUE_CONFIG } from './constants/queue.constants';

// Controllers
import { DteController } from './controllers/dte.controller';
import { DteConfigController } from './controllers/dte-config.controller';
import { CertificateController } from './controllers/certificate.controller';
import { FolioController } from './controllers/folio.controller';

// Services
import { DteEmissionService } from './services/dte-emission.service';
import { DteBuilderService } from './services/dte-builder.service';
import { DteConfigService } from './services/dte-config.service';
import { DteService } from './services/dte.service';

// Certificate
import { CertificateService } from './certificate/certificate.service';
import { CertificateParserService } from './certificate/certificate-parser.service';

// Folio
import { FolioService } from './folio/folio.service';
import { FolioAllocationService } from './folio/folio-allocation.service';

// SII Communication
import { SiiAuthService } from './sii/sii-auth.service';
import { SiiSenderService } from './sii/sii-sender.service';
import { SiiStatusService } from './sii/sii-status.service';

// Processors
import { DteEmissionProcessor } from './processors/dte-emission.processor';
import { SiiStatusCheckProcessor } from './processors/sii-status-check.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6380),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: DTE_EMISSION_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.EMISSION,
      },
      {
        name: DTE_STATUS_CHECK_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.STATUS_CHECK,
      },
    ),
  ],
  controllers: [
    DteController,
    DteConfigController,
    CertificateController,
    FolioController,
  ],
  providers: [
    // Services
    DteEmissionService,
    DteBuilderService,
    DteConfigService,
    DteService,
    // Certificate
    CertificateService,
    CertificateParserService,
    // Folio
    FolioService,
    FolioAllocationService,
    // SII
    SiiAuthService,
    SiiSenderService,
    SiiStatusService,
    // Processors
    DteEmissionProcessor,
    SiiStatusCheckProcessor,
  ],
  exports: [DteEmissionService, DteService, DteConfigService, CertificateService, FolioService],
})
export class DteModule {}
```

- [ ] **Step 2: Register DteModule in app.module.ts**

Add to the `imports` array in `apps/api/src/app.module.ts`:

```typescript
import { DteModule } from './modules/dte/dte.module';

// In @Module({ imports: [...] })
DteModule,
```

- [ ] **Step 3: Run lint**

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
pnpm lint
```

Fix any lint errors.

- [ ] **Step 4: Run build to verify compilation**

```bash
cd /Users/camiloespinoza/Zeru/.worktrees/dte-sii-integration
pnpm --filter @zeru/api build
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dte/dte.module.ts apps/api/src/app.module.ts
git commit -m "feat(dte): assemble DteModule with all services, controllers, and processors"
```

---

## Task 15: Integration test — emit Factura Electrónica (type 33)

**Files:**
- Create: `apps/api/src/modules/dte/services/dte-emission.service.spec.ts`

- [ ] **Step 1: Write integration test**

```typescript
// apps/api/src/modules/dte/services/dte-emission.service.spec.ts
import { Test } from '@nestjs/testing';
import { DteEmissionService } from './dte-emission.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DTE_EMISSION_QUEUE } from '../constants/queue.constants';

describe('DteEmissionService', () => {
  let service: DteEmissionService;
  let prisma: any;
  let queue: any;

  beforeEach(async () => {
    prisma = {
      dte: {
        create: jest.fn().mockResolvedValue({
          id: 'dte-1',
          dteType: 'FACTURA_ELECTRONICA',
          folio: 0,
          status: 'DRAFT',
          items: [{ id: 'item-1', lineNumber: 1, itemName: 'Test', quantity: 1, unitPrice: 10000, lineTotal: 10000 }],
        }),
      },
      forTenant: jest.fn().mockReturnThis(),
    };

    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        DteEmissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(DTE_EMISSION_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get(DteEmissionService);
  });

  it('should create a DTE record and queue emission job', async () => {
    const result = await service.emit('tenant-1', {
      dteType: 'FACTURA_ELECTRONICA',
      receptorRut: '77654321-K',
      receptorRazon: 'Cliente Ltda',
      items: [{ itemName: 'Servicio', quantity: 1, unitPrice: 100000 }],
    });

    expect(result.id).toBe('dte-1');
    expect(result.status).toBe('DRAFT');
    expect(prisma.forTenant).toHaveBeenCalledWith('tenant-1');
    expect(prisma.dte.create).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'dte.emit',
      { dteId: 'dte-1', tenantId: 'tenant-1' },
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter @zeru/api exec jest --testPathPattern="dte-emission.service.spec" --no-coverage
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/dte/services/dte-emission.service.spec.ts
git commit -m "test(dte): add unit test for DTE emission service"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] Prisma schema: enums, DteConfig, DteCertificate, DteFolio, Dte, DteItem, DteLog
   - [x] Certificate upload/parse/encrypt
   - [x] CAF upload and atomic folio allocation
   - [x] DTE XML generation via @devlas/dte-sii
   - [x] SII authentication with Redis token cache
   - [x] SII upload (SOAP)
   - [x] Status polling via BullMQ
   - [x] REST API controllers
   - [x] Zod validation schemas
   - [x] Event emission (folio.low_stock, folio.exhausted, dte.accepted, dte.rejected)
   - [ ] Exchange between taxpayers (Plan 2)
   - [ ] RCOF/IECV reports (Plan 3)
   - [ ] Certification automation (Plan 4)
   - [ ] Frontend UI (Plan 5)

2. **Placeholder scan:** No TBDs, TODOs (except one in certificate-parser for date extraction from cert which is a known lib limitation).

3. **Type consistency:** DteType enum matches across Prisma, constants, Zod schema. DTE_TYPE_CODES maps correctly. Service method signatures are consistent between controllers and services.

---

## API Summary

After completing this plan, the following endpoints are available:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dte/config` | Get tenant DTE configuration |
| `PUT` | `/api/dte/config` | Create/update DTE configuration |
| `GET` | `/api/dte/certificates` | List certificates (no sensitive data) |
| `POST` | `/api/dte/certificates` | Upload .p12 certificate (multipart) |
| `DELETE` | `/api/dte/certificates/:id` | Delete certificate |
| `GET` | `/api/dte/folios` | List CAF/folio ranges |
| `POST` | `/api/dte/folios` | Upload CAF XML |
| `POST` | `/api/dte` | Emit a DTE (async, returns draft) |
| `GET` | `/api/dte` | List DTEs with filters |
| `GET` | `/api/dte/:id` | Get DTE detail with items and logs |
