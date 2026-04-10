# UI Design: Procedencias, Convenios y Catalogo CDC

**Fecha:** 2026-04-04
**Estado:** Propuesta
**Contexto:** Los modelos LabOrigin, BillingAgreement, BillingConcept y LegalEntity ya existen en Prisma con CRUD completo en el API. Se necesita disenar las paginas de gestion en el frontend. Son datos importados desde FM (862 procedencias, 471 convenios, 181 conceptos), por lo que el foco principal es visualizacion, filtrado y navegacion cruzada, no creacion masiva.
**Specs previos:** `2026-04-04-legal-entity-lab-origin-design.md`, `2026-04-05-billing-agreement-design.md`

---

## 1. Decisiones de arquitectura

### 1.1 Paginas independientes, no anidadas bajo /clients

**Decision: Paginas independientes con cross-links.**

Razones:
- LegalEntity (cliente) es una entidad transversal que aun no tiene UI propia (/clients es un placeholder)
- Los convenios viven en Cobranzas, no en Clientes — el ciclo es Convenio → Liquidacion → Cobranza
- Las procedencias viven en Laboratorio — son origenes operativos de muestras
- El catalogo CDC vive en Configuracion — es dato de referencia

Cross-links: cada entidad muestra enlaces clickeables a las entidades relacionadas. Ej: en la tabla de procedencias, el nombre de la persona juridica es un link a su ficha (cuando exista la pagina), y el convenio es un link a `/collections/agreements/:id`.

### 1.2 Rutas

| Pagina | Ruta | Seccion sidebar |
|--------|------|-----------------|
| Procedencias | `/laboratory/origins` | Laboratorio |
| Detalle procedencia | `/laboratory/origins/[id]` | Laboratorio |
| Convenios | `/collections/agreements` | Negocio > Cobranzas |
| Detalle convenio | `/collections/agreements/[id]` | Negocio > Cobranzas |
| Catalogo CDC | `/settings/billing-concepts` | Sistema > Configuracion |

### 1.3 Paginacion: server-side cursor para 862+ registros

Los endpoints actuales (`GET /lab-origins`, `GET /billing-agreements`) retornan todos los registros sin paginacion. Para 862 procedencias y 471 convenios, client-side filtering con fetch-all es aceptable en MVP (< 1MB payload, < 500ms). Pero se deberia agregar paginacion server-side en un segundo paso.

**MVP (implementar ahora):**
- Fetch-all con `useApiQuery` + client-side filtering/search
- `useDebouncedSearch` para busqueda por texto
- Client-side filtering por categoria/status/active

**Post-MVP (cuando supere ~1500 registros):**
- Agregar `?page=1&perPage=50&search=&category=` al endpoint API
- Usar `usePagination` hook existente
- Retornar formato `{ data: [], meta: { total, page, perPage, totalPages } }` (patron ya usado en personas)

### 1.4 Patron de componentes: pagina monolitica, no DataTable generico

El codebase no tiene un componente `DataTable` generico con tanstack-table. Cada pagina usa la primitiva `Table` de shadcn/ui con JSX directo (ver `chart-of-accounts/page.tsx`, `directorio/page.tsx`). Se sigue ese patron para consistencia.

Estructura por pagina:
```
app/(dashboard)/laboratory/origins/page.tsx      — lista
app/(dashboard)/laboratory/origins/[id]/page.tsx — detalle
```

No se crean componentes separados de columnas/filtros. Todo en el page.tsx como hace el resto del codebase.

---

## 2. Pagina: Procedencias (`/laboratory/origins`)

### 2.1 Layout

