# Clients Page (LegalEntities) — Design Spec

**Date:** 2026-04-04
**Module:** `/clients`
**Status:** Proposed

---

## 1. UX Architecture Decisions

### List + Detail: Two Separate Pages (not side panel)

**Decision:** Two full pages — `/clients` (list) and `/clients/[id]` (detail).

**Rationale:**
- The detail view has 4 tabs (General, Convenios, Procedencias, Contactos), each with significant content. A Sheet/side panel at `sm:max-w-sm` (the current Sheet size) cannot accommodate tables-within-tables (BillingAgreement lines).
- This matches the existing pattern in the codebase: org-intelligence projects use `/projects` (list) and `/projects/[id]` (detail with tabs). Clients follow the same information architecture.
- Row click navigates via `router.push(`/clients/${id}`)`. Back navigation via browser back or a "Volver" button.

### Pagination: Client-side filtering with full dataset fetch

**Decision:** Fetch all ~422 records at once, filter/search client-side.

**Rationale:**
- 422 records is small enough for a single API call (~50KB payload). The existing `findAll` already loads everything with `orderBy: { legalName: 'asc' }`.
- Client-side search gives instant feedback (no network roundtrip per keystroke).
- Use the existing `useDebouncedSearch` hook for the search input.
- Use the existing `usePagination` hook for virtual pagination (20 rows per page) to avoid rendering all 422 DOM rows simultaneously.
- If the dataset grows past ~2,000 records, switch to server-side pagination with cursor-based `?page=1&perPage=20&search=` query params. For now, YAGNI.

### Editability: Read-only during FM migration, with visual indicator

**Decision:** Detail view is **read-only** with a subtle banner explaining FM is the source of truth.

**Rationale:**
- During migration, FM is the canonical source. Edits in Zeru would be overwritten on next sync.
- A small `outline` Badge or info bar at the top of the detail page: "Datos sincronizados desde FileMaker. Las ediciones se realizan en FM."
- Once FM is retired, remove the banner and enable inline editing. The API already has PATCH endpoints ready.

---

## 2. API Changes Required

### Modify `findAll` to include BillingAgreement count

The current `findAll` includes `_count: { select: { labOrigins: true } }` but not `billingAgreements`. Update:

```typescript
// legal-entities.service.ts → findAll
return client.legalEntity.findMany({
  orderBy: { legalName: 'asc' },
  include: {
    _count: {
      select: {
        labOrigins: true,
        billingAgreements: true,
      },
    },
  },
});
```

### Modify `findById` to include BillingAgreement lines and BillingContacts

The current `findById` selects `{ id, code, name, status }` for billingAgreements. Expand:

```typescript
billingAgreements: {
  where: { isActive: true },
  select: {
    id: true,
    code: true,
    name: true,
    status: true,
    paymentTerms: true,
    billingDayOfMonth: true,
    billingModalities: true,
    effectiveFrom: true,
    effectiveTo: true,
    _count: { select: { lines: true } },
    lines: {
      where: { isActive: true },
      select: {
        id: true,
        negotiatedPrice: true,
        referencePrice: true,
        factor: true,
        currency: true,
        billingConcept: { select: { id: true, code: true, name: true } },
      },
    },
    contacts: {
      where: { isActive: true },
      select: { id: true, name: true, role: true, email: true, phone: true, isPrimary: true },
    },
  },
},
```

---

## 3. File & Component Structure

```
apps/web/
  app/(dashboard)/clients/
    page.tsx                          # List page (replace placeholder)
    [id]/
      page.tsx                        # Detail page (new file)
  components/clients/
    clients-table.tsx                 # Table with search, pagination, row click
    clients-table-skeleton.tsx        # Loading skeleton for the table
    client-header.tsx                 # Detail header: RUT, name, badges, FM banner
    client-general-tab.tsx            # Address, contact, business activity
    client-convenios-tab.tsx          # BillingAgreements list with expandable lines
    client-procedencias-tab.tsx       # LabOrigins linked to this entity
    client-contactos-tab.tsx          # LegalEntityContact + BillingContact merged
    convenio-lines-table.tsx          # Expandable pricing lines sub-table
```

---

## 4. Component Specifications

