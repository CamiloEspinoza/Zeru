# UI for Imported FM Data — Consolidated Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Replaces:** `2026-04-04-clients-page-design.md`, `2026-04-04-lab-origins-billing-ui-design.md`
**Context:** After importing 422 LegalEntities, 471 BillingAgreements, 862 LabOrigins, 181 BillingConcepts, and 2,546 BillingAgreementLines from FileMaker, users need UI to view and navigate this data. This spec consolidates the previous two specs after a 5-agent review round, resolving 6 inconsistencies and addressing the most critical gaps.

---

## 1. Design Decisions (consolidated)

1. **Read-only during FM migration**. All detail pages show a top banner: "Datos sincronizados desde FileMaker. Las ediciones se realizan en FM." Same banner copy on all 4 detail pages (Clients, Procedencias, Convenios, BillingConcepts is list-only). Implemented as `<Alert>` with info icon, not a small badge.

2. **Monolithic page components, no extraction**. Each page is one `page.tsx` file with everything inline (matching journal/chart-of-accounts/directorio patterns). Detail pages with tabs render tab bodies inline. Only extract a component when a single file exceeds ~700 LOC.

3. **Client-side fetch + pagination via `usePagination` for all lists**. All 4 list pages use the existing `usePagination(20)` hook for virtual pagination, regardless of size. This is consistent across pages and prevents DOM lag for 800+ row tables.

4. **Tab naming convention: "Datos Generales"** (not "General"). All detail pages with tabs use "Datos Generales" as the first tab.

5. **Status labels**: `BillingAgreementStatus.ACTIVE → "Vigente"`, `EXPIRED → "Expirado"`, `DRAFT → "Borrador"`. Same labels everywhere.

6. **Shared `formatCLP` from `@zeru/shared`**. Update the existing util to accept `number | string` (Prisma Decimals serialize as strings). Both pages import from shared, no local redeclaration.

7. **Shared enum label maps**. Create `apps/web/lib/enum-labels.ts` with `STATUS_LABELS`, `PAYMENT_TERMS_LABELS`, `MODALITY_LABELS`, `CATEGORY_LABELS`, `RECEPTION_MODE_LABELS`, `DELIVERY_METHOD_LABELS`. Imported by all pages.

8. **Cross-entity navigation**: All entities link to each other where the destination exists. Inner links use `e.stopPropagation()` to avoid triggering the row click.

---

## 2. Backend changes required (P0 — must do first)

### 2.1 LegalEntitiesService.findAll — add billingAgreements count

```typescript
// apps/api/src/modules/legal-entities/legal-entities.service.ts
return client.legalEntity.findMany({
  orderBy: { legalName: 'asc' },
  include: {
    _count: { select: { labOrigins: true, billingAgreements: true } },
  },
});
```

### 2.2 LegalEntitiesService.findById — expand billingAgreements

```typescript
return client.legalEntity.findUnique({
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
      select: { id: true, code: true, name: true, category: true, commune: true, city: true },
    },
    billingAgreements: {
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: {
        id: true, code: true, name: true, status: true,
        paymentTerms: true, customPaymentDays: true, billingDayOfMonth: true,
        billingModalities: true, isMonthlySettlement: true,
        effectiveFrom: true, effectiveTo: true,
        contractDate: true,
        _count: { select: { lines: true, contacts: true, labOrigins: true } },
        lines: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, factor: true, negotiatedPrice: true, referencePrice: true, currency: true,
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
```

### 2.3 LabOriginsService.findAll — SECURITY: exclude encrypted FTP fields

The current `findAll` returns `encryptedFtpHost`, `encryptedFtpUser`, `encryptedFtpPassword` for all 862 records. Switch to explicit `select` to exclude them:

```typescript
return client.labOrigin.findMany({
  orderBy: { name: 'asc' },
  select: {
    id: true, code: true, name: true, category: true,
    commune: true, city: true, phone: true, email: true,
    isActive: true, deletedAt: true, createdAt: true, updatedAt: true,
    legalEntityId: true, billingAgreementId: true, parentId: true,
    sampleReceptionMode: true, reportDeliveryMethods: true,
    deliveryDaysBiopsy: true, deliveryDaysPap: true,
    sendsQualityReports: true,
    legalEntity: { select: { id: true, rut: true, legalName: true } },
    billingAgreement: { select: { id: true, code: true, name: true, status: true } },
    parent: { select: { id: true, code: true, name: true } },
    _count: { select: { children: true } },
  },
});
```

### 2.4 LabOriginsService.findById — mask FTP fields