```
+------------------------------------------------------------------+
| Procedencias de Laboratorio                          [+ Nueva]   |
| Origenes de muestras para el laboratorio.                        |
+------------------------------------------------------------------+
| [Buscar por codigo o nombre...]                                  |
| Categoria: [Todas v]  Estado: [Todos v]                          |
+------------------------------------------------------------------+
| Codigo | Nombre           | Categoria      | Persona Juridica   |
|        |                  |                | Convenio  | Activo  |
|--------|------------------|----------------|--------------------|
| GJ     | Gaston Jarry     | CONSULTA       | —                  |
|        |                  |                | —         | Si      |
| VJN    | Vida Integra JN  | CENTRO_MEDICO  | Vidaintegra S.A.   |
|        |                  |                | VJN-001   | Si      |
| ...    |                  |                |           |         |
+------------------------------------------------------------------+
| Mostrando 388 de 862 procedencias                                |
+------------------------------------------------------------------+
```

### 2.2 Columnas de la tabla

| Columna | Campo | Render |
|---------|-------|--------|
| Codigo | `code` | `font-mono text-xs`, click navega a detalle |
| Nombre | `name` | Texto truncado, click navega a detalle |
| Categoria | `category` | `Badge variant="secondary"` con label espanol |
| Persona Juridica | `legalEntity.legalName` | Link a `/clients/:id` (futuro). Mostrar `—` si null |
| Convenio | `billingAgreement.code` | Link a `/collections/agreements/:id`. Mostrar `—` si null |
| Activo | `isActive` | `Badge variant="default"` (Si) / `Badge variant="outline"` (No) |

### 2.3 Filtros

**Busqueda** (Input, debounced 300ms):
- Filtra client-side por `code` o `name` (case-insensitive includes)

**Categoria** (Select):
- Opciones: Todas, Consulta, Centro Medico, Clinica/Hospital, Laboratorio, Otro
- Mapeo enum → label espanol

**Estado** (Select):
- Opciones: Todos, Activos, Inactivos

### 2.4 Labels espanol para enums

```typescript
const CATEGORY_LABELS: Record<string, string> = {
  CONSULTA: "Consulta",
  CENTRO_MEDICO: "Centro Medico",
  CLINICA_HOSPITAL: "Clinica / Hospital",
  LABORATORIO: "Laboratorio",
  OTRO: "Otro",
};

const RECEPTION_MODE_LABELS: Record<string, string> = {
  PRESENCIAL: "Presencial",
  COURIER: "Courier",
  AMBAS: "Presencial y Courier",
};

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  WEB: "Web",
  IMPRESO: "Impreso",
  FTP: "FTP",
  EMAIL: "Email",
};
```

### 2.5 Row click → detalle

Click en cualquier row navega a `/laboratory/origins/[id]`. Usar `router.push()` en el `TableRow` `onClick`.

### 2.6 Contador de resultados

Mostrar `Mostrando {filteredCount} de {totalCount} procedencias` debajo de la tabla.

---

## 3. Pagina: Detalle de Procedencia (`/laboratory/origins/[id]`)

### 3.1 Layout

