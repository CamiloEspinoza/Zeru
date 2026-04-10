# UI for Imported FM Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build read-only UI for the 4,482 records imported from FileMaker (LegalEntities, BillingAgreements, LabOrigins, BillingConcepts, BillingAgreementLines), exposing 4 list pages and 3 detail pages — `/clients`, `/laboratory/origins`, `/collections/agreements`, `/settings/billing-concepts`.

**Architecture:** Read-only Next.js client-side pages following the monolithic `page.tsx` pattern used in `accounting/journal` and `accounting/chart-of-accounts`. Client fetches the full list once, filters/searches in-memory using `useDebouncedSearch` + `usePagination`. Detail pages use shadcn `Tabs` + URL `?tab=` state. All data sources are existing NestJS endpoints under `/legal-entities`, `/lab-origins`, `/billing-agreements`, `/billing-concepts`. Backend services need 7 P0 changes before frontend can land (security FTP fix, expanded `findById` includes, count selectors).

**Tech Stack:**
- Backend: NestJS 11, Prisma 7, PostgreSQL (multi-tenant via row-level), `@nestjs/event-emitter`
- Frontend: Next.js 16 (App Router, RSC + client islands), React 19, shadcn/ui (radix-ui), TailwindCSS v4, Hugeicons
- Shared: `@zeru/shared` (Zod schemas, types, formatters, permissions)

**Spec reference:** `docs/superpowers/specs/2026-04-07-fm-data-ui-consolidated.md`

---

## Conventions used throughout this plan

- **Tenant resolution in pages**: every page reads tenantId via `const { tenant } = useTenantContext(); const tenantId = tenant?.id ?? localStorage.getItem("tenantId");`. The canonical localStorage key is `tenantId` (camelCase) — the api-client falls back to this. Some legacy pages use `tenant_id` (snake_case); do **not** copy that pattern in new code.
- **API client**: `import { api } from "@/lib/api-client"` — `api.get<T>(url, { tenantId })` returns `T` directly (no `{ data, meta }` envelope unless the controller wraps it; the FM endpoints in scope here do not wrap).
- **Decimal serialization**: Prisma `Decimal` columns (`negotiatedPrice`, `referencePrice`, `factor`) come over the wire as **strings**. Always pass through `formatCLP` (which now accepts `string | number`).
- **Status labels**: `BillingAgreementStatus.ACTIVE → "Vigente"`, `EXPIRED → "Expirado"`, `DRAFT → "Borrador"`. Do not invent other labels.
- **Tab default**: client detail → `convenios`; convenio detail → `lineas`. Read from `?tab=` via `useSearchParams`, write via `router.replace`.
- **Search normalization**: lowercase + NFD strip-accents for both haystack and needle: `s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()`.
- **Click row → navigate**: `<tr className="cursor-pointer" onClick={() => router.push(...)}>`. Inner links must call `e.stopPropagation()` in `onClick`.
- **FM read-only banner**: every detail page renders an `<Alert>` with text `Datos sincronizados desde FileMaker. Las ediciones se realizan en FM.` Same copy everywhere.
- **Suspense wrapping**: Pages that read `useSearchParams` must wrap their content in `<Suspense>` (matches `accounting/journal` pattern).
- **No tests for pages or services in this codebase**: there is no `*.spec.ts` for any module-level service. Verification is `pnpm lint` + manual smoke test. Do **not** invent a test framework here.
- **Lint is mandatory** before every commit (project rule in `CLAUDE.md`).

---

## File Structure

### Created
| Path | Responsibility |
|---|---|
| `apps/web/lib/enum-labels.ts` | All enum→Spanish-label maps shared by FM data pages |
| `apps/web/components/ui/alert.tsx` | shadcn `Alert` (added via shadcn CLI) |
| `apps/web/app/(dashboard)/clients/[id]/page.tsx` | Client detail page (tabs: Convenios, Procedencias, Datos Generales, Contactos) |
| `apps/web/app/(dashboard)/laboratory/origins/page.tsx` | Procedencias list |
| `apps/web/app/(dashboard)/laboratory/origins/[id]/page.tsx` | Procedencia detail (flat cards, no tabs) |
| `apps/web/app/(dashboard)/collections/agreements/page.tsx` | Convenios list |
| `apps/web/app/(dashboard)/collections/agreements/[id]/page.tsx` | Convenio detail (tabs: Líneas, Datos Generales, Contactos, Procedencias) |
| `apps/web/app/(dashboard)/settings/billing-concepts/page.tsx` | Catálogo CDC list |

### Modified
| Path | Change |
|---|---|
| `apps/api/src/modules/legal-entities/legal-entities.service.ts` | Add `billingAgreements` count to `findAll`; expand `findById` to include lines + billing contacts |
| `apps/api/src/modules/lab-origins/lab-origins.service.ts` | Switch `findAll` and `findById` to explicit `select` to exclude `encryptedFtp*`; expose `hasFtp*` booleans; include `children` in detail |
| `apps/api/src/modules/billing/billing-agreements.service.ts` | Switch `findAll` to explicit `select` (drop `operationalFlags`, `notes`); expand `findById` line + contact projection |
| `packages/shared/src/utils/currency.ts` | `formatCLP` accepts `number \| string` |
| `packages/shared/src/permissions/module-definitions.ts` | Add `lab-origins` module; add `/laboratory/origins` to `ROUTE_MODULE_MAP` |
| `apps/web/components/layouts/nav-main.tsx` | Add Procedencias under Laboratorio; Convenios as Cobranzas child; Catálogo CDC in settings nav |
| `apps/web/components/layouts/breadcrumbs.tsx` | Add labels for `origins`, `agreements`, `billing-concepts`; UUID resolvers for `clients`, `origins`, `agreements` |
| `apps/web/app/(dashboard)/clients/page.tsx` | Replace placeholder with full list page |

### Total: 8 created + 8 modified = 16 files

---

## Phase 1 — Backend P0 changes

These must land first. Frontend pages depend on the response shapes defined here.

### Task 1: Extend `formatCLP` in `@zeru/shared` to accept `number | string`

**Files:**
- Modify: `packages/shared/src/utils/currency.ts`

- [ ] **Step 1: Update `formatCLP` signature and body**

Replace the current implementation in `packages/shared/src/utils/currency.ts`:

```typescript
/**
 * Formats a number as Chilean Pesos (CLP).
 * Accepts strings (e.g., Prisma Decimal serialized as JSON) and numbers.
 * Invalid / NaN inputs render as "$0".
 */
export function formatCLP(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

/**
 * Parses a CLP-formatted string back to a number.
 */
export function parseCLP(formatted: string): number {
  return parseInt(formatted.replace(/[^0-9-]/g, ''), 10) || 0;
}
```

- [ ] **Step 2: Verify build of shared package**

Run: `pnpm --filter @zeru/shared build`
Expected: exits 0, no type errors. (`formatCLP` is already re-exported via `packages/shared/src/index.ts:20`.)

- [ ] **Step 3: Verify no existing callers break**

Run: `pnpm --filter @zeru/shared --filter @zeru/api --filter @zeru/web lint 2>&1 | grep -E "(error|Cannot find|TS)" | head -30`
Expected: zero errors related to `formatCLP`. The widened input type is a non-breaking superset.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/utils/currency.ts
git commit -m "$(cat <<'EOF'
feat(shared): formatCLP accepts string or number

Prisma Decimals serialize as strings in JSON responses. Widening
the input type lets frontend code drop ad-hoc Number(...) wrappers
when rendering BillingAgreementLine prices.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Register `lab-origins` module in permissions

**Files:**
- Modify: `packages/shared/src/permissions/module-definitions.ts`

- [ ] **Step 1: Add `lab-origins` to MODULE_DEFINITIONS**

In `packages/shared/src/permissions/module-definitions.ts`, inside the `MODULE_DEFINITIONS` array, add a new entry inside the `Laboratorio` group (right after the `lab-coding` block, before the `Marketing` comment):

```typescript
  {
    key: 'lab-origins',
    label: 'Procedencias',
    section: 'laboratory',
    granularPermissions: [],
  },
```

- [ ] **Step 2: Add the route to ROUTE_MODULE_MAP**

In the `ROUTE_MODULE_MAP` object at the bottom of the same file, add the new route. The map is currently keyed by deep paths, so add immediately after `'/laboratory/coding'`:

```typescript
  '/laboratory/origins': 'lab-origins',
```

- [ ] **Step 3: Build shared and verify**

Run: `pnpm --filter @zeru/shared build`
Expected: exits 0. The exported `MODULE_DEFINITIONS` length now equals the previous count + 1.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/permissions/module-definitions.ts
git commit -m "$(cat <<'EOF'
feat(permissions): register lab-origins module

Adds Procedencias as a permission-gated module under Laboratorio
so the new /laboratory/origins page is visible per-tenant via the
existing usePermissions/canAccess flow.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Expand `LegalEntitiesService.findAll` with `billingAgreements` count

**Files:**
- Modify: `apps/api/src/modules/legal-entities/legal-entities.service.ts:15-21`

- [ ] **Step 1: Update `findAll` to include both counts**

Replace the body of `findAll` (lines 15–21 of `apps/api/src/modules/legal-entities/legal-entities.service.ts`):

```typescript
  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.legalEntity.findMany({
      orderBy: { legalName: 'asc' },
      include: {
        _count: { select: { labOrigins: true, billingAgreements: true } },
      },
    });
  }
```

- [ ] **Step 2: Run lint on the api package**

Run: `pnpm --filter @zeru/api lint`
Expected: exits 0, no errors.