### 4.1 List Page — `/clients/page.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ Clientes                                                │
│                                                         │
│ [🔍 Buscar por RUT o razón social...          ]         │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ RUT          Razón Social       Comuna   Tel   Conv │  │
│ │              (tradeName)                  Proc  Est │  │
│ ├─────────────────────────────────────────────────────┤  │
│ │ 76.123.456-7 LABORATORIO X...   Stgo    +569  3    │  │
│ │              (Lab X)                      12   ●    │  │
│ │ 96.789.012-3 CLINICA Y SA       Viña    +562  1    │  │
│ │              (Clínica Y)                   4   ●    │  │
│ │ ...                                                 │  │
│ ├─────────────────────────────────────────────────────┤  │
│ │ Mostrando 1-20 de 422          [< 1 2 3 ... 22 >]  │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**shadcn components used:**
- `Card`, `CardHeader`, `CardContent` — wraps the table
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` — the data table
- `Input` — search field
- `Badge` — "Activo"/"Inactivo" status, convenios/procedencias counts
- `Skeleton` — loading state (3 skeleton rows)
- `Button` — pagination controls

**Columns:**

| Column | Source | Format | Width |
|--------|--------|--------|-------|
| RUT | `rut` | `formatRut()` from `@zeru/shared` | `w-28` fixed |
| Razón Social | `legalName` + `tradeName` | legalName bold, tradeName muted below | flex grow |
| Comuna | `commune` | plain text, `—` if null | `w-24` |
| Teléfono | `phone` | plain text, `—` if null | `w-28` |
| Convenios | `_count.billingAgreements` | numeric Badge `outline` variant | `w-16` center |
| Procedencias | `_count.labOrigins` | numeric Badge `outline` variant | `w-16` center |
| Estado | `isActive` | Badge `default` green / `destructive` red | `w-16` center |

**Search logic:**
- Filter client-side on `rut` (normalized, no dots/dashes) OR `legalName` (case-insensitive) OR `tradeName` (case-insensitive).
- Uses `useDebouncedSearch(300)`.
- Pagination resets to page 1 when search changes.

**Stats bar** (optional, above table):
- Total: 422 | Clientes activos: 398 | Proveedores: 45
- Rendered as small muted text, not Cards (keep it lightweight).

### 4.2 Detail Page — `/clients/[id]/page.tsx`

```
┌─────────────────────────────────────────────────────────┐
│ ← Volver                                                │
│                                                         │
│ 76.123.456-7                                            │
│ LABORATORIO X LTDA.                                     │
│ [Cliente] [Proveedor] [Activo]                          │
│                                                         │
│ ⓘ Datos sincronizados desde FileMaker                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ General  Convenios (3)  Procedencias (12)  Contactos│  │
│ ├─────────────────────────────────────────────────────┤  │
│ │                                                     │  │
│ │  [Tab content here]                                 │  │
│ │                                                     │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**shadcn components used:**
- `Button` variant="ghost" — back navigation
- `Badge` — role badges (Cliente/Proveedor), status (Activo)
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — tab navigation with `variant="line"`
- Counts shown in tab triggers: "Convenios (3)"

#### 4.2.1 General Tab — `client-general-tab.tsx`

Two-column grid layout showing entity fields in a definition-list style.

```
┌─────────────────────────────────────┐
│ Información General                 │
│                                     │
│ RUT            76.123.456-7         │
│ Razón Social   LABORATORIO X LTDA.  │
│ Nombre Fant.   Lab X                │
│ Giro           Análisis clínicos    │
│                                     │
│ Dirección                           │
│                                     │
│ Calle          Av. Providencia      │
│ Número         1234                 │
│ Depto/Of.      Of. 501              │
│ Comuna         Providencia          │
│ Ciudad         Santiago             │
│                                     │
│ Contacto                            │
│                                     │
│ Email          contacto@labx.cl     │
│ Teléfono       +56 2 2345 6789      │
│ Sitio Web      www.labx.cl          │
└─────────────────────────────────────┘
```

**shadcn components used:**
- `Card`, `CardHeader`, `CardTitle`, `CardContent` — sections
- Custom `<dl>` definition list with Tailwind grid: `grid grid-cols-[auto_1fr] gap-x-6 gap-y-2`
- `dt` styled as `text-muted-foreground font-medium`, `dd` as plain text

#### 4.2.2 Convenios Tab — `client-convenios-tab.tsx`

List of BillingAgreements as cards. Each card is collapsible to show pricing lines.