```
+------------------------------------------------------------------+
| <- Volver a Procedencias                                         |
+------------------------------------------------------------------+
| [GJ] Gaston Jarry                          Badge: CONSULTA       |
| Badge: Activo                                                    |
+------------------------------------------------------------------+
|                                                                  |
| +-- Card: Datos Generales ------------------------------------+  |
| | Persona Juridica: [link]  |  Convenio: [link]              |  |
| | Modo Recepcion: Presencial | Entrega Informes: Web, FTP    |  |
| | Telefono: +56 2 ...       | Email: info@...                |  |
| | Notas: ...                                                  |  |
| +-------------------------------------------------------------+  |
|                                                                  |
| +-- Card: Direccion ------------------------------------------+  |
| | Calle: ... | Numero: ... | Oficina: ...                    |  |
| | Comuna: ... | Ciudad: ...                                   |  |
| +-------------------------------------------------------------+  |
|                                                                  |
| +-- Card: Plazos de Entrega ---------------------------------+  |
| | Biopsia: 5 dias  | PAP: 3 dias  | Citologia: 4 dias       |  |
| | IHC: 7 dias      | Default: 5 dias                         |  |
| +-------------------------------------------------------------+  |
|                                                                  |
| +-- Card: Configuracion FTP (colapsable) --------------------+  |
| | Host: ***  | Usuario: ***  | Path: /reports                |  |
| +-------------------------------------------------------------+  |
|                                                                  |
| +-- Card: Notificaciones ------------------------------------+  |
| | Emails criticos: email1@..., email2@...                     |  |
| | Envia informes de calidad: Si                               |  |
| +-------------------------------------------------------------+  |
|                                                                  |
| +-- Card: Subprocedencias (si tiene hijos) ------------------+  |
| | Codigo | Nombre | Categoria                                 |  |
| +-------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 3.2 Seccion de datos generales

Usar grid de 2 columnas con `Label` (muted) + valor. Patron del codebase: `text-xs text-muted-foreground` para label, `text-sm font-medium` para valor.

### 3.3 Links cruzados

- **Persona Juridica**: `legalEntity.legalName` como link a `/clients/:legalEntityId` (placeholder hasta que exista la pagina — puede mostrar tooltip con RUT)
- **Convenio**: `billingAgreement.code + " — " + billingAgreement.name` como link a `/collections/agreements/:billingAgreementId`
- **Procedencia padre**: si `parent` existe, mostrar link a `/laboratory/origins/:parentId`

### 3.4 FTP: campos sensibles

Los campos FTP (`encryptedFtpHost`, `encryptedFtpUser`, `encryptedFtpPassword`) se muestran enmascarados (`***`) por defecto. No se desencriptan en el frontend — el API no los devuelve desencriptados en `findById`. Mostrar solo si existen (no mostrar la card si no hay config FTP).

### 3.5 Datos de solo lectura vs editable

MVP: Solo lectura. Los datos vienen de FM via import/webhook. Editar en el detalle es futuro (requiere sync bidireccional Zeru → FM). Se puede agregar un boton "Editar" que abre un dialog con los campos editables cuando se implemente.

---

## 4. Pagina: Convenios (`/collections/agreements`)

### 4.1 Layout

```
+------------------------------------------------------------------+
| Convenios                                            [+ Nuevo]   |
| Acuerdos comerciales con personas juridicas.                     |
+------------------------------------------------------------------+
| [Buscar por codigo o nombre...]                                  |
| Estado: [Todos v]                                                |
+------------------------------------------------------------------+
| Codigo | Nombre              | Persona Juridica | Estado        |
|        |                     | Plazo Pago  | Liq. Mensual | Lineas|
|--------|---------------------|----------------|---------------|
| ALM    | Almacenes Paris      | ALMACENES...   | ACTIVE        |
|        |                     | NET_30     | Si           | 8     |
| SVBCH  | Serv. Bechtel        | Bechtel Ltd    | EXPIRED       |
|        |                     | NET_60     | No           | 3     |
+------------------------------------------------------------------+
| Mostrando 471 convenios                                          |
+------------------------------------------------------------------+
```

### 4.2 Columnas de la tabla

| Columna | Campo | Render |
|---------|-------|--------|
| Codigo | `code` | `font-mono text-xs`, click navega a detalle |
| Nombre | `name` | Texto, click navega a detalle |
| Persona Juridica | `legalEntity.legalName` | Link futuro a `/clients/:id` |
| Estado | `status` | Badge con color: ACTIVE=default, EXPIRED=destructive, DRAFT=outline |
| Plazo Pago | `paymentTerms` | Label espanol (ej: "30 dias") |
| Liq. Mensual | `isMonthlySettlement` | "Si" / "No" |
| Lineas | `_count.lines` | Numero, indica cuantos precios tiene |

### 4.3 Labels espanol para enums

```typescript
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  EXPIRED: "Expirado",
  DRAFT: "Borrador",
};

const STATUS_VARIANTS: Record<string, "default" | "destructive" | "outline"> = {
  ACTIVE: "default",
  EXPIRED: "destructive",
  DRAFT: "outline",
};

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  IMMEDIATE: "Inmediato",
  NET_15: "15 dias",
  NET_30: "30 dias",
  NET_45: "45 dias",
  NET_60: "60 dias",
  NET_90: "90 dias",
  CUSTOM: "Personalizado",
};