Replace the 3 encrypted FTP fields in the response with booleans `hasFtpHost`, `hasFtpUser`, `hasFtpPassword`. The encrypted values stay in the DB but are never sent to the frontend. A future `GET /lab-origins/:id/ftp-credentials` (admin-only) can decrypt server-side when needed.

### 2.5 BillingAgreementsService.findAll — add explicit select

Drop `operationalFlags` (Json) and `notes` from the list response. Keep only the columns the table renders.

### 2.6 Add `lab-origins` to MODULE_DEFINITIONS

```typescript
// packages/shared/src/permissions/module-definitions.ts
{
  key: 'lab-origins',
  label: 'Procedencias',
  section: 'laboratory',
  granularPermissions: [],
},
// Add to ROUTE_MODULE_MAP:
'/laboratory/origins': 'lab-origins',
```

Update RBAC seed if needed so existing tenants get visibility.

### 2.7 Move `formatCLP` to shared

Update `packages/shared/src/utils/currency.ts` to accept `number | string` input. Re-export from `@zeru/shared/index.ts`.

---

## 3. Pages to build

### 3.1 Clientes (`/clients` + `/clients/[id]`)

**List page** — `apps/web/app/(dashboard)/clients/page.tsx`
- Search by `rut` OR `legalName` OR `tradeName`. Search input uses `useDebouncedSearch(300)`. Normalize input + haystack via NFD strip-accents lowercase before matching.
- Filters: `isClient` / `isSupplier` (toggle), `isActive` (default: only active).
- Columns: RUT (formatted), Razón Social, Comuna, Teléfono, Convenios (count), Procedencias (count), Estado.
- Click row → `router.push(/clients/${id})`. Inner links use `stopPropagation`.
- Pagination: `usePagination(1, 20)`. URL state via `useSearchParams` for `page`, `search`, `tab`.
- Loading: Skeleton rows.
- Empty (no data): "No hay clientes" message.
- Empty (no results): "Sin resultados para '{search}'".
- Error: Card with "Error al cargar clientes" + retry button.

**Detail page** — `apps/web/app/(dashboard)/clients/[id]/page.tsx`
- Header: ClientHeader with RUT (formatted), legalName, badges (Cliente/Proveedor, Activo). Back button: `router.push('/clients')`.
- FM read-only banner.
- Tabs: `?tab=` URL state. Default tab: `convenios` (most-used by billing staff).
  - **Convenios**: list of BillingAgreements. Each as a Card with header (code, name, status badge, payment terms) + Collapsible content showing pricing lines table (concept code, name, factor, negotiated, reference). Inline billing contacts at the bottom of each card. Empty: "Sin convenios."
  - **Procedencias**: table of LabOrigins (code, name, category, commune). Click row → `/laboratory/origins/${id}`. Empty: "Sin procedencias asociadas."
  - **Datos Generales**: address, contact info (email, phone, website), business activity, fiscal info. `<dl>` semantic markup.
  - **Contactos**: ONLY entity-level contacts (`LegalEntityContact[]`) — billing contacts live on the Convenios tab, not duplicated here. Empty: "Sin contactos generales."

### 3.2 Procedencias (`/laboratory/origins` + `/laboratory/origins/[id]`)

**List page**
- Search by `code` OR `name` (NFD-normalized).
- Filters: `category` (Select), `isActive`, `hasFtp` (boolean — derived from `reportDeliveryMethods.includes('FTP')`).
- Columns: Code, Name, Category badge, LegalEntity link, Convenio link, FTP indicator (icon if has FTP), Estado.
- Pagination: `usePagination(1, 20)`. URL state.
- Click row → `/laboratory/origins/${id}`.

**Detail page**
- Header: code, name, category badge, isActive badge.
- FM read-only banner.
- Cards (no tabs — flat layout):
  - **Datos Generales**: code, name, category, parent (link), receptionDays, receptionSchedule, sampleReceptionMode, reportDeliveryMethods (badges), notes
  - **Dirección**: street, streetNumber, unit, commune, city, phone, email
  - **Plazos de Entrega**: deliveryDaysBiopsy, deliveryDaysPap, deliveryDaysCytology, deliveryDaysIhc, deliveryDaysDefault
  - **Configuración FTP** (Collapsible, only shown if `hasFtpHost === true`): masked `***`, ftpPath. Note: server returns booleans, never raw ciphertext.
  - **Notificaciones críticas**: criticalNotificationEmails (list), sendsQualityReports
  - **Vinculación**: link to LegalEntity (`/clients/${legalEntityId}`), link to BillingAgreement (`/collections/agreements/${billingAgreementId}`)
  - **Subprocedencias** (only shown if children exist): table of children with code, name, category. Click → detail.