```
┌─────────────────────────────────────────────┐
│ ▸ CON-001 — Convenio General                │
│   Estado: [Vigente]  Pago: 30 días          │
│   Vigencia: 01/01/2025 - 31/12/2025         │
│   Modalidades: [Liquidación] [Bono FONASA]  │
│   3 líneas de precio                        │
├─────────────────────────────────────────────┤
│  (expanded)                                 │
│  ┌────────────────────────────────────────┐  │
│  │ Concepto        Precio    Ref.   Fact. │  │
│  │ Biopsia         $12.500   $15k   0.83  │  │
│  │ PAP             $4.200    $5k    0.84  │  │
│  │ IHC             $28.000   $30k   0.93  │  │
│  └────────────────────────────────────────┘  │
│                                             │
│ 1 contacto de facturación                   │
│  María López — Jefa Cobranza                │
│  maria@labx.cl  +569 8765 4321              │
└─────────────────────────────────────────────┘
```

**shadcn components used:**
- `Card` — one per BillingAgreement
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` — expand/collapse lines
- `Badge` — status (Vigente/Expirado/Borrador), payment terms, modalities
- `Table` (inside collapsible) — pricing lines sub-table
- `Button` variant="ghost" with chevron icon — trigger

**Status badge mapping:**
```typescript
const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  ACTIVE:  { label: "Vigente",  variant: "default" },
  EXPIRED: { label: "Expirado", variant: "destructive" },
  DRAFT:   { label: "Borrador", variant: "outline" },
};
```

**Payment terms labels:**
```typescript
const PAYMENT_LABELS: Record<string, string> = {
  IMMEDIATE: "Contado",
  NET_15:    "15 días",
  NET_30:    "30 días",
  NET_45:    "45 días",
  NET_60:    "60 días",
  NET_90:    "90 días",
  CUSTOM:    "Personalizado",
};
```

#### 4.2.3 Procedencias Tab — `client-procedencias-tab.tsx`

Simple table of LabOrigins associated with this entity.

```
┌─────────────────────────────────────────────┐
│ Código    Nombre              Categoría     │
├─────────────────────────────────────────────┤
│ PROC-001  Consulta Dr. Pérez  [Consulta]    │
│ PROC-002  Centro Médico Norte [Ctr. Médico] │
│ PROC-003  Lab Auxiliar Sur    [Laboratorio]  │
└─────────────────────────────────────────────┘
```

**shadcn components used:**
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Badge` variant="secondary" — category

**Category labels:**
```typescript
const CATEGORY_LABELS: Record<string, string> = {
  CONSULTA:         "Consulta",
  CENTRO_MEDICO:    "Centro Médico",
  CLINICA_HOSPITAL: "Clínica/Hospital",
  LABORATORIO:      "Laboratorio",
  OTRO:             "Otro",
};
```

#### 4.2.4 Contactos Tab — `client-contactos-tab.tsx`

Merged view of `LegalEntityContact[]` + `BillingContact[]` (from each BillingAgreement). Grouped by source.

```
┌─────────────────────────────────────────────────┐
│ Contactos de la Entidad                         │
├─────────────────────────────────────────────────┤
│ ★ Juan Pérez — Gerente General                  │
│   juan@labx.cl  +569 1234 5678  [Principal]     │
│                                                 │
│ Ana Soto — Administradora                       │
│   ana@labx.cl   +569 8765 4321                  │
│                                                 │
│ Contactos de Facturación                        │
│ (Convenio CON-001)                              │
├─────────────────────────────────────────────────┤
│ ★ María López — Jefa Cobranza                   │
│   maria@labx.cl  +569 5555 1234  [Principal]    │
└─────────────────────────────────────────────────┘
```

**shadcn components used:**
- `Card` — grouped sections
- `Badge` variant="outline" — "Principal" for `isPrimary: true`
- Simple list layout (not a table — contacts are few and benefit from card-style display)

---

## 5. Data Types (Frontend)