const MODALITY_LABELS: Record<string, string> = {
  MONTHLY_SETTLEMENT: "Liquidacion Mensual",
  FONASA_VOUCHER: "Bono FONASA",
  ISAPRE_VOUCHER: "Bono ISAPRE",
  CASH: "Efectivo",
  CHECK: "Cheque",
  BANK_TRANSFER: "Transferencia",
  OTHER: "Otro",
};
```

### 4.4 Filtros

**Busqueda** (Input, debounced 300ms):
- Filtra client-side por `code`, `name`, o `legalEntity.legalName`

**Estado** (Select):
- Opciones: Todos, Activo, Expirado, Borrador

---

## 5. Pagina: Detalle de Convenio (`/collections/agreements/[id]`)

### 5.1 Layout con Tabs

```
+------------------------------------------------------------------+
| <- Volver a Convenios                                            |
+------------------------------------------------------------------+
| [ALM] Almacenes Paris                     Badge: ACTIVE          |
| Persona Juridica: Almacenes Paris S.A. [link]                    |
+------------------------------------------------------------------+
| [Datos Generales] [Lineas de Precio] [Contactos] [Procedencias]  |
+------------------------------------------------------------------+
```

### 5.2 Tab: Datos Generales

Grid de 2 o 3 columnas con labels y valores:

| Campo | Render |
|-------|--------|
| Plazo de Pago | Label espanol del enum |
| Dias personalizados | Solo si paymentTerms === CUSTOM |
| Dia de Facturacion | Numero + "de cada mes" |
| Liquidacion Mensual | "Si" / "No" |
| Modalidades de Cobro | Badges por cada modalidad |
| Tipos de Examen | Badges por cada tipo |
| Fecha Contrato | Formato dd/MM/yyyy |
| Vigencia | effectiveFrom — effectiveTo |
| Notas | Texto libre |

### 5.3 Tab: Lineas de Precio

Tabla con los `BillingAgreementLine` del convenio. El endpoint `findById` ya los incluye con `billingConcept` expandido.

| Columna | Campo | Render |
|---------|-------|--------|
| Codigo CDC | `billingConcept.code` | `font-mono text-xs` |
| Concepto | `billingConcept.name` | Texto |
| Factor | `factor` | Decimal con 4 decimales (ej: 0.7500) |
| Precio Negociado | `negotiatedPrice` | Formato moneda CLP (ej: $12.500) |
| Precio Referencia | `referencePrice` o `billingConcept.referencePrice` | Formato moneda CLP, color muted |

Esta tabla no necesita filtros — el maximo son 23 lineas por convenio (promedio 4.6).

### 5.4 Tab: Contactos

Tabla simple con los `BillingContact` del convenio.

| Columna | Campo | Render |
|---------|-------|--------|
| Nombre | `name` | Texto + Badge "Principal" si `isPrimary` |
| Cargo | `role` | Texto muted |
| Email | `email` | Link `mailto:` |
| Telefono | `phone` | Texto |
| Celular | `mobile` | Texto |

### 5.5 Tab: Procedencias

Tabla de los `LabOrigin` vinculados a este convenio. El endpoint `findById` ya los incluye.

| Columna | Campo | Render |
|---------|-------|--------|
| Codigo | `code` | Link a `/laboratory/origins/:id` |
| Nombre | `name` | Texto |
| Categoria | `category` | Badge |

---

## 6. Pagina: Catalogo CDC (`/settings/billing-concepts`)

### 6.1 Layout

```
+------------------------------------------------------------------+
| Catalogo de Conceptos de Cobro                                   |
| Codigos FONASA y conceptos facturables de referencia.            |
+------------------------------------------------------------------+
| [Buscar por codigo o nombre...]                                  |
+------------------------------------------------------------------+
| Codigo    | Nombre                          | Precio Referencia  |
|-----------|--------------------------------|---------------------|
| 0801001   | PAPANICOLAOU                    | $8.500              |
| 0801004   | ESTUDIO INMUNOHISTOQUIMICO      | $45.000             |
| 0801008   | ESTUDIO HISTOLOGICO             | $12.000             |
| ...       |                                |                     |
+------------------------------------------------------------------+
| 181 conceptos                                                    |
+------------------------------------------------------------------+
```

### 6.2 Columnas

| Columna | Campo | Render |
|---------|-------|--------|
| Codigo | `code` | `font-mono text-xs` |
| Nombre | `name` | Texto |
| Descripcion | `description` | Texto muted, truncado |
| Precio Referencia | `referencePrice` | Formato moneda CLP |

### 6.3 Filtros

Solo busqueda por `code` o `name`. No se necesitan filtros adicionales para 181 registros.

### 6.4 No hay pagina de detalle

Es una tabla de referencia plana. No tiene relaciones complejas que justifiquen un detalle separado. Si se necesita editar un precio de referencia, se puede hacer inline o con un dialog (futuro).

---

## 7. Navegacion: Cambios al sidebar

### 7.1 Seccion Laboratorio — agregar "Procedencias"

```typescript
// En nav-main.tsx, seccion "Laboratorio"
{
  label: "Laboratorio",
  items: [
    { title: "Recepcion", href: "/laboratory/reception", icon: InboxIcon, moduleKey: "lab-reception" },
    { title: "Procesamiento", href: "/laboratory/processing", icon: MicroscopeIcon, moduleKey: "lab-processing" },
    { title: "Informes", href: "/laboratory/reports", icon: MedicalFileIcon, moduleKey: "lab-reports" },
    { title: "Codificacion", href: "/laboratory/coding", icon: BarCode01Icon, moduleKey: "lab-coding" },
    { title: "Procedencias", href: "/laboratory/origins", icon: Building03Icon, moduleKey: "lab-origins" },
  ],
}
```

Icono: `Building03Icon` (ya importado, representa establecimientos/locales).

### 7.2 Seccion Cobranzas — agregar "Convenios"

```typescript
// En nav-main.tsx, seccion "Cobranzas"
{
  title: "Cobranzas",
  href: "/collections",
  icon: MoneyReceive01Icon,
  moduleKey: "collections",
  items: [
    { title: "Liquidaciones", href: "/collections/liquidations" },
    { title: "Seguimiento", href: "/collections/tracking" },
    { title: "Convenios", href: "/collections/agreements" },
  ],
}
```

### 7.3 Seccion Configuracion — agregar "Catalogo CDC"

```typescript
// En settingsNav, agregar:
{ title: "Catalogo CDC", href: "/settings/billing-concepts", icon: BarCode01Icon },
```

### 7.4 Breadcrumbs — agregar labels

```typescript
// En breadcrumbs.tsx LABELS:
origins: "Procedencias",
agreements: "Convenios",
"billing-concepts": "Catalogo CDC",
```

Tambien agregar resolvers para UUIDs de procedencias y convenios:

```typescript
case "origins": {
  const res = await api.get(`/lab-origins/${uuid}`);
  return res.name ?? null;
}
case "agreements": {
  const res = await api.get(`/billing-agreements/${uuid}`);
  return res.name ?? null;
}
```

---

## 8. Cross-links: como navegar entre entidades

### 8.1 Diagrama de navegacion

```
LegalEntity (Persona Juridica)
  ├── ver convenios → /collections/agreements?legalEntityId=xxx (filtro)
  └── ver procedencias → /laboratory/origins?legalEntityId=xxx (filtro)