### 3.3 Convenios (`/collections/agreements` + `/collections/agreements/[id]`)

**List page**
- Search by `code` OR `name`.
- Filters: `status` (Select: Vigente/Expirado/Borrador/Todos), `isMonthlySettlement` (toggle), `expiringSoon` (smart filter: effectiveTo within 60 days).
- Columns: Code, Name, LegalEntity link, Status badge (color-coded), Payment Terms label, Effective To (if set), Líneas count, Procedencias count.
- Pagination + URL state.

**Detail page**
- Header: code, name, status badge, LegalEntity link.
- FM read-only banner.
- Tabs (default: `lineas`):
  - **Líneas de Precio**: table of BillingAgreementLines. Columns: Concept Code, Concept Name, Reference Price (CLP), Factor, Negotiated Price (CLP). Sortable by code/price. Empty: "Sin precios acordados."
  - **Datos Generales**: contractDate, effectiveFrom, effectiveTo, paymentTerms (label), customPaymentDays, billingDayOfMonth, isMonthlySettlement, billingModalities (badges), examTypes (badges). `<dl>` markup.
  - **Contactos**: BillingContact list. Columns: name, role, email (mailto link), phone (tel link), mobile, isPrimary badge. Empty: "Sin contactos de cobranza."
  - **Procedencias**: list of LabOrigins linked to this agreement. Click row → procedencia detail. Empty: "Sin procedencias vinculadas."

### 3.4 Catálogo CDC (`/settings/billing-concepts`)

**List page** (no detail page in MVP)
- Search by `code` OR `name`.
- No additional filters.
- Columns: Code (FONASA), Name, Description (truncated, full on hover via Tooltip), Reference Price (CLP).
- Pagination: 20/page. URL state.
- Note: settings nav doesn't filter by moduleKey, so no permission gating needed at list level.

---

## 4. Frontend infrastructure changes

### 4.1 Sidebar navigation (`apps/web/components/layouts/nav-main.tsx`)

Add to "Negocio" section:
- **Clientes** → `/clients` (`moduleKey: 'clients'`) — replaces existing placeholder

Add to "Negocio" → Cobranzas children:
- **Convenios** → `/collections/agreements`

Add to "Laboratorio" section:
- **Procedencias** → `/laboratory/origins` (`moduleKey: 'lab-origins'`)

Add to settings nav:
- **Catálogo de Cobros** → `/settings/billing-concepts`

### 4.2 Breadcrumbs (`apps/web/components/layouts/breadcrumbs.tsx`)

Add labels:
```typescript
'clients': 'Clientes',
'origins': 'Procedencias',
'agreements': 'Convenios',
'billing-concepts': 'Catálogo CDC',
```

Add UUID resolvers in `resolveUuid()`:
```typescript
case 'clients':
  return await api.get<{ legalName: string }>(`/legal-entities/${uuid}`).then(r => r.legalName);
case 'origins':
  return await api.get<{ name: string }>(`/lab-origins/${uuid}`).then(r => r.name);
case 'agreements':
  return await api.get<{ name: string }>(`/billing-agreements/${uuid}`).then(r => r.name);
```

### 4.3 Shared utilities

- `apps/web/lib/enum-labels.ts` — all enum label maps in Spanish
- `@zeru/shared` `formatCLP` accepts `number | string`

---

## 5. Empty states matrix

| Page/section | Empty condition | Display |
|--------------|-----------------|---------|
| Any list | No data at all | "No hay {entidad}" centered |
| Any list | Search has no results | "Sin resultados para '{query}'" |
| Client detail Convenios tab | `billingAgreements.length === 0` | "Este cliente no tiene convenios asociados." |
| Client detail Procedencias tab | `labOrigins.length === 0` | "Este cliente no tiene procedencias asociadas." |
| Client detail Contactos tab | `contacts.length === 0` | "Sin contactos generales." |
| Convenio detail Líneas tab | `lines.length === 0` | "Sin precios acordados." |
| Convenio detail Contactos tab | `contacts.length === 0` | "Sin contactos de cobranza." |
| Convenio detail Procedencias tab | `labOrigins.length === 0` | "Sin procedencias vinculadas." |
| Procedencia detail FTP card | `hasFtpHost === false` | Card hidden entirely |
| Procedencia detail Subprocedencias | `children.length === 0` | Card hidden entirely |