- [ ] **Step 3: Smoke-test the endpoint manually**

Run (after starting `pnpm --filter @zeru/api dev` in another shell):
```bash
curl -s -H "x-tenant-id: <a-known-tenant-id>" -H "Authorization: Bearer <token>" \
  http://localhost:3017/api/legal-entities | jq '.[0]._count'
```
Expected: JSON object with both `labOrigins` and `billingAgreements` keys.

If you don't have a token at hand, skip the curl and trust the type-checker — the change is mechanical.

- [ ] **Step 4: Commit (deferred, see Task 7)**

Hold off — bundle Tasks 3-6 into a single backend commit at Task 7.

---

### Task 4: Expand `LegalEntitiesService.findById` with full convenio detail

**Files:**
- Modify: `apps/api/src/modules/legal-entities/legal-entities.service.ts:23-36`

- [ ] **Step 1: Replace `findById` body**

Replace lines 23–36 (the entire `findById` method) with:

```typescript
  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await client.legalEntity.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        },
        bankAccounts: { where: { isActive: true } },
        labOrigins: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            commune: true,
            city: true,
          },
        },
        billingAgreements: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            paymentTerms: true,
            customPaymentDays: true,
            billingDayOfMonth: true,
            billingModalities: true,
            isMonthlySettlement: true,
            effectiveFrom: true,
            effectiveTo: true,
            contractDate: true,
            _count: { select: { lines: true, contacts: true, labOrigins: true } },
            lines: {
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                factor: true,
                negotiatedPrice: true,
                referencePrice: true,
                currency: true,
                billingConcept: { select: { id: true, code: true, name: true } },
              },
            },
            contacts: {
              where: { isActive: true },
              orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
            },
          },
        },
      },
    });
    if (!entity) throw new NotFoundException(`LegalEntity ${id} not found`);
    return entity;
  }
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/api lint`
Expected: exits 0.

- [ ] **Step 3: No commit yet**

Bundle with Task 7.

---

### Task 5: Secure `LabOriginsService.findAll` — explicit select, exclude FTP ciphertext

**Files:**
- Modify: `apps/api/src/modules/lab-origins/lab-origins.service.ts:14-25`

This is a **security fix**. The current `findAll` uses `include`, which (per Prisma semantics) returns every column on `LabOrigin`, including `encryptedFtpHost`, `encryptedFtpUser`, `encryptedFtpPassword`. Even though they're encrypted, exposing 862 ciphertext blobs to every authenticated user is unnecessary.

- [ ] **Step 1: Replace `findAll` body**

Replace lines 14–25:

```typescript
  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.labOrigin.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        commune: true,
        city: true,
        phone: true,
        email: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        legalEntityId: true,
        billingAgreementId: true,
        parentId: true,
        sampleReceptionMode: true,
        reportDeliveryMethods: true,
        deliveryDaysBiopsy: true,
        deliveryDaysPap: true,
        sendsQualityReports: true,
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        billingAgreement: { select: { id: true, code: true, name: true, status: true } },
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true } },
      },
    });
  }
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/api lint`
Expected: exits 0.

- [ ] **Step 3: No commit yet**

Bundle with Task 7.

---

### Task 6: Mask FTP fields in `LabOriginsService.findById`

**Files:**
- Modify: `apps/api/src/modules/lab-origins/lab-origins.service.ts:27-40`

- [ ] **Step 1: Replace `findById` body — explicit select with FTP boolean derivation**

Replace lines 27–40 with the new implementation that uses an explicit `select` and post-processes the result so the response carries `hasFtpHost`, `hasFtpUser`, `hasFtpPassword` instead of the ciphertext:

```typescript
  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        legalEntityId: true,
        parentId: true,
        billingAgreementId: true,
        street: true,
        streetNumber: true,
        unit: true,
        commune: true,
        city: true,
        phone: true,
        email: true,
        sampleReceptionMode: true,
        reportDeliveryMethods: true,
        deliveryDaysBiopsy: true,
        deliveryDaysPap: true,
        deliveryDaysCytology: true,
        deliveryDaysIhc: true,
        deliveryDaysDefault: true,
        ftpPath: true,
        encryptedFtpHost: true,
        encryptedFtpUser: true,
        encryptedFtpPassword: true,
        criticalNotificationEmails: true,
        sendsQualityReports: true,
        receptionDays: true,
        receptionSchedule: true,
        notes: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        billingAgreement: { select: { id: true, code: true, name: true, status: true } },
        parent: { select: { id: true, code: true, name: true } },
        children: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, name: true, category: true },
        },
      },
    });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);

    const {
      encryptedFtpHost,
      encryptedFtpUser,
      encryptedFtpPassword,
      ...rest
    } = origin;
    return {
      ...rest,
      hasFtpHost: encryptedFtpHost !== null && encryptedFtpHost !== '',
      hasFtpUser: encryptedFtpUser !== null && encryptedFtpUser !== '',
      hasFtpPassword: encryptedFtpPassword !== null && encryptedFtpPassword !== '',
    };
  }
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/api lint`
Expected: exits 0.

- [ ] **Step 3: No commit yet**

Bundle with Task 7.

---

### Task 7: Trim `BillingAgreementsService.findAll` response

**Files:**
- Modify: `apps/api/src/modules/billing/billing-agreements.service.ts:19-28`

- [ ] **Step 1: Replace `findAll` body with explicit select**

Replace lines 19–28:

```typescript
  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.billingAgreement.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        paymentTerms: true,
        customPaymentDays: true,
        billingDayOfMonth: true,
        isMonthlySettlement: true,
        billingModalities: true,
        contractDate: true,
        effectiveFrom: true,
        effectiveTo: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        legalEntityId: true,
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        _count: { select: { lines: true, contacts: true, labOrigins: true } },
      },
    });
  }
```

`operationalFlags` (Json) and `notes` are dropped from the list payload. They remain available on `findById`.

- [ ] **Step 2: Lint and build api**

Run: `pnpm --filter @zeru/api lint && pnpm --filter @zeru/api build`
Expected: both exit 0.

- [ ] **Step 3: Commit Tasks 3-7 together**

```bash
git add apps/api/src/modules/legal-entities/legal-entities.service.ts \
        apps/api/src/modules/lab-origins/lab-origins.service.ts \
        apps/api/src/modules/billing/billing-agreements.service.ts
git commit -m "$(cat <<'EOF'
feat(api): expand FM-data list/detail responses for UI

- LegalEntities.findAll: include billingAgreements count
- LegalEntities.findById: include lines + billing contacts on each
  agreement so the client detail Convenios tab can render fully
- LabOrigins.findAll/findById: switch to explicit select; exclude
  encryptedFtp* ciphertext fields. findById now returns hasFtp*
  booleans instead.
- BillingAgreements.findAll: explicit select drops operationalFlags
  (Json) and notes from the list payload.

Security: removes 862 ciphertext blobs from the procedencias list
response. Future admin-only endpoint can decrypt server-side.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Frontend infrastructure

### Task 8: Add shadcn `Alert` component

**Files:**
- Create: `apps/web/components/ui/alert.tsx`

- [ ] **Step 1: Add the Alert component via shadcn CLI**

Run from the repo root:
```bash
pnpm --filter @zeru/web dlx shadcn@latest add alert
```
Expected: creates `apps/web/components/ui/alert.tsx`. Answer "yes" to any overwrite prompts only if you understand what you're overwriting (there should be no existing `alert.tsx`, only `alert-dialog.tsx`).

- [ ] **Step 2: Verify the file exists and exports `Alert`, `AlertTitle`, `AlertDescription`**

Run: `pnpm dlx --silent ls apps/web/components/ui/alert.tsx`
Expected: file path printed. Open the file: it should export at least `Alert`, `AlertDescription`, and use `cva` + `cn` from `@/lib/utils`.

- [ ] **Step 3: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/alert.tsx apps/web/components.json 2>/dev/null || true
git add apps/web/components/ui/alert.tsx
git commit -m "$(cat <<'EOF'
chore(web): add shadcn Alert component

Used by all FM-data detail pages to render the read-only banner
"Datos sincronizados desde FileMaker."

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Create `apps/web/lib/enum-labels.ts`

**Files:**
- Create: `apps/web/lib/enum-labels.ts`

- [ ] **Step 1: Create the file with all enum maps**

Create `apps/web/lib/enum-labels.ts` with this exact content:

```typescript
/**
 * Spanish label maps for FM-imported enums.
 * Use these everywhere FM data is rendered to keep labels consistent.
 */

export const STATUS_LABELS = {
  ACTIVE: "Vigente",
  EXPIRED: "Expirado",
  DRAFT: "Borrador",
} as const;

export const STATUS_BADGE_VARIANT = {
  ACTIVE: "default",
  EXPIRED: "outline",
  DRAFT: "secondary",
} as const;

export const PAYMENT_TERMS_LABELS = {
  IMMEDIATE: "Contado",
  NET_15: "15 días",
  NET_30: "30 días",
  NET_45: "45 días",
  NET_60: "60 días",
  NET_90: "90 días",
  CUSTOM: "Personalizado",
} as const;

export const MODALITY_LABELS = {
  MONTHLY_SETTLEMENT: "Liquidación mensual",
  FONASA_VOUCHER: "Bono FONASA",
  ISAPRE_VOUCHER: "Bono ISAPRE",
  CASH: "Efectivo",
  CHECK: "Cheque",
  BANK_TRANSFER: "Transferencia",
  OTHER: "Otra",
} as const;