BillingAgreement (Convenio)
  ├── persona juridica → /clients/:legalEntityId (futuro)
  ├── lineas de precio → tab "Lineas de Precio" en detalle
  ├── contactos → tab "Contactos" en detalle
  └── procedencias → tab "Procedencias" en detalle

LabOrigin (Procedencia)
  ├── persona juridica → /clients/:legalEntityId (futuro)
  ├── convenio → /collections/agreements/:billingAgreementId
  ├── procedencia padre → /laboratory/origins/:parentId
  └── subprocedencias → listado en detalle
```

### 8.2 Implementacion: links como `<Link>` de Next.js

Donde la pagina destino existe, usar `<Link href={...}>`. Donde no existe aun (/clients/:id), mostrar el nombre como texto plano con tooltip que muestre el RUT. Cuando se implemente la pagina de clientes, convertir a link.

### 8.3 Filtros por query param (futuro)

Las tablas de procedencias y convenios deberian soportar `?legalEntityId=xxx` en la URL para pre-filtrar. Esto permite que la futura pagina de LegalEntity tenga links como "Ver procedencias de esta institucion" que lleven a `/laboratory/origins?legalEntityId=xxx`. Se implementa cuando se cree la pagina de LegalEntity.

---

## 9. Estructura de archivos a crear

```
apps/web/app/(dashboard)/laboratory/origins/
  page.tsx                    — Lista de procedencias con tabla, busqueda, filtros
  [id]/
    page.tsx                  — Detalle de procedencia (read-only cards)