---

## 6. Error states

All pages handle 3 error types:
- **Loading**: Skeleton placeholders matching the layout
- **Network/server error**: Card with "No se pudo cargar {entidad}" + "Reintentar" button calling refetch
- **404 (detail pages)**: Centered card "No encontrado" + back button

Use `toast.error()` for action failures (after the API call already succeeded loading).

---

## 7. Responsive behavior

- All tables wrapped in `<div className="overflow-x-auto">`
- Mobile (`< md`): hide secondary columns (Comuna, Teléfono on Clients; Commune on Procedencias)
- Tab lists use `<TabsList>` which wraps naturally in shadcn

---

## 8. Permissions UI

When `canAccess(moduleKey) === false`:
- Sidebar item is hidden (existing behavior via `usePermissions`)
- Direct URL access: render a centered "Sin permisos para ver esta sección" card

When user has read but not write:
- "Editar" / "Crear" buttons are hidden (read-only scenario doesn't apply yet — all detail pages are read-only)

---

## 9. Cross-entity navigation map

```
Clientes detail
  ├─ Convenios tab card → /collections/agreements/{id}
  ├─ Procedencias tab row → /laboratory/origins/{id}
  └─ (back to /clients)

Convenios detail
  ├─ LegalEntity link → /clients/{id}
  ├─ Procedencias tab row → /laboratory/origins/{id}
  └─ (back to /collections/agreements)

Procedencias detail
  ├─ LegalEntity link → /clients/{id}
  ├─ BillingAgreement link → /collections/agreements/{id}
  ├─ Parent link → /laboratory/origins/{parentId}
  ├─ Children rows → /laboratory/origins/{id}
  └─ (back to /laboratory/origins)
```

---

## 10. Out of scope (defer to v2)

- **Editing** any FM-imported data (deferred until FM is retired)
- **Bulk operations** (activate/deactivate, export selected)
- **Excel/PDF export** (button placement reserved with "Próximamente" tooltip)
- **CDC reverse links** ("which convenios use this concept") — deferred, but spec note for v2
- **Activity/audit timeline** ("last synced from FM at...")
- **Real-time sync via SocketProvider** events
- **Manual record creation UI** (POST endpoints exist but no form yet)
- **Sortable columns** (acceptable for MVP, default alphabetical)
- **Detail page for BillingConcept** (181 records, list-only is sufficient)
- **Print stylesheets**
- **Filter by city/commune on Procedencias** (only category + isActive + hasFtp in MVP)
- **Liquidaciones tab on Convenios detail** (cobranzas module not yet built)
- **Global search / command palette**

---

## 11. Implementation order (critical path)

1. **Backend changes** (section 2) — must land first
2. **Shared infrastructure**: `formatCLP` to shared, `enum-labels.ts`, `module-definitions.ts` updates, RBAC seed
3. **Sidebar + breadcrumbs** (single PR)
4. **CDC catalog page** (simplest, validates end-to-end)
5. **Procedencias list + detail**
6. **Convenios list + detail**
7. **Clients list + detail** (most complex, depends on all FK targets existing)

---

## 12. File count

| File | Type |
|------|------|
| `apps/api/src/modules/legal-entities/legal-entities.service.ts` | Modify |
| `apps/api/src/modules/lab-origins/lab-origins.service.ts` | Modify |
| `apps/api/src/modules/billing/billing-agreements.service.ts` | Modify |
| `packages/shared/src/permissions/module-definitions.ts` | Modify |
| `packages/shared/src/utils/currency.ts` | Modify |
| `apps/web/lib/enum-labels.ts` | Create |
| `apps/web/components/layouts/nav-main.tsx` | Modify |
| `apps/web/components/layouts/breadcrumbs.tsx` | Modify |
| `apps/web/app/(dashboard)/clients/page.tsx` | Modify (replaces placeholder) |
| `apps/web/app/(dashboard)/clients/[id]/page.tsx` | Create |
| `apps/web/app/(dashboard)/laboratory/origins/page.tsx` | Create |
| `apps/web/app/(dashboard)/laboratory/origins/[id]/page.tsx` | Create |
| `apps/web/app/(dashboard)/collections/agreements/page.tsx` | Create |
| `apps/web/app/(dashboard)/collections/agreements/[id]/page.tsx` | Create |
| `apps/web/app/(dashboard)/settings/billing-concepts/page.tsx` | Create |

**Total**: 7 new pages + 8 modifications. Estimated effort: 2-3 days for one focused implementer.