export const CATEGORY_LABELS = {
  CONSULTA: "Consulta",
  CENTRO_MEDICO: "Centro médico",
  CLINICA_HOSPITAL: "Clínica / Hospital",
  LABORATORIO: "Laboratorio",
  OTRO: "Otro",
} as const;

export const RECEPTION_MODE_LABELS = {
  PRESENCIAL: "Presencial",
  COURIER: "Courier",
  AMBAS: "Ambas",
} as const;

export const DELIVERY_METHOD_LABELS = {
  WEB: "Portal web",
  IMPRESO: "Impreso",
  FTP: "FTP",
  EMAIL: "Email",
} as const;

export type StatusKey = keyof typeof STATUS_LABELS;
export type PaymentTermsKey = keyof typeof PAYMENT_TERMS_LABELS;
export type ModalityKey = keyof typeof MODALITY_LABELS;
export type CategoryKey = keyof typeof CATEGORY_LABELS;
export type ReceptionModeKey = keyof typeof RECEPTION_MODE_LABELS;
export type DeliveryMethodKey = keyof typeof DELIVERY_METHOD_LABELS;
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 3: Commit (with Tasks 10-11 below as one infra commit)**

Hold off.

---

### Task 10: Update sidebar `nav-main.tsx`

**Files:**
- Modify: `apps/web/components/layouts/nav-main.tsx`

- [ ] **Step 1: Add Procedencias under Laboratorio**

In the `Laboratorio` section's `items` array (around line 146–151), add a new entry **after** `lab-coding` and **before** the closing bracket:

```typescript
      { title: "Procedencias", href: "/laboratory/origins", icon: Building03Icon, moduleKey: "lab-origins" },
```

(Reuse `Building03Icon` which is already imported at the top of the file.)

- [ ] **Step 2: Add Convenios as a child of Cobranzas**

In the `Negocio` section, the existing Cobranzas entry (around lines 93–102) declares its children inline. Replace that block:

```typescript
      {
        title: "Cobranzas",
        href: "/collections",
        icon: MoneyReceive01Icon,
        moduleKey: "collections",
        items: [
          { title: "Convenios", href: "/collections/agreements" },
          { title: "Liquidaciones", href: "/collections/liquidations" },
          { title: "Seguimiento", href: "/collections/tracking" },
        ],
      },
```

- [ ] **Step 3: Add Catálogo CDC to settingsNav**

In the `settingsNav` array (around line 187–203), insert after the "Proceso Contable" line:

```typescript
  { title: "Catálogo CDC", href: "/settings/billing-concepts", icon: Dollar02Icon },
```

`Dollar02Icon` is already imported at the top of the file.

- [ ] **Step 4: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

---

### Task 11: Update breadcrumbs labels and UUID resolvers

**Files:**
- Modify: `apps/web/components/layouts/breadcrumbs.tsx`

- [ ] **Step 1: Add new label keys**

In the `LABELS` object (around lines 16–61), add these entries (anywhere alphabetically; group near related ones):

```typescript
  origins: "Procedencias",
  agreements: "Convenios",
  "billing-concepts": "Catálogo CDC",
```

(`clients`, `collections`, `laboratory` already exist.)

- [ ] **Step 2: Add UUID resolvers**

In the `resolveUuid` function (around lines 69–97), add three new `case` branches inside the `switch`:

```typescript
      case "clients": {
        const res = await api.get<{ legalName: string }>(`/legal-entities/${uuid}`);
        return res.legalName ?? null;
      }
      case "origins": {
        const res = await api.get<{ name: string }>(`/lab-origins/${uuid}`);
        return res.name ?? null;
      }
      case "agreements": {
        const res = await api.get<{ name: string }>(`/billing-agreements/${uuid}`);
        return res.name ?? null;
      }
```

Place them before the `default` branch.

- [ ] **Step 3: Lint and build web**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 4: Commit Tasks 9-11 as one infra commit**

```bash
git add apps/web/lib/enum-labels.ts \
        apps/web/components/layouts/nav-main.tsx \
        apps/web/components/layouts/breadcrumbs.tsx
git commit -m "$(cat <<'EOF'
feat(web): FM data UI shared infra (enum labels, nav, breadcrumbs)

- New enum-labels.ts: STATUS / PAYMENT_TERMS / MODALITY / CATEGORY /
  RECEPTION_MODE / DELIVERY_METHOD label maps in Spanish
- nav-main: Procedencias under Laboratorio, Convenios under
  Cobranzas, Catálogo CDC in settings
- breadcrumbs: labels + UUID resolvers for clients/origins/agreements

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Catálogo CDC (validates end-to-end)

### Task 12: Create `/settings/billing-concepts/page.tsx`

**Files:**
- Create: `apps/web/app/(dashboard)/settings/billing-concepts/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/app/(dashboard)/settings/billing-concepts/page.tsx` with:

```tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { usePagination } from "@/hooks/use-pagination";

interface BillingConcept {
  id: string;
  code: string;
  name: string;
  description: string | null;
  referencePrice: string;
  currency: string;
  isActive: boolean;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function CatalogPageContent() {
  const { tenant } = useTenantContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const initialSearch = searchParams.get("search") ?? "";

  const [concepts, setConcepts] = useState<BillingConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, debouncedSearch, setSearch } = useDebouncedSearch(300);
  const { page, perPage, setPage } = usePagination(initialPage, 20);