apps/web/app/(dashboard)/collections/agreements/
  page.tsx                    — Lista de convenios con tabla, busqueda, filtros
  [id]/
    page.tsx                  — Detalle de convenio con tabs

apps/web/app/(dashboard)/settings/billing-concepts/
  page.tsx                    — Tabla simple del catalogo CDC
```

### 9.1 Archivos a modificar

```
apps/web/components/layouts/nav-main.tsx     — Agregar items al sidebar
apps/web/components/layouts/breadcrumbs.tsx  — Agregar labels y UUID resolvers
```

### 9.2 No se crean componentes compartidos nuevos

Se reutilizan los existentes: `Table`, `Badge`, `Input`, `Select`, `Card`, `Tabs`, `Skeleton`, `Button`, `Dialog`. No se necesitan componentes de dominio nuevos — la complejidad de cada pagina no justifica extraer componentes.

---

## 10. API: cambios necesarios

### 10.1 Endpoints existentes (suficientes para MVP)

| Endpoint | Usado por |
|----------|-----------|
| `GET /lab-origins` | Lista de procedencias |
| `GET /lab-origins/:id` | Detalle de procedencia |
| `GET /billing-agreements` | Lista de convenios |
| `GET /billing-agreements/:id` | Detalle de convenio (incluye lines, contacts, labOrigins) |
| `GET /billing-concepts` | Catalogo CDC |

### 10.2 Mejoras post-MVP

- Agregar `?search=&category=&isActive=&page=&perPage=` a `GET /lab-origins`
- Agregar `?search=&status=&page=&perPage=` a `GET /billing-agreements`
- Agregar `?search=` a `GET /billing-concepts`

---

## 11. Formato de moneda CLP

Usar `Intl.NumberFormat` para formatear precios:

```typescript
function formatCLP(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
```

---

## 12. Orden de implementacion sugerido

1. **Catalogo CDC** — pagina mas simple, sin detalle, sin filtros complejos. Sirve para validar que el fetch funciona.
2. **Lista de Procedencias** — tabla con filtros, establece el patron de tabla + busqueda + filtros.
3. **Detalle de Procedencia** — pagina de detalle con cards, establece el patron de detalle.
4. **Lista de Convenios** — reutiliza el patron de tabla de procedencias.
5. **Detalle de Convenio** — pagina mas compleja con tabs. Deja para el final.
6. **Sidebar + Breadcrumbs** — se puede hacer al inicio o al final, son cambios menores.

---

## 13. Fuera de alcance

- Pagina de LegalEntity / Clientes (tiene su propio spec futuro)
- Edicion inline o via dialog de procedencias/convenios (requiere sync Zeru → FM)
- Creacion de nuevos convenios/procedencias desde la UI (los datos vienen de FM)
- Export a Excel/PDF de las tablas
- Paginacion server-side (MVP usa fetch-all + client filter)
- Componente DataTable generico con tanstack-table (YAGNI hasta que haya 5+ tablas similares)