```typescript
// types/clients.ts

interface LegalEntityListItem {
  id: string;
  rut: string;
  legalName: string;
  tradeName: string | null;
  commune: string | null;
  phone: string | null;
  isClient: boolean;
  isSupplier: boolean;
  isActive: boolean;
  _count: {
    labOrigins: number;
    billingAgreements: number;
  };
}

interface BillingAgreementLine {
  id: string;
  negotiatedPrice: string; // Decimal comes as string from API
  referencePrice: string | null;
  factor: string;
  currency: string;
  billingConcept: {
    id: string;
    code: string;
    name: string;
  };
}

interface BillingContactItem {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

interface BillingAgreementDetail {
  id: string;
  code: string;
  name: string;
  status: string;
  paymentTerms: string;
  billingDayOfMonth: number | null;
  billingModalities: string[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
  _count: { lines: number };
  lines: BillingAgreementLine[];
  contacts: BillingContactItem[];
}

interface LabOriginItem {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface LegalEntityContactItem {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface LegalEntityDetail {
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
  createdAt: string;
  updatedAt: string;
  contacts: LegalEntityContactItem[];
  bankAccounts: unknown[]; // not displayed yet
  labOrigins: LabOriginItem[];
  billingAgreements: BillingAgreementDetail[];
}
```

---

## 6. State Management & Data Flow

### List page

```
page.tsx
  └─ ClientsTable (client component)
       ├─ useApiQuery<LegalEntityListItem[]>("/legal-entities")
       ├─ useDebouncedSearch(300)
       ├─ usePagination(1, 20)
       ├─ computed: filteredItems (search filter)
       ├─ computed: paginatedItems (slice by page/perPage)
       └─ router.push(`/clients/${id}`) on row click
```

### Detail page

```
page.tsx
  └─ reads params.id
  └─ useApiQuery<LegalEntityDetail>(`/legal-entities/${id}`)
  └─ ClientHeader (rut, name, badges, FM banner)
  └─ Tabs
       ├─ ClientGeneralTab (entity fields in dl grid)
       ├─ ClientConveniosTab (billingAgreements with collapsible lines)
       ├─ ClientProcedenciasTab (labOrigins table)
       └─ ClientContactosTab (contacts + billingContacts merged)
```

No global state needed. Each page fetches its own data. The `useApiQuery` hook handles loading/error states.

---

## 7. Loading & Empty States

### List loading
- `ClientsTableSkeleton`: Card with 3 Skeleton rows (`h-10 w-full`), matching the existing chart-of-accounts pattern.

### List empty (no results)
- "No se encontraron clientes." centered muted text inside the Card.
- If search is active: "No hay resultados para '{search}'." with a "Limpiar búsqueda" button.

### Detail loading
- Same pattern as org-intelligence project detail: Skeleton blocks for header + tab area.

### Detail not found
- "Cliente no encontrado." with a "Volver a clientes" outline button.

---

## 8. Routing & Navigation

| Route | Page | Nav |
|-------|------|-----|
| `/clients` | List | Sidebar "Clientes" link (already exists) |
| `/clients/[id]` | Detail | Row click from list |

**Back navigation** from detail to list:
- `Button variant="ghost"` with left arrow icon + "Clientes" text at the top.
- Uses `router.push("/clients")` (not `router.back()`) to ensure consistent navigation.

**Breadcrumbs** (from the existing `Breadcrumbs` component in the layout header):
- List: `Clientes`
- Detail: `Clientes > {legalName}`

---

## 9. Future Considerations (Not in scope now)

1. **Inline editing** — Once FM is retired, add edit buttons on each tab. Use the existing PATCH API endpoint + optimistic updates.
2. **Server-side search** — If dataset grows past ~2,000 records, add `?search=&page=&perPage=` query params to the API.
3. **Export** — CSV export of the client list for billing staff.
4. **Procedencia detail drill-down** — Click a procedencia row to navigate to a hypothetical `/lab-origins/[id]` detail page.
5. **Activity log** — Show FM sync history (last synced timestamp, changes detected).
6. **Sidebar subnav** — If clients gets sub-pages (e.g., `/clients/import`), add collapsible sub-items like Cobranzas/Contabilidad.

---

## 10. Implementation Order

1. **API changes** — Update `findAll` (add billingAgreements count) and `findById` (add lines, contacts, payment details).
2. **Types** — Add `LegalEntityListItem` and `LegalEntityDetail` interfaces.
3. **List page** — Replace the placeholder `page.tsx` with `ClientsTable`.
4. **Detail page** — Create `[id]/page.tsx` with header + tabs.
5. **Tab components** — General, Convenios (with collapsible lines), Procedencias, Contactos.
6. **Polish** — Empty states, skeleton loading, FM banner.