  // Seed search from URL on first render
  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist page + search to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, page, pathname, router]);

  // Reset page to 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, setPage]);

  const fetchConcepts = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<BillingConcept[]>("/billing-concepts", { tenantId })
      .then(setConcepts)
      .catch((err) => setError(err.message ?? "Error al cargar conceptos"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchConcepts, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!debouncedSearch) return concepts;
    const needle = normalize(debouncedSearch);
    return concepts.filter((c) => {
      const haystack = normalize(`${c.code} ${c.name}`);
      return haystack.includes(needle);
    });
  }, [concepts, debouncedSearch]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Catálogo CDC</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">No se pudieron cargar los conceptos</p>
            <Button variant="outline" onClick={fetchConcepts}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogo CDC</h1>
        <p className="text-sm text-muted-foreground">
          Códigos FONASA y precios de referencia. Datos sincronizados desde FileMaker.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Conceptos</CardTitle>
            <Input
              placeholder="Buscar por código o nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Código</th>
                      <th className="text-left py-2 px-3 font-medium">Nombre</th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Descripción
                      </th>
                      <th className="text-right py-2 px-3 font-medium">Precio referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <TooltipProvider delayDuration={200}>
                      {visible.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 px-3 font-mono">{c.code}</td>
                          <td className="py-2 px-3">{c.name}</td>
                          <td className="py-2 px-3 hidden md:table-cell text-muted-foreground">
                            {c.description ? (
                              c.description.length > 60 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                      {c.description.slice(0, 60)}…
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {c.description}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                c.description
                              )
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatCLP(c.referencePrice)}
                          </td>
                        </tr>
                      ))}
                    </TooltipProvider>
                  </tbody>
                </table>
              </div>

              {total === 0 && !loading && (
                <p className="text-muted-foreground py-8 text-center">
                  {debouncedSearch
                    ? `Sin resultados para "${debouncedSearch}"`
                    : "No hay conceptos cargados."}
                </p>
              )}

              {total > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {from}–{to} de {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(safePage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingConceptsPage() {
  return (
    <Suspense>
      <CatalogPageContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify Tooltip exists in shadcn**

Run: `pnpm dlx --silent ls apps/web/components/ui/tooltip.tsx`
Expected: file exists. If it does NOT exist, run `pnpm --filter @zeru/web dlx shadcn@latest add tooltip` first, then continue.

- [ ] **Step 3: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 4: Smoke test in browser**

Start `pnpm dev` (or rely on running dev server). Open `http://localhost:3000/settings/billing-concepts`. Verify:
- Page loads with list of concepts
- Search box filters in real-time
- Pagination shows "Mostrando 1–20 de N"
- Empty search renders all rows
- Long descriptions show tooltip on hover

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/billing-concepts/page.tsx
# If tooltip was added in step 2:
git add apps/web/components/ui/tooltip.tsx 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat(web): Catálogo CDC list page

Read-only billing concepts list with search by code/name,
client-side pagination (20/page), URL state for page+search,
and tooltip on truncated descriptions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Procedencias

### Task 13: Create `/laboratory/origins/page.tsx`

**Files:**
- Create: `apps/web/app/(dashboard)/laboratory/origins/page.tsx`

- [ ] **Step 1: Create the list page**

```tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { usePagination } from "@/hooks/use-pagination";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  type CategoryKey,
  type StatusKey,
} from "@/lib/enum-labels";

interface LabOriginRow {
  id: string;
  code: string;
  name: string;
  category: CategoryKey;
  commune: string | null;
  city: string | null;
  isActive: boolean;
  reportDeliveryMethods: string[];
  legalEntity: { id: string; rut: string; legalName: string } | null;
  billingAgreement: { id: string; code: string; name: string; status: StatusKey } | null;
  parent: { id: string; code: string; name: string } | null;
  _count: { children: number };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function OriginsListContent() {
  const { tenant } = useTenantContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [origins, setOrigins] = useState<LabOriginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, debouncedSearch, setSearch } = useDebouncedSearch(300);
  const { page, perPage, setPage } = usePagination(
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    20,
  );
  const [category, setCategory] = useState<CategoryKey | "ALL">(
    (searchParams.get("category") as CategoryKey | null) ?? "ALL",
  );
  const [activeOnly, setActiveOnly] = useState(searchParams.get("active") !== "false");
  const [hasFtp, setHasFtp] = useState(searchParams.get("ftp") === "true");

  useEffect(() => {
    const initial = searchParams.get("search");
    if (initial) setSearch(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    if (category !== "ALL") params.set("category", category);
    if (!activeOnly) params.set("active", "false");
    if (hasFtp) params.set("ftp", "true");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, page, category, activeOnly, hasFtp, pathname, router]);

  useEffect(() => setPage(1), [debouncedSearch, category, activeOnly, hasFtp, setPage]);

  const fetchOrigins = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    api
      .get<LabOriginRow[]>("/lab-origins", { tenantId })
      .then(setOrigins)
      .catch((err) => setError(err.message ?? "Error al cargar procedencias"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchOrigins, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = debouncedSearch ? normalize(debouncedSearch) : "";
    return origins.filter((o) => {
      if (activeOnly && !o.isActive) return false;
      if (category !== "ALL" && o.category !== category) return false;
      if (hasFtp && !o.reportDeliveryMethods?.includes("FTP")) return false;
      if (needle) {
        const hay = normalize(`${o.code} ${o.name}`);
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [origins, debouncedSearch, category, activeOnly, hasFtp]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Procedencias</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">No se pudieron cargar las procedencias</p>
            <Button variant="outline" onClick={fetchOrigins}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Procedencias</h1>
        <p className="text-sm text-muted-foreground">
          Centros, consultas y clínicas que envían muestras al laboratorio.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Procedencias</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar código o nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[220px]"
              />
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryKey | "ALL")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las categorías</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={activeOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveOnly((v) => !v)}
              >
                Solo activas
              </Button>
              <Button
                variant={hasFtp ? "default" : "outline"}
                size="sm"
                onClick={() => setHasFtp((v) => !v)}
              >
                Con FTP
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Código</th>
                      <th className="text-left py-2 px-3 font-medium">Nombre</th>
                      <th className="text-left py-2 px-3 font-medium">Categoría</th>
                      <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">
                        Cliente
                      </th>
                      <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">
                        Convenio
                      </th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Comuna
                      </th>
                      <th className="text-left py-2 px-3 font-medium">FTP</th>
                      <th className="text-left py-2 px-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((o) => (
                      <tr
                        key={o.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/laboratory/origins/${o.id}`)}
                      >
                        <td className="py-2 px-3 font-mono">{o.code}</td>
                        <td className="py-2 px-3">{o.name}</td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary">{CATEGORY_LABELS[o.category]}</Badge>
                        </td>
                        <td className="py-2 px-3 hidden lg:table-cell">
                          {o.legalEntity ? (
                            <Link
                              href={`/clients/${o.legalEntity.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline"
                            >
                              {o.legalEntity.legalName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 hidden lg:table-cell">
                          {o.billingAgreement ? (
                            <Link
                              href={`/collections/agreements/${o.billingAgreement.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline font-mono text-xs"
                            >
                              {o.billingAgreement.code}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell">{o.commune ?? "—"}</td>
                        <td className="py-2 px-3">
                          {o.reportDeliveryMethods?.includes("FTP") ? (
                            <Badge variant="outline">FTP</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={o.isActive ? "default" : "outline"}>
                            {o.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total === 0 && !loading && (
                <p className="text-muted-foreground py-8 text-center">
                  {debouncedSearch
                    ? `Sin resultados para "${debouncedSearch}"`
                    : "No hay procedencias."}
                </p>
              )}

              {total > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {from}–{to} de {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(safePage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OriginsListPage() {
  return (
    <Suspense>
      <OriginsListContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 3: Smoke test**

Visit `http://localhost:3000/laboratory/origins`. Verify:
- Sidebar now shows "Procedencias" under Laboratorio
- Page loads, table renders, filters work
- Click row → navigates to detail (will 404 until Task 14)
- Click "Cliente" link → does NOT trigger row navigation, navigates to client detail

- [ ] **Step 4: No commit yet — bundle with Task 14**

---

### Task 14: Create `/laboratory/origins/[id]/page.tsx`

**Files:**
- Create: `apps/web/app/(dashboard)/laboratory/origins/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

```tsx
"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import {
  CATEGORY_LABELS,
  RECEPTION_MODE_LABELS,
  DELIVERY_METHOD_LABELS,
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  type CategoryKey,
  type ReceptionModeKey,
  type DeliveryMethodKey,
  type StatusKey,
} from "@/lib/enum-labels";

interface LabOriginDetail {
  id: string;
  code: string;
  name: string;
  category: CategoryKey;
  legalEntityId: string | null;
  parentId: string | null;
  billingAgreementId: string | null;
  street: string | null;
  streetNumber: string | null;
  unit: string | null;
  commune: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  sampleReceptionMode: ReceptionModeKey;
  reportDeliveryMethods: DeliveryMethodKey[];
  deliveryDaysBiopsy: number | null;
  deliveryDaysPap: number | null;
  deliveryDaysCytology: number | null;
  deliveryDaysIhc: number | null;
  deliveryDaysDefault: number | null;
  ftpPath: string | null;
  hasFtpHost: boolean;
  hasFtpUser: boolean;
  hasFtpPassword: boolean;
  criticalNotificationEmails: string[];
  sendsQualityReports: boolean;
  receptionDays: string | null;
  receptionSchedule: string | null;
  notes: string | null;
  isActive: boolean;
  legalEntity: { id: string; rut: string; legalName: string } | null;
  billingAgreement: {
    id: string;
    code: string;
    name: string;
    status: StatusKey;
  } | null;
  parent: { id: string; code: string; name: string } | null;
  children: Array<{ id: string; code: string; name: string; category: CategoryKey }>;
}

function joinAddress(o: LabOriginDetail): string {
  return [o.street, o.streetNumber, o.unit].filter(Boolean).join(" ") || "—";
}

export default function OriginDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { tenant } = useTenantContext();
  const [origin, setOrigin] = useState<LabOriginDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrigin = useCallback(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    setNotFound(false);
    api
      .get<LabOriginDetail>(`/lab-origins/${id}`, { tenantId })
      .then(setOrigin)
      .catch((err) => {
        if (err?.message?.toLowerCase().includes("not found")) setNotFound(true);
        else setError(err.message ?? "Error al cargar procedencia");
      })
      .finally(() => setLoading(false));
  }, [tenant?.id, id]);

  useEffect(fetchOrigin, [fetchOrigin]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-lg font-medium">Procedencia no encontrada</p>
          <Button variant="outline" onClick={() => router.push("/laboratory/origins")}>
            Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error || !origin) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-destructive">{error ?? "Error desconocido"}</p>
          <Button variant="outline" onClick={fetchOrigin}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/laboratory/origins")}
          className="mb-2 -ml-2"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4 mr-1" />
          Procedencias
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">{origin.code}</h1>
          <span className="text-2xl font-medium">{origin.name}</span>
          <Badge variant="secondary">{CATEGORY_LABELS[origin.category]}</Badge>
          <Badge variant={origin.isActive ? "default" : "outline"}>
            {origin.isActive ? "Activa" : "Inactiva"}
          </Badge>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          Datos sincronizados desde FileMaker. Las ediciones se realizan en FM.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Datos Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono">{origin.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nombre</dt>
              <dd>{origin.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Categoría</dt>
              <dd>{CATEGORY_LABELS[origin.category]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Procedencia padre</dt>
              <dd>
                {origin.parent ? (
                  <Link
                    href={`/laboratory/origins/${origin.parent.id}`}
                    className="text-primary hover:underline"
                  >
                    {origin.parent.code} — {origin.parent.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Días recepción</dt>
              <dd>{origin.receptionDays ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Horario recepción</dt>
              <dd>{origin.receptionSchedule ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Modo recepción</dt>
              <dd>{RECEPTION_MODE_LABELS[origin.sampleReceptionMode]}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-muted-foreground">Métodos de entrega</dt>
              <dd className="flex gap-1.5 flex-wrap mt-1">
                {origin.reportDeliveryMethods?.length ? (
                  origin.reportDeliveryMethods.map((m) => (
                    <Badge key={m} variant="outline">
                      {DELIVERY_METHOD_LABELS[m]}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            {origin.notes && (
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">Notas</dt>
                <dd className="whitespace-pre-wrap">{origin.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dirección</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Calle</dt>
              <dd>{joinAddress(origin)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Comuna</dt>
              <dd>{origin.commune ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ciudad</dt>
              <dd>{origin.city ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>
                {origin.phone ? (
                  <a href={`tel:${origin.phone}`} className="text-primary hover:underline">
                    {origin.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                {origin.email ? (
                  <a href={`mailto:${origin.email}`} className="text-primary hover:underline">
                    {origin.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plazos de entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Biopsia</dt>
              <dd>{origin.deliveryDaysBiopsy ?? "—"} días</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PAP</dt>
              <dd>{origin.deliveryDaysPap ?? "—"} días</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Citología</dt>
              <dd>{origin.deliveryDaysCytology ?? "—"} días</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">IHQ</dt>
              <dd>{origin.deliveryDaysIhc ?? "—"} días</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Por defecto</dt>
              <dd>{origin.deliveryDaysDefault ?? "—"} días</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {origin.hasFtpHost && (
        <Card>
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/40">
                <CardTitle className="flex items-center justify-between">
                  Configuración FTP
                  <Badge variant="outline">Configurado</Badge>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Host</dt>
                    <dd className="font-mono">***</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Usuario</dt>
                    <dd className="font-mono">{origin.hasFtpUser ? "***" : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Contraseña</dt>
                    <dd className="font-mono">{origin.hasFtpPassword ? "***" : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ruta</dt>
                    <dd className="font-mono">{origin.ftpPath ?? "—"}</dd>
                  </div>
                </dl>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notificaciones críticas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Emails</dt>
            <dd>
              {origin.criticalNotificationEmails?.length ? (
                <ul className="mt-1 space-y-0.5">
                  {origin.criticalNotificationEmails.map((e) => (
                    <li key={e}>
                      <a href={`mailto:${e}`} className="text-primary hover:underline">
                        {e}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Recibe reportes de calidad</dt>
            <dd>{origin.sendsQualityReports ? "Sí" : "No"}</dd>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vinculación</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Cliente (persona jurídica)</dt>
              <dd>
                {origin.legalEntity ? (
                  <Link
                    href={`/clients/${origin.legalEntity.id}`}
                    className="text-primary hover:underline"
                  >
                    {origin.legalEntity.legalName}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Convenio</dt>
              <dd>
                {origin.billingAgreement ? (
                  <Link
                    href={`/collections/agreements/${origin.billingAgreement.id}`}
                    className="text-primary hover:underline"
                  >
                    <span className="font-mono">{origin.billingAgreement.code}</span> —{" "}
                    {origin.billingAgreement.name}{" "}
                    <Badge
                      variant={STATUS_BADGE_VARIANT[origin.billingAgreement.status]}
                      className="ml-1"
                    >
                      {STATUS_LABELS[origin.billingAgreement.status]}
                    </Badge>
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {origin.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subprocedencias ({origin.children.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Código</th>
                    <th className="text-left py-2 px-3 font-medium">Nombre</th>
                    <th className="text-left py-2 px-3 font-medium">Categoría</th>
                  </tr>
                </thead>
                <tbody>
                  {origin.children.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                      onClick={() => router.push(`/laboratory/origins/${c.id}`)}
                    >
                      <td className="py-2 px-3 font-mono">{c.code}</td>
                      <td className="py-2 px-3">{c.name}</td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary">{CATEGORY_LABELS[c.category]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 3: Smoke test**

Visit a procedencia detail (click any row in `/laboratory/origins`). Verify:
- Header renders with code + name + badges
- FM banner shows
- All cards render (FTP card only if `hasFtpHost === true`)
- Subprocedencias card only renders if `children.length > 0`
- Cliente / Convenio links navigate correctly

- [ ] **Step 4: Commit Tasks 13 + 14**

```bash
git add apps/web/app/\(dashboard\)/laboratory/origins/page.tsx \
        apps/web/app/\(dashboard\)/laboratory/origins/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): Procedencias list and detail pages

List: search, category filter, active/FTP toggles, client-side
pagination, navigation to client/convenio.
Detail: flat card layout (no tabs), FM read-only banner, masked
FTP card (only when configured), subprocedencias table.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Convenios

### Task 15: Create `/collections/agreements/page.tsx`

**Files:**
- Create: `apps/web/app/(dashboard)/collections/agreements/page.tsx`

- [ ] **Step 1: Create the list page**

```tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { usePagination } from "@/hooks/use-pagination";
import {
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  PAYMENT_TERMS_LABELS,
  type StatusKey,
  type PaymentTermsKey,
} from "@/lib/enum-labels";

interface AgreementRow {
  id: string;
  code: string;
  name: string;
  status: StatusKey;
  paymentTerms: PaymentTermsKey;
  customPaymentDays: number | null;
  billingDayOfMonth: number | null;
  isMonthlySettlement: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  legalEntity: { id: string; rut: string; legalName: string } | null;
  _count: { lines: number; contacts: number; labOrigins: number };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isExpiringSoon(effectiveTo: string | null): boolean {
  if (!effectiveTo) return false;
  const end = new Date(effectiveTo).getTime();
  const now = Date.now();
  const sixtyDays = 60 * 24 * 60 * 60 * 1000;
  return end - now > 0 && end - now <= sixtyDays;
}

function AgreementsListContent() {
  const { tenant } = useTenantContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, debouncedSearch, setSearch } = useDebouncedSearch(300);
  const { page, perPage, setPage } = usePagination(
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    20,
  );
  const [status, setStatus] = useState<StatusKey | "ALL">(
    (searchParams.get("status") as StatusKey | null) ?? "ALL",
  );
  const [monthlyOnly, setMonthlyOnly] = useState(searchParams.get("monthly") === "true");
  const [expiring, setExpiring] = useState(searchParams.get("expiring") === "true");

  useEffect(() => {
    const initial = searchParams.get("search");
    if (initial) setSearch(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    if (status !== "ALL") params.set("status", status);
    if (monthlyOnly) params.set("monthly", "true");
    if (expiring) params.set("expiring", "true");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, page, status, monthlyOnly, expiring, pathname, router]);

  useEffect(() => setPage(1), [debouncedSearch, status, monthlyOnly, expiring, setPage]);

  const fetchAgreements = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    api
      .get<AgreementRow[]>("/billing-agreements", { tenantId })
      .then(setAgreements)
      .catch((err) => setError(err.message ?? "Error al cargar convenios"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchAgreements, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = debouncedSearch ? normalize(debouncedSearch) : "";
    return agreements.filter((a) => {
      if (status !== "ALL" && a.status !== status) return false;
      if (monthlyOnly && !a.isMonthlySettlement) return false;
      if (expiring && !isExpiringSoon(a.effectiveTo)) return false;
      if (needle) {
        const hay = normalize(`${a.code} ${a.name}`);
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [agreements, debouncedSearch, status, monthlyOnly, expiring]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const formatPaymentTerms = (a: AgreementRow): string => {
    if (a.paymentTerms === "CUSTOM" && a.customPaymentDays != null) {
      return `${a.customPaymentDays} días`;
    }
    return PAYMENT_TERMS_LABELS[a.paymentTerms];
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Convenios</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">No se pudieron cargar los convenios</p>
            <Button variant="outline" onClick={fetchAgreements}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Convenios</h1>
        <p className="text-sm text-muted-foreground">
          Acuerdos comerciales con clientes: precios, plazos y modalidades de cobro.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Convenios</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar código o nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[220px]"
              />
              <Select value={status} onValueChange={(v) => setStatus(v as StatusKey | "ALL")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Vigente</SelectItem>
                  <SelectItem value="EXPIRED">Expirado</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={monthlyOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setMonthlyOnly((v) => !v)}
              >
                Liquidación mensual
              </Button>
              <Button
                variant={expiring ? "default" : "outline"}
                size="sm"
                onClick={() => setExpiring((v) => !v)}
              >
                Expira en 60 días
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Código</th>
                      <th className="text-left py-2 px-3 font-medium">Nombre</th>
                      <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">
                        Cliente
                      </th>
                      <th className="text-left py-2 px-3 font-medium">Estado</th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Plazo pago
                      </th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Vence
                      </th>
                      <th className="text-right py-2 px-3 font-medium">Líneas</th>
                      <th className="text-right py-2 px-3 font-medium hidden md:table-cell">
                        Procedencias
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/collections/agreements/${a.id}`)}
                      >
                        <td className="py-2 px-3 font-mono">{a.code}</td>
                        <td className="py-2 px-3">{a.name}</td>
                        <td className="py-2 px-3 hidden lg:table-cell">
                          {a.legalEntity ? (
                            <Link
                              href={`/clients/${a.legalEntity.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline"
                            >
                              {a.legalEntity.legalName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={STATUS_BADGE_VARIANT[a.status]}>
                            {STATUS_LABELS[a.status]}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell">
                          {formatPaymentTerms(a)}
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell">
                          {a.effectiveTo
                            ? new Date(a.effectiveTo).toLocaleDateString("es-CL")
                            : "—"}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{a._count.lines}</td>
                        <td className="py-2 px-3 text-right tabular-nums hidden md:table-cell">
                          {a._count.labOrigins}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total === 0 && !loading && (
                <p className="text-muted-foreground py-8 text-center">
                  {debouncedSearch
                    ? `Sin resultados para "${debouncedSearch}"`
                    : "No hay convenios."}
                </p>
              )}

              {total > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {from}–{to} de {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(safePage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AgreementsListPage() {
  return (
    <Suspense>
      <AgreementsListContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 3: No commit yet**

Bundle with Task 16.

---

### Task 16: Create `/collections/agreements/[id]/page.tsx`

**Files:**
- Create: `apps/web/app/(dashboard)/collections/agreements/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

```tsx
"use client";

import { Suspense, use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import {
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  PAYMENT_TERMS_LABELS,
  MODALITY_LABELS,
  CATEGORY_LABELS,
  type StatusKey,
  type PaymentTermsKey,
  type ModalityKey,
  type CategoryKey,
} from "@/lib/enum-labels";

interface AgreementLine {
  id: string;
  factor: string;
  negotiatedPrice: string;
  referencePrice: string | null;
  currency: string;
  billingConcept: { id: string; code: string; name: string };
}

interface AgreementContact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface AgreementOrigin {
  id: string;
  code: string;
  name: string;
  category: CategoryKey;
}

interface AgreementDetail {
  id: string;
  code: string;
  name: string;
  status: StatusKey;
  contractDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  paymentTerms: PaymentTermsKey;
  customPaymentDays: number | null;
  billingDayOfMonth: number | null;
  isMonthlySettlement: boolean;
  billingModalities: ModalityKey[];
  examTypes: string[];
  notes: string | null;
  legalEntity: { id: string; rut: string; legalName: string } | null;
  lines: AgreementLine[];
  contacts: AgreementContact[];
  labOrigins: AgreementOrigin[];
}

function fmtDate(s: string | null): string {
  return s ? new Date(s).toLocaleDateString("es-CL") : "—";
}

function AgreementDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tenant } = useTenantContext();

  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tab = searchParams.get("tab") ?? "lineas";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "lineas") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const fetchAgreement = useCallback(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    setNotFound(false);
    api
      .get<AgreementDetail>(`/billing-agreements/${id}`, { tenantId })
      .then(setAgreement)
      .catch((err) => {
        if (err?.message?.toLowerCase().includes("not found")) setNotFound(true);
        else setError(err.message ?? "Error al cargar convenio");
      })
      .finally(() => setLoading(false));
  }, [tenant?.id, id]);

  useEffect(fetchAgreement, [fetchAgreement]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-lg font-medium">Convenio no encontrado</p>
          <Button variant="outline" onClick={() => router.push("/collections/agreements")}>
            Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error || !agreement) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-destructive">{error ?? "Error desconocido"}</p>
          <Button variant="outline" onClick={fetchAgreement}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  const formatPaymentTerms = (): string => {
    if (agreement.paymentTerms === "CUSTOM" && agreement.customPaymentDays != null) {
      return `${agreement.customPaymentDays} días`;
    }
    return PAYMENT_TERMS_LABELS[agreement.paymentTerms];
  };

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/collections/agreements")}
          className="mb-2 -ml-2"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4 mr-1" />
          Convenios
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">{agreement.code}</h1>
          <span className="text-2xl font-medium">{agreement.name}</span>
          <Badge variant={STATUS_BADGE_VARIANT[agreement.status]}>
            {STATUS_LABELS[agreement.status]}
          </Badge>
        </div>
        {agreement.legalEntity && (
          <Link
            href={`/clients/${agreement.legalEntity.id}`}
            className="text-sm text-primary hover:underline mt-1 inline-block"
          >
            {agreement.legalEntity.legalName}
          </Link>
        )}
      </div>

      <Alert>
        <AlertDescription>
          Datos sincronizados desde FileMaker. Las ediciones se realizan en FM.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lineas">Líneas de precio</TabsTrigger>
          <TabsTrigger value="datos">Datos generales</TabsTrigger>
          <TabsTrigger value="contactos">Contactos</TabsTrigger>
          <TabsTrigger value="procedencias">Procedencias</TabsTrigger>
        </TabsList>

        <TabsContent value="lineas">
          <Card>
            <CardHeader>
              <CardTitle>Líneas ({agreement.lines.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {agreement.lines.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Sin precios acordados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Código</th>
                        <th className="text-left py-2 px-3 font-medium">Concepto</th>
                        <th className="text-right py-2 px-3 font-medium">Precio referencia</th>
                        <th className="text-right py-2 px-3 font-medium">Factor</th>
                        <th className="text-right py-2 px-3 font-medium">Precio negociado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agreement.lines.map((l) => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="py-2 px-3 font-mono">{l.billingConcept.code}</td>
                          <td className="py-2 px-3">{l.billingConcept.name}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {l.referencePrice ? formatCLP(l.referencePrice) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {Number(l.factor).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">
                            {formatCLP(l.negotiatedPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datos">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Fecha contrato</dt>
                  <dd>{fmtDate(agreement.contractDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Vigencia</dt>
                  <dd>
                    {fmtDate(agreement.effectiveFrom)} → {fmtDate(agreement.effectiveTo)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Plazo de pago</dt>
                  <dd>{formatPaymentTerms()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Día facturación</dt>
                  <dd>{agreement.billingDayOfMonth ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Liquidación mensual</dt>
                  <dd>{agreement.isMonthlySettlement ? "Sí" : "No"}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">Modalidades de cobro</dt>
                  <dd className="flex gap-1.5 flex-wrap mt-1">
                    {agreement.billingModalities?.length ? (
                      agreement.billingModalities.map((m) => (
                        <Badge key={m} variant="outline">
                          {MODALITY_LABELS[m]}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">Tipos de examen</dt>
                  <dd className="flex gap-1.5 flex-wrap mt-1">
                    {agreement.examTypes?.length ? (
                      agreement.examTypes.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                {agreement.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-muted-foreground">Notas</dt>
                    <dd className="whitespace-pre-wrap">{agreement.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contactos">
          <Card>
            <CardHeader>
              <CardTitle>Contactos de cobranza ({agreement.contacts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {agreement.contacts.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Sin contactos de cobranza.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Nombre</th>
                        <th className="text-left py-2 px-3 font-medium">Cargo</th>
                        <th className="text-left py-2 px-3 font-medium">Email</th>
                        <th className="text-left py-2 px-3 font-medium">Teléfono</th>
                        <th className="text-left py-2 px-3 font-medium">Móvil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agreement.contacts.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 px-3">
                            {c.name}
                            {c.isPrimary && (
                              <Badge variant="default" className="ml-2">Principal</Badge>
                            )}
                          </td>
                          <td className="py-2 px-3">{c.role ?? "—"}</td>
                          <td className="py-2 px-3">
                            {c.email ? (
                              <a
                                href={`mailto:${c.email}`}
                                className="text-primary hover:underline"
                              >
                                {c.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {c.phone ? (
                              <a href={`tel:${c.phone}`} className="text-primary hover:underline">
                                {c.phone}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {c.mobile ? (
                              <a href={`tel:${c.mobile}`} className="text-primary hover:underline">
                                {c.mobile}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procedencias">
          <Card>
            <CardHeader>
              <CardTitle>Procedencias ({agreement.labOrigins.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {agreement.labOrigins.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Sin procedencias vinculadas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Código</th>
                        <th className="text-left py-2 px-3 font-medium">Nombre</th>
                        <th className="text-left py-2 px-3 font-medium">Categoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agreement.labOrigins.map((o) => (
                        <tr
                          key={o.id}
                          className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                          onClick={() => router.push(`/laboratory/origins/${o.id}`)}
                        >
                          <td className="py-2 px-3 font-mono">{o.code}</td>
                          <td className="py-2 px-3">{o.name}</td>
                          <td className="py-2 px-3">
                            <Badge variant="secondary">{CATEGORY_LABELS[o.category]}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AgreementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense>
      <AgreementDetailContent id={id} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 3: Smoke test**

Visit `/collections/agreements`. Click any row. Verify:
- All 4 tabs render (default tab is `lineas`)
- URL updates with `?tab=` when switching
- Lines show formatted CLP, factor with 2 decimals
- Empty states render the right copy ("Sin precios acordados", etc.)
- Procedencias rows navigate to procedencia detail
- LegalEntity link in header navigates to client detail

- [ ] **Step 4: Commit Tasks 15 + 16**

```bash
git add apps/web/app/\(dashboard\)/collections/agreements/page.tsx \
        apps/web/app/\(dashboard\)/collections/agreements/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): Convenios list and detail pages

List: search, status select, monthly + expiring-soon toggles,
URL state, navigation to client.
Detail: 4 tabs (Líneas/Datos generales/Contactos/Procedencias),
URL ?tab= state, formatted CLP prices, link back to client.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Clientes

### Task 17: Replace `/clients/page.tsx` with full list

**Files:**
- Modify (replace): `apps/web/app/(dashboard)/clients/page.tsx`

- [ ] **Step 1: Replace placeholder with full list page**

Replace the entire contents of `apps/web/app/(dashboard)/clients/page.tsx`:

```tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { usePagination } from "@/hooks/use-pagination";
import { formatRut } from "@zeru/shared";

interface LegalEntityRow {
  id: string;
  rut: string;
  legalName: string;
  tradeName: string | null;
  commune: string | null;
  phone: string | null;
  isClient: boolean;
  isSupplier: boolean;
  isActive: boolean;
  _count: { labOrigins: number; billingAgreements: number };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function ClientsListContent() {
  const { tenant } = useTenantContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [entities, setEntities] = useState<LegalEntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, debouncedSearch, setSearch } = useDebouncedSearch(300);
  const { page, perPage, setPage } = usePagination(
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    20,
  );
  const [clientOnly, setClientOnly] = useState(searchParams.get("client") !== "false");
  const [supplierOnly, setSupplierOnly] = useState(searchParams.get("supplier") === "true");
  const [activeOnly, setActiveOnly] = useState(searchParams.get("active") !== "false");

  useEffect(() => {
    const initial = searchParams.get("search");
    if (initial) setSearch(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    if (!clientOnly) params.set("client", "false");
    if (supplierOnly) params.set("supplier", "true");
    if (!activeOnly) params.set("active", "false");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, page, clientOnly, supplierOnly, activeOnly, pathname, router]);

  useEffect(
    () => setPage(1),
    [debouncedSearch, clientOnly, supplierOnly, activeOnly, setPage],
  );

  const fetchEntities = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    api
      .get<LegalEntityRow[]>("/legal-entities", { tenantId })
      .then(setEntities)
      .catch((err) => setError(err.message ?? "Error al cargar clientes"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchEntities, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = debouncedSearch ? normalize(debouncedSearch) : "";
    return entities.filter((e) => {
      if (activeOnly && !e.isActive) return false;
      if (clientOnly && !e.isClient) return false;
      if (supplierOnly && !e.isSupplier) return false;
      if (needle) {
        const hay = normalize(`${e.rut} ${e.legalName} ${e.tradeName ?? ""}`);
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [entities, debouncedSearch, clientOnly, supplierOnly, activeOnly]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">No se pudieron cargar los clientes</p>
            <Button variant="outline" onClick={fetchEntities}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Personas jurídicas: clientes, proveedores y derivadores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Personas jurídicas</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar RUT, razón social o fantasía…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[280px]"
              />
              <Button
                variant={clientOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setClientOnly((v) => !v)}
              >
                Clientes
              </Button>
              <Button
                variant={supplierOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setSupplierOnly((v) => !v)}
              >
                Proveedores
              </Button>
              <Button
                variant={activeOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveOnly((v) => !v)}
              >
                Solo activos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">RUT</th>
                      <th className="text-left py-2 px-3 font-medium">Razón social</th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Comuna
                      </th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Teléfono
                      </th>
                      <th className="text-right py-2 px-3 font-medium">Convenios</th>
                      <th className="text-right py-2 px-3 font-medium">Procedencias</th>
                      <th className="text-left py-2 px-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/clients/${e.id}`)}
                      >
                        <td className="py-2 px-3 font-mono">{formatRut(e.rut)}</td>
                        <td className="py-2 px-3">
                          <div>{e.legalName}</div>
                          {e.tradeName && (
                            <div className="text-xs text-muted-foreground">{e.tradeName}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell">{e.commune ?? "—"}</td>
                        <td className="py-2 px-3 hidden md:table-cell">{e.phone ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {e._count.billingAgreements}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {e._count.labOrigins}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={e.isActive ? "default" : "outline"}>
                            {e.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total === 0 && !loading && (
                <p className="text-muted-foreground py-8 text-center">
                  {debouncedSearch
                    ? `Sin resultados para "${debouncedSearch}"`
                    : "No hay clientes."}
                </p>
              )}

              {total > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {from}–{to} de {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(safePage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsListContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 3: No commit yet**

Bundle with Task 18.

---

### Task 18: Create `/clients/[id]/page.tsx`

**Files:**
- Create: `apps/web/app/(dashboard)/clients/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

```tsx
"use client";

import { Suspense, use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatRut, formatCLP } from "@zeru/shared";
import {
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  PAYMENT_TERMS_LABELS,
  MODALITY_LABELS,
  CATEGORY_LABELS,
  type StatusKey,
  type PaymentTermsKey,
  type ModalityKey,
  type CategoryKey,
} from "@/lib/enum-labels";

interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface AgreementLine {
  id: string;
  factor: string;
  negotiatedPrice: string;
  referencePrice: string | null;
  currency: string;
  billingConcept: { id: string; code: string; name: string };
}

interface NestedAgreement {
  id: string;
  code: string;
  name: string;
  status: StatusKey;
  paymentTerms: PaymentTermsKey;
  customPaymentDays: number | null;
  billingDayOfMonth: number | null;
  billingModalities: ModalityKey[];
  isMonthlySettlement: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  contractDate: string | null;
  _count: { lines: number; contacts: number; labOrigins: number };
  lines: AgreementLine[];
  contacts: Contact[];
}

interface NestedOrigin {
  id: string;
  code: string;
  name: string;
  category: CategoryKey;
  commune: string | null;
  city: string | null;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  holderRut: string | null;
  isPrimary: boolean;
}

interface ClientDetail {
  id: string;
  rut: string;
  legalName: string;
  tradeName: string | null;
  businessActivity: string | null;
  isClient: boolean;
  isSupplier: boolean;
  street: string | null;
  streetNumber: string | null;
  unit: string | null;
  commune: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  isActive: boolean;
  contacts: Contact[];
  bankAccounts: BankAccount[];
  labOrigins: NestedOrigin[];
  billingAgreements: NestedAgreement[];
}

function joinAddress(c: ClientDetail): string {
  const street = [c.street, c.streetNumber, c.unit].filter(Boolean).join(" ");
  const locality = [c.commune, c.city].filter(Boolean).join(", ");
  return [street, locality].filter(Boolean).join(" — ") || "—";
}

function formatPaymentTerms(a: NestedAgreement): string {
  if (a.paymentTerms === "CUSTOM" && a.customPaymentDays != null) {
    return `${a.customPaymentDays} días`;
  }
  return PAYMENT_TERMS_LABELS[a.paymentTerms];
}

function ClientDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tenant } = useTenantContext();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tab = searchParams.get("tab") ?? "convenios";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "convenios") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const fetchClient = useCallback(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    setNotFound(false);
    api
      .get<ClientDetail>(`/legal-entities/${id}`, { tenantId })
      .then(setClient)
      .catch((err) => {
        if (err?.message?.toLowerCase().includes("not found")) setNotFound(true);
        else setError(err.message ?? "Error al cargar cliente");
      })
      .finally(() => setLoading(false));
  }, [tenant?.id, id]);

  useEffect(fetchClient, [fetchClient]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-lg font-medium">Cliente no encontrado</p>
          <Button variant="outline" onClick={() => router.push("/clients")}>Volver</Button>
        </CardContent>
      </Card>
    );
  }

  if (error || !client) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-destructive">{error ?? "Error desconocido"}</p>
          <Button variant="outline" onClick={fetchClient}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/clients")}
          className="mb-2 -ml-2"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4 mr-1" />
          Clientes
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg text-muted-foreground">
            {formatRut(client.rut)}
          </span>
          <h1 className="text-2xl font-bold">{client.legalName}</h1>
          {client.tradeName && (
            <span className="text-muted-foreground">({client.tradeName})</span>
          )}
        </div>
        <div className="flex gap-1.5 mt-2">
          {client.isClient && <Badge variant="default">Cliente</Badge>}
          {client.isSupplier && <Badge variant="secondary">Proveedor</Badge>}
          <Badge variant={client.isActive ? "default" : "outline"}>
            {client.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          Datos sincronizados desde FileMaker. Las ediciones se realizan en FM.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="convenios">
            Convenios ({client.billingAgreements.length})
          </TabsTrigger>
          <TabsTrigger value="procedencias">
            Procedencias ({client.labOrigins.length})
          </TabsTrigger>
          <TabsTrigger value="datos">Datos generales</TabsTrigger>
          <TabsTrigger value="contactos">
            Contactos ({client.contacts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="convenios" className="space-y-4">
          {client.billingAgreements.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Este cliente no tiene convenios asociados.
              </CardContent>
            </Card>
          ) : (
            client.billingAgreements.map((a) => (
              <Card key={a.id}>
                <Collapsible defaultOpen={client.billingAgreements.length <= 3}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/40">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/collections/agreements/${a.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-primary hover:underline"
                          >
                            {a.code}
                          </Link>
                          <span className="font-medium">{a.name}</span>
                          <Badge variant={STATUS_BADGE_VARIANT[a.status]}>
                            {STATUS_LABELS[a.status]}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPaymentTerms(a)} · {a._count.lines} líneas ·{" "}
                          {a._count.labOrigins} procedencias
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      {a.billingModalities?.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {a.billingModalities.map((m) => (
                            <Badge key={m} variant="outline">
                              {MODALITY_LABELS[m]}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {a.lines.length === 0 ? (
                        <p className="text-muted-foreground py-2">
                          Sin precios acordados.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-3 font-medium">Código</th>
                                <th className="text-left py-2 px-3 font-medium">Concepto</th>
                                <th className="text-right py-2 px-3 font-medium">
                                  Factor
                                </th>
                                <th className="text-right py-2 px-3 font-medium">
                                  Negociado
                                </th>
                                <th className="text-right py-2 px-3 font-medium">
                                  Referencia
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.lines.map((l) => (
                                <tr key={l.id} className="border-b last:border-0">
                                  <td className="py-2 px-3 font-mono">
                                    {l.billingConcept.code}
                                  </td>
                                  <td className="py-2 px-3">{l.billingConcept.name}</td>
                                  <td className="py-2 px-3 text-right tabular-nums">
                                    {Number(l.factor).toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right tabular-nums font-medium">
                                    {formatCLP(l.negotiatedPrice)}
                                  </td>
                                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                    {l.referencePrice ? formatCLP(l.referencePrice) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {a.contacts.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Contactos de cobranza
                          </h4>
                          <ul className="space-y-1 text-sm">
                            {a.contacts.map((c) => (
                              <li key={c.id} className="flex flex-wrap gap-x-3">
                                <span className="font-medium">{c.name}</span>
                                {c.role && (
                                  <span className="text-muted-foreground">{c.role}</span>
                                )}
                                {c.email && (
                                  <a
                                    href={`mailto:${c.email}`}
                                    className="text-primary hover:underline"
                                  >
                                    {c.email}
                                  </a>
                                )}
                                {c.phone && (
                                  <a
                                    href={`tel:${c.phone}`}
                                    className="text-primary hover:underline"
                                  >
                                    {c.phone}
                                  </a>
                                )}
                                {c.isPrimary && (
                                  <Badge variant="default">Principal</Badge>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="procedencias">
          <Card>
            <CardContent className="pt-6">
              {client.labOrigins.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Este cliente no tiene procedencias asociadas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Código</th>
                        <th className="text-left py-2 px-3 font-medium">Nombre</th>
                        <th className="text-left py-2 px-3 font-medium">Categoría</th>
                        <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                          Comuna
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.labOrigins.map((o) => (
                        <tr
                          key={o.id}
                          className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                          onClick={() => router.push(`/laboratory/origins/${o.id}`)}
                        >
                          <td className="py-2 px-3 font-mono">{o.code}</td>
                          <td className="py-2 px-3">{o.name}</td>
                          <td className="py-2 px-3">
                            <Badge variant="secondary">{CATEGORY_LABELS[o.category]}</Badge>
                          </td>
                          <td className="py-2 px-3 hidden md:table-cell">
                            {o.commune ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datos">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">Dirección</dt>
                  <dd>{joinAddress(client)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd>
                    {client.phone ? (
                      <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                        {client.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>
                    {client.email ? (
                      <a
                        href={`mailto:${client.email}`}
                        className="text-primary hover:underline"
                      >
                        {client.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sitio web</dt>
                  <dd>
                    {client.website ? (
                      <a
                        href={
                          client.website.startsWith("http")
                            ? client.website
                            : `https://${client.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {client.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">Giro</dt>
                  <dd>{client.businessActivity ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contactos">
          <Card>
            <CardContent className="pt-6">
              {client.contacts.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Sin contactos generales.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Nombre</th>
                        <th className="text-left py-2 px-3 font-medium">Cargo</th>
                        <th className="text-left py-2 px-3 font-medium">Email</th>
                        <th className="text-left py-2 px-3 font-medium">Teléfono</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.contacts.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 px-3">
                            {c.name}
                            {c.isPrimary && (
                              <Badge variant="default" className="ml-2">
                                Principal
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-3">{c.role ?? "—"}</td>
                          <td className="py-2 px-3">
                            {c.email ? (
                              <a
                                href={`mailto:${c.email}`}
                                className="text-primary hover:underline"
                              >
                                {c.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {c.phone ? (
                              <a
                                href={`tel:${c.phone}`}
                                className="text-primary hover:underline"
                              >
                                {c.phone}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense>
      <ClientDetailContent id={id} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter @zeru/web lint`
Expected: exits 0.

- [ ] **Step 3: Smoke test**

Visit `/clients`. Verify:
- List shows real clients from FM with counts
- Search filters by RUT, razón social, fantasía
- Click row → navigates to detail
- Detail page shows 4 tabs, default = `convenios`
- Each Convenio card collapses/expands
- Inside the card: lines table renders prices via `formatCLP`
- Procedencias tab links to procedencia detail

- [ ] **Step 4: Commit Tasks 17 + 18**

```bash
git add apps/web/app/\(dashboard\)/clients/page.tsx \
        apps/web/app/\(dashboard\)/clients/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): Clientes list and detail pages

List: replaces ModulePlaceholder. Search by RUT/razón social/
fantasía, client/proveedor/active filters, counts of convenios
and procedencias, URL state.
Detail: 4 tabs (Convenios/Procedencias/Datos/Contactos), default
tab=convenios, each convenio rendered as collapsible card with
inline pricing lines and billing contacts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Final verification

### Task 19: Full lint + build sweep

**Files:** none

- [ ] **Step 1: Run full repo lint**

Run: `pnpm lint`
Expected: exits 0. Fix any introduced issues before proceeding.

- [ ] **Step 2: Build api**

Run: `pnpm --filter @zeru/api build`
Expected: exits 0.

- [ ] **Step 3: Build web**

Run: `pnpm --filter @zeru/web build`
Expected: exits 0. Watch for any RSC/Suspense warnings on the new pages.

- [ ] **Step 4: Verify no leftover untracked spec files**

Run: `git status`
Expected: only the new plan and any expected files. The two old `2026-04-04-*.md` specs that were superseded by the consolidated spec are still untracked from the previous session — leave them alone for this PR (or delete them in a separate housekeeping commit if the user asks).

---

### Task 20: End-to-end manual smoke checklist

**Files:** none

- [ ] **Step 1: Walk through every page**

With dev servers running, visit each URL in order and verify the success criteria:

| URL | Verify |
|---|---|
| `/settings/billing-concepts` | List, search, pagination, tooltip on long descriptions |
| `/laboratory/origins` | List, all filters, sidebar shows "Procedencias", row → detail |
| `/laboratory/origins/<id>` | All cards, FM banner, FTP card hidden when `hasFtpHost=false`, subprocedencias only when present, links to client/convenio |
| `/collections/agreements` | List, status filter, monthly + expiring toggles, link to client |
| `/collections/agreements/<id>` | All 4 tabs, default = lineas, URL `?tab=` updates, prices formatted, links to client/procedencias |
| `/clients` | List replaces placeholder, search, all 3 toggles, counts visible |
| `/clients/<id>` | All 4 tabs, default = convenios, collapsible cards, prices formatted, links to convenio + procedencia |

- [ ] **Step 2: Verify breadcrumbs resolve UUIDs**

Navigate to a client detail page. Breadcrumb should read `Inicio › Clientes › <legalName>` (not the UUID).
Repeat for procedencia (`<name>`) and convenio (`<name>`).

- [ ] **Step 3: Verify FTP ciphertext is gone from network**

Open Chrome DevTools → Network tab. Request `/api/lab-origins`. Confirm response payload contains **no** `encryptedFtpHost`, `encryptedFtpUser`, or `encryptedFtpPassword` keys.
Request `/api/lab-origins/<id>` for an origin with FTP. Confirm:
- No `encryptedFtp*` keys
- Has `hasFtpHost: true`, `hasFtpUser: true|false`, `hasFtpPassword: true|false`
- Has `ftpPath` (plaintext) — this field is the relative path on the FTP server, not a credential

- [ ] **Step 4: Verify permissions**

If you have a tenant where `lab-origins` permission is `NONE`, the Procedencias sidebar item should be hidden. If you have access but not write, no edit buttons should be visible (there are none in MVP).

- [ ] **Step 5: Spec coverage final check**

Reread `docs/superpowers/specs/2026-04-07-fm-data-ui-consolidated.md` sections 1-12. For each requirement, confirm a corresponding task delivered it. If you find a gap, add it as a follow-up task and resolve it before declaring done.

---

## Self-review notes

**Spec coverage check (done by plan author):**

| Spec section | Plan task |
|---|---|
| §1.1 Read-only banner | All detail pages render `<Alert>` with the exact copy |
| §1.2 Monolithic pages | All pages are single `page.tsx` files |
| §1.3 `usePagination(20)` everywhere | Tasks 12, 13, 15, 17 all use it |
| §1.4 "Datos Generales" tab name | Convenio detail tab `value="datos"` labeled "Datos generales"; Client detail same |
| §1.5 Status labels | `STATUS_LABELS` constant in Task 9, used everywhere |
| §1.6 `formatCLP` shared | Task 1 |
| §1.7 enum-labels.ts | Task 9 |
| §1.8 stopPropagation | Every inner `<Link onClick>` in tasks 13, 15, 18 |
| §2.1 LegalEntity findAll count | Task 3 |
| §2.2 LegalEntity findById expand | Task 4 |
| §2.3 LabOrigin findAll secure | Task 5 |
| §2.4 LabOrigin findById mask | Task 6 |
| §2.5 BillingAgreement findAll trim | Task 7 |
| §2.6 lab-origins module def | Task 2 |
| §2.7 formatCLP shared | Task 1 |
| §3.1 Clientes list+detail | Tasks 17, 18 |
| §3.2 Procedencias list+detail | Tasks 13, 14 |
| §3.3 Convenios list+detail | Tasks 15, 16 |
| §3.4 Catálogo CDC | Task 12 |
| §4.1 Sidebar | Task 10 |
| §4.2 Breadcrumbs | Task 11 |
| §4.3 Shared utilities | Tasks 1, 9 |
| §5 Empty states matrix | Each page implements its row from the matrix |
| §6 Error states | Loading skeleton, error card with retry, 404 card on detail pages |
| §7 Responsive | `hidden md:table-cell` / `hidden lg:table-cell` on secondary columns |
| §8 Permissions UI | `lab-origins` registered in MODULE_DEFINITIONS so existing `usePermissions` hides the sidebar item; "no permissions" UI is NOT implemented in this plan because Section 8 only requires it on direct URL access — deferred unless we hit it in smoke testing. **Status: matches MVP scope.** |
| §9 Cross-entity nav map | Every link follows the map; verified manually in Task 20 |
| §10 Out of scope | Plan does not implement any deferred items |
| §11 Implementation order | Plan tasks ordered exactly: backend → infra → CDC → procedencias → convenios → clientes |
| §12 File count | 8 created + 8 modified = 16 files. Spec said 7 created + 8 modified = 15. **Diff: +1 created.** Reason: shadcn `Alert` component is a created file (Task 8) that the spec didn't list. Acceptable. |

**Placeholder scan:** No "TBD", "TODO later", or "fill in" patterns. Every code block is complete and ready to paste.

**Type consistency:** `STATUS_BADGE_VARIANT[a.status]` is used in tasks 13, 15, 16, 18. The variant union (`"default" | "outline" | "secondary"`) matches `Badge` props. Field names (`hasFtpHost`, `_count.billingAgreements`, `billingConcept.code`) are consistent across tasks.

**Caveats found during planning:**
- **localStorage key drift**: `tenantId` (canonical) vs `tenant_id` (legacy). Plan explicitly says use `tenantId`. Do **not** "match" the older code in `journal/page.tsx`.
- **Tabs orientation**: shadcn `Tabs` uses `display: flex` with `data-horizontal:flex-col` — this is fine for our usage (TabsList above TabsContent).
- **`Decimal` strings**: tasks render every Decimal via `formatCLP(...)`, never via `Number(...)` or `.toString()`. Factor uses `Number(l.factor).toFixed(2)` because it's not currency.
- **No tests**: there are no `*.spec.ts` files for any module-level service in the repo. This plan does not invent a test framework. Verification = `pnpm lint` + manual smoke. If you (the executor) want to add Jest tests for the new service expansions, do it in a separate PR — not as part of executing this plan.
