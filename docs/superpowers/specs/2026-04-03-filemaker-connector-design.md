# Conector FileMaker Data API para Zeru

**Fecha:** 2026-04-03
**Estado:** Aprobado
**Contexto:** Citolab opera su laboratorio sobre FileMaker Server con múltiples bases de datos (BIOPSIAS, PAPANICOLAOU, etc.). Zeru reemplazará gradualmente las funcionalidades de FM, comenzando por cobranzas. Durante la transición, ambos sistemas coexisten con sync bidireccional asíncrono.

---

## 1. Problema

Citolab usa FileMaker como sistema operacional central. Zeru necesita:
1. Leer datos de FM para mostrarlos en su UI moderna.
2. Escribir de vuelta a FM cuando se opera desde Zeru, para que usuarios que aún usan FM vean los cambios.
3. Explorar la estructura de FM (488 layouts, 9 bases de datos) para planificar la migración módulo a módulo.
4. Eventualmente desacoplar FM cuando toda la funcionalidad esté en Zeru.

## 2. Decisiones de diseño

1. **Híbrido: Discovery UI + Transformers por código.** La UI permite explorar layouts y campos de FM. Los mapeos de datos se implementan como transformers en código (type-safe, testeables).
2. **Sync asíncrono.** Las operaciones en Zeru se completan inmediatamente. La escritura a FM ocurre en background. FM no es punto de fallo para la UX.
3. **Datos nativos en Zeru con tabla de vínculo.** Los datos migrados viven como registros normales de Zeru. Un `FmSyncRecord` vincula cada registro Zeru con su contraparte en FM.
4. **HL7/FHIR como referencia para modelos Zeru.** Nomenclatura y estructura conceptual basada en HL7 FHIR donde aplique (ServiceRequest, Specimen, DiagnosticReport, Patient).
5. **Multi-database.** El auth service maneja sesiones independientes por base de datos FM.
6. **Solo Citolab.** Credenciales por env vars, sin UI multi-tenant de configuración.
7. **Scripts FM como puente temporal.** Algunos scripts FM se pueden invocar via Data API (con parámetros, no diálogos) durante la transición. Gradualmente se reimplemenan en Zeru.

## 3. FileMaker Data API — Referencia

### 3.1 Autenticación

- **Login:** `POST /fmi/data/vLatest/databases/{db}/sessions` con `Authorization: Basic base64(user:pass)` → token de sesión
- **Token TTL:** 15 minutos de inactividad. Cada request con el token resetea el timer.
- **Logout:** `DELETE /fmi/data/vLatest/databases/{db}/sessions/{token}`

### 3.2 Endpoints principales

| Operación | Método | Endpoint |
|-----------|--------|----------|
| Get records | GET | `/layouts/{layout}/records?_offset=1&_limit=100` |
| Get record | GET | `/layouts/{layout}/records/{id}` |
| Create record | POST | `/layouts/{layout}/records` |
| Update record | PATCH | `/layouts/{layout}/records/{id}` |
| Delete record | DELETE | `/layouts/{layout}/records/{id}` |
| Find records | POST | `/layouts/{layout}/_find` |
| Get layouts | GET | `/layouts` |
| Get layout metadata | GET | `/layouts/{layout}` |
| Get scripts | GET | `/scripts` |
| Run script | GET | `/layouts/{layout}/records?script={name}&script.param={json}` |
| Get databases | GET | `/databases` (Basic Auth) |

### 3.3 Find request

```json
{
  "query": [
    { "CODIGO INSTITUCION": "=BICE" },
    { "PERIODO COBRO": "1-2025" }
  ],
  "sort": [{ "fieldName": "FECHA", "sortOrder": "descend" }],
  "offset": "1",
  "limit": "50"
}
```

Soporta operadores FM: `=` (match exacto), `==` (literal), `*` (wildcard), `>`, `<`, `...` (rango), `omit: true`.

### 3.4 Response normalizado

```json
{
  "response": {
    "dataInfo": { "totalRecordCount": 2571 },
    "data": [{
      "recordId": "12176",
      "modId": "45",
      "fieldData": { "CAMPO": "valor" },
      "portalData": { "Portal Name": [{ "fieldData": {} }] }
    }]
  },
  "messages": [{ "code": "0", "message": "OK" }]
}
```

### 3.5 Scripts via Data API

- Se pueden **ejecutar** pero no leer el código fuente.
- Scripts con `Show Custom Dialog` u otros pasos interactivos: FM **salta** esos pasos (skip), lo que puede romper la lógica.
- Para usar scripts via API, deben recibir datos via `Get(ScriptParameter)` (JSON) en vez de diálogos.
- Scripts incompatibles se reimplementan en Zeru.

### 3.6 Limitaciones

- Paginación 1-based, máximo ~100 registros por request.
- Container fields requieren request separado para descargar binarios.
- Sin límites de uso desde FileMaker Server v21.1.1.
- Fechas en formato US (`MM/DD/YYYY`) por defecto; usar `dateformats: 2` para ISO 8601.

## 4. Estructura FM de Citolab — Discovery

### 4.1 Servidor

- **Host:** `rdp.citolab.cl` (acceso público HTTPS)
- **9 bases de datos:** BIOPSIAS (principal, 488 layouts), PAPANICOLAOU, BIOPSIAS LAB MALAGA, ExternosNueva, BIOPSIASRESPALDO, PAPANICOLAOUHISTORICO, SCANNER BIOPSIAS CITOLAB 2014, Scanner Listados, Texto
- **Credenciales:** mismo usuario para todas las DBs

### 4.2 Cobranzas en FM

| Entidad | Layout | Registros | Campos | Descripción |
|---------|--------|-----------|--------|-------------|
| Liquidación | `Liquidaciones` | 2,571 | 53 | Liquidación mensual por institución: período, totales por tipo (biopsias/pap/cito/inmuno), estado, pago, factura |
| Institución (cobranzas) | `FICHA INSTITUCION COBRANZAS` | — | 10 + 3 portales | Ficha de facturación: nombre, código, RUT, plazo pago. Portales: contactos, comunicaciones, historial liquidaciones |
| Estado de pago | `ESTADO PAGO INSTITUCIONES*` | — | 10 + 1 portal (70 campos) | Deuda acumulada por institución con historial de liquidaciones en portal |
| Conceptos de cobro | `Conceptos de cobro (CDC)*` | — | 4 | Catálogo: concepto, descripción, valor, código |
| CDC por procedencia | `conceptos de cobro procedencia` | — | 19 | Precios por cliente con factor multiplicador |
| Detalle exámenes | `Listado Cobros -` | — | 15 | Línea de detalle: fecha, informe, folio, paciente, procedencia, valor |

**Campos clave de Liquidaciones:**

```
__pk_liquidaciones_instituciones  (PK, number)
CODIGO INSTITUCION                (FK a procedencia, text)
PERIODO COBRO                     (text: "Enero 2025", "1-2025")
FECHA                             (date)
ESTADO                            (text)
TOTAL LIQUIDACIÓN                 (calculated, number)
TOTAL FINAL                       (number)
VALOR TOTAL BIOPSIAS              (number)
VALOR TOTAL PAP                   (number)
VALOR TOTAL CITOLOGÍAS            (number)
VALOR TOTAL INMUNOS               (number)
Nº DE BIOPSIAS / PAP / CITOLOGÍAS / INMUNOS  (counts)
FECHA FACTURA                     (date)
NUMERO DOCUMENTO                  (text, nº factura)
TIPO DE DOCUMENTO                 (text: "FACTURA")
MONTO CANCELADO                   (number)
FECHA PAGO                        (date)
MODO DE PAGO                      (text: "transferencia")
DEUDA ANTERIOR                    (number)
SALDO A FAVOR                     (number — ojo: a veces tiene texto mezclado)
PDF LIQUIDACION                   (container)
PDF Factura                       (container)
Confirmado                        (text: "Confirmado")
```

### 4.3 Procedencias (Clientes)

**Layout:** `Procedencias*` — 862 registros, 103 campos, 5 portales.

Es la tabla maestra de instituciones/clientes que envían muestras. Combina datos de identificación, dirección, comerciales, facturación, contactos, entrega de informes y calidad.

**Relación con cobranzas:**
- `Procedencias.codigo_unico` ↔ `Liquidaciones.CODIGO INSTITUCION`
- Relación con tabla `INSTITUCIONES` para RUT, razón social, plazo pago
- `conceptos de cobro procedencia` define precios por procedencia con factor multiplicador

**Hallazgos:**
- Procedencia ≠ Institución en FM. Una institución puede tener múltiples procedencias. En Zeru se normaliza como `Client` → `ClientLocation`.
- Campo `migrada: "SI"` indica migraciones previas parciales.
- Datos sucios frecuentes: campos numéricos con texto mezclado (ej: `SALDO A FAVOR: "172146por estudios descargados"`).
- Credenciales FTP en texto plano (servidor, usuario, contraseña para subida de informes).

### 4.4 Scripts de cobranzas

16 scripts de nivel raíz + carpetas. Scripts relevantes:

| Script | Función | API-compatible |
|--------|---------|----------------|
| `GENERAR LIQUIDACIÓN BIOPSIAS Y PAP 2026*` | Genera liquidación mensual | Requiere adaptación (usa diálogos) |
| `Generar PDF liquidación Mensual *` | Genera PDF de liquidación | Probablemente compatible |
| `Agregar concepto de cobro a Biopsia *` | Asocia CDC a biopsia | Requiere adaptación |
| `Agregar concepto de cobro a PAP *` | Asocia CDC a PAP | Requiere adaptación |
| `GUARDAR FACTURAS *` | Registra datos de facturación | Requiere verificación |
| `Buscar liquidaciones pagadas pero no confirmadas *` | Reconciliación | Probablemente compatible |
| `BUSCAR COBRANZAS` | Búsqueda general | Probablemente compatible |

## 5. Arquitectura del Conector

### 5.1 Módulo NestJS

```
apps/api/src/modules/filemaker/
├── filemaker.module.ts
├── services/
│   ├── fm-auth.service.ts          ← Gestión de sesiones FM
│   ├── fm-api.service.ts           ← Cliente HTTP genérico Data API
│   ├── fm-sync.service.ts          ← Orquestación de sync
│   └── fm-discovery.service.ts     ← Metadata y exploración
├── controllers/
│   ├── fm-discovery.controller.ts  ← API para UI de discovery
│   └── fm-sync.controller.ts       ← API para sync manual/status
├── transformers/
│   ├── transformer.interface.ts    ← Interfaz base
│   └── collections.transformer.ts  ← Primer transformer: cobranzas
└── dto/
    └── index.ts
```

### 5.2 FmAuthService — Gestión de sesiones

Maneja sesiones FM con auto-refresh por base de datos.

**Estrategia:**
- Token en memoria (no en DB — es efímero, 15 min TTL).
- **Lazy login:** no abre sesión al iniciar la app, sino al primer request.
- **Auto-refresh:** si un request recibe 401, hace login automático y reintenta una vez.
- **No keepalive:** sin ping para mantener sesión. Si expira, se reabre.
- **Multi-database:** Map de `database → token`. Cada DB tiene su propia sesión.

**Configuración (env vars):**

```
FM_HOST=https://rdp.citolab.cl
FM_DATABASE=BIOPSIAS
FM_USERNAME=Camilo Espinoza
FM_PASSWORD=****
```

**Error handling:**
- 401 → re-login + retry (1 vez)
- 403 → credenciales inválidas → log error, no retry
- 5xx → retry con backoff exponencial (máx 3 intentos)

### 5.3 FmApiService — Cliente HTTP genérico

Capa delgada que encapsula todos los endpoints de FM Data API.

**Base URL:** `{FM_HOST}/fmi/data/vLatest/databases/{database}`

**Métodos:**

```typescript
// Records
getRecords(db: string, layout: string, opts?: FmQueryOptions): Promise<FmResponse>
getRecord(db: string, layout: string, recordId: string): Promise<FmRecord>
findRecords(db: string, layout: string, query: FmFindQuery[], opts?: FmQueryOptions): Promise<FmResponse>
createRecord(db: string, layout: string, fieldData: Record<string, unknown>): Promise<{ recordId: string }>
updateRecord(db: string, layout: string, recordId: string, fieldData: Record<string, unknown>, modId?: string): Promise<void>
deleteRecord(db: string, layout: string, recordId: string): Promise<void>

// Metadata
getLayouts(db: string): Promise<FmLayout[]>
getLayoutMetadata(db: string, layout: string): Promise<FmLayoutMetadata>
getDatabases(): Promise<string[]>
getScripts(db: string): Promise<FmScript[]>

// Scripts
runScript(db: string, layout: string, script: string, param?: string): Promise<FmScriptResult>

// Utilities
findAll(db: string, layout: string, query: FmFindQuery[], opts?: Omit<FmQueryOptions, 'offset' | 'limit'>): Promise<FmRecord[]>
```

**Tipos:**

```typescript
interface FmQueryOptions {
  offset?: number;
  limit?: number;
  sort?: { fieldName: string; sortOrder: 'ascend' | 'descend' }[];
  portals?: string[];
  dateformats?: 0 | 1 | 2; // 0=US, 1=locale, 2=ISO8601
}

interface FmFindQuery {
  [field: string]: string;
  omit?: 'true';
}

interface FmRecord {
  recordId: string;
  modId: string;
  fieldData: Record<string, unknown>;
  portalData?: Record<string, Record<string, unknown>[]>;
}

interface FmResponse {
  records: FmRecord[];
  totalRecordCount: number;
}
```

**Normalización:** El servicio transforma la estructura FM (`response.data[].fieldData`) al formato `FmRecord` limpio antes de devolver.

**Auto-paginación:** `findAll()` itera con offset/limit hasta obtener todos los registros. Usa `dateformats: 2` (ISO 8601) por defecto.

### 5.4 FmDiscoveryService — Exploración

Expone métodos para explorar la estructura FM:

```typescript
listDatabases(): Promise<string[]>
listLayouts(db: string): Promise<FmLayout[]>
getLayoutFields(db: string, layout: string): Promise<FmFieldMetadata[]>
sampleRecords(db: string, layout: string, limit?: number): Promise<FmRecord[]>
searchRecords(db: string, layout: string, query: FmFindQuery[], opts?: FmQueryOptions): Promise<FmResponse>
listScripts(db: string): Promise<FmScript[]>
```

### 5.5 Transformers — Mapeo bidireccional

Interfaz base:

```typescript
interface FmTransformer<TZeru, TFmCreate = Record<string, unknown>> {
  readonly database: string;
  readonly layouts: { primary: string; related?: string[] };

  // FM → Zeru
  fromFm(record: FmRecord): TZeru;

  // Zeru → FM
  toFm(data: TZeru): TFmCreate;

  // Query builder
  buildFmQuery?(filters: Record<string, unknown>): FmFindQuery[];
}
```

**Características:**
- Un transformer por módulo: `CollectionsTransformer`, `ClientsTransformer`, etc.
- Mapeo 1→N soportado (un modelo Zeru → múltiples registros FM en distintos layouts).
- Type-safe: el transformer define tipos Zeru como genérico.
- Testeable: unit tests con datos mock sin conectar a FM.
- Multi-database: el transformer declara qué database FM usa (ej: Biopsias, Paps pueden tener transformers distintos que mapean al mismo modelo Zeru).
- Parsing robusto: los transformers manejan datos sucios de FM (números con texto, fechas en formato US, campos vacíos vs "0").

## 6. Almacenamiento y Sync

### 6.1 Schema de PostgreSQL

Las tablas del puente FM viven en un schema separado `citolab_fm` dentro de la misma base de datos de Zeru. Esto mantiene el proyecto limpio — los modelos core de Zeru (incluyendo laboratorio, cobranzas, clientes) van en `public` como siempre. Solo las tablas de sincronización específicas del puente Citolab-FM van en `citolab_fm`.

```
zeru (database)
├── public        ← Todo Zeru (core, lab, cobranzas, clientes, etc.)
└── citolab_fm    ← Solo el puente FM (sync records, sync logs)
```

Ventajas:
- Joins nativos entre schemas con full performance.
- Transacciones funcionan normalmente entre schemas.
- Prisma soporta `@@schema("citolab_fm")` nativamente.
- El día que Citolab se desacople de FM, se borra el schema y listo.

Configuración Prisma:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["public", "citolab_fm"]
}
```

### 6.2 Tabla de vínculo

```prisma
model FmSyncRecord {
  id          String       @id @default(uuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id])

  // Lado Zeru
  entityType  String       // "liquidation", "client", "service-request"
  entityId    String       // UUID del registro en Zeru

  // Lado FM
  fmDatabase  String       // "BIOPSIAS", "PAPANICOLAOU"
  fmLayout    String       // "Liquidaciones"
  fmRecordId  String       // recordId en FM
  fmModId     String?      // para concurrencia optimista

  // Sync metadata
  syncStatus  FmSyncStatus @default(SYNCED)
  lastSyncAt  DateTime
  syncError   String?
  retryCount  Int          @default(0)

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@unique([tenantId, entityType, entityId])
  @@unique([tenantId, fmDatabase, fmLayout, fmRecordId])
  @@index([syncStatus])
  @@schema("citolab_fm")
  @@map("fm_sync_records")
}

enum FmSyncStatus {
  SYNCED
  PENDING_TO_FM
  PENDING_TO_ZERU
  ERROR

  @@schema("citolab_fm")
}
```

### 6.3 Log de sincronización

```prisma
model FmSyncLog {
  id          String   @id @default(uuid())
  tenantId    String
  entityType  String
  entityId    String?
  fmRecordId  String?
  action      String   // "import", "export", "update", "delete", "error"
  direction   String   // "fm_to_zeru", "zeru_to_fm"
  details     Json?    // payload para debugging
  error       String?
  duration    Int?     // ms
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([entityType, action])
  @@schema("citolab_fm")
  @@map("fm_sync_logs")
}
```

### 6.4 Flujos de sync

#### Import inicial (FM → Zeru)

Se ejecuta una vez por módulo para la carga histórica:

1. `findAll()` pagina por todos los registros del layout FM.
2. El transformer convierte cada registro al modelo Zeru.
3. Se crea el registro nativo en Zeru (ej: `Liquidation`) + `FmSyncRecord` vinculando ambos IDs.
4. Idempotente: si ya existe el vínculo, lo salta.
5. Batch size configurable (default 50).

#### Event-driven (Zeru → FM)

Cuando un módulo Zeru crea/actualiza/elimina un registro sincronizado:

1. El módulo emite evento: `this.eventEmitter.emit('fm.sync', { entityType, entityId, action })`.
2. `FmSyncService` escucha, marca `FmSyncRecord` como `PENDING_TO_FM`.
3. En background: lee el registro Zeru, lo pasa por el transformer, escribe a FM.
4. Si éxito: marca `SYNCED`. Si falla: marca `ERROR` con mensaje.

#### Reconciliación periódica (FM → Zeru)

Cron opcional (cada 30 min) para capturar cambios hechos directamente en FM:

1. Busca registros FM modificados desde el último sync (por campo timestamp si existe).
2. Compara con datos en Zeru via `FmSyncRecord`.
3. Actualiza registros Zeru que difieren.

#### Retry automático

Cron cada 5 minutos procesa registros con `syncStatus: ERROR`:
- Máximo 5 reintentos con backoff exponencial.
- Después de 5 fallos: permanece en `ERROR`, se notifica.

## 7. Discovery UI

### 7.1 Ubicación

`/integrations/filemaker` — reemplaza el placeholder actual de integraciones.

### 7.2 Pestaña: Explorador

- **Estado de conexión:** indicador conectado/desconectado, botón "Probar conexión".
- **Lista de databases:** las 9 bases disponibles en el servidor.
- **Lista de layouts:** al seleccionar una DB, muestra layouts agrupados por carpeta.
- **Detalle de layout:** al seleccionar un layout:
  - Tabla de campos: nombre, tipo (text/number/date/container/calculation), result type.
  - Portales con sus campos.
  - **Registros de ejemplo:** primeros 10 registros del layout.
  - **Buscador:** panel de búsqueda con campos dinámicos del layout, soporte de operadores FM, resultados paginados.
- **Lista de scripts:** scripts disponibles agrupados por carpeta.

### 7.3 Pestaña: Sync Status

- Contadores: registros sincronizados, pendientes, con error (por módulo).
- Tabla de errores recientes con botón "Reintentar".
- Último sync por módulo con timestamp.
- Botón "Import inicial" por módulo (con confirmación).

## 8. Modelo Zeru para Cobranzas (primer módulo)

El módulo de cobranzas ya existe parcialmente en Zeru. El conector FM se integra con los modelos existentes. Los transformers mapean entre los campos FM y los modelos Zeru.

### 8.1 Mapeo conceptual

| FM | Zeru | Notas |
|----|------|-------|
| Procedencias (862 reg, `Procedencias*`) | `Client` + `ClientLocation` | Procedencia ≠ Institución. Se normaliza. |
| Instituciones | `Client` | RUT, razón social, plazo pago |
| Liquidaciones (2,571 reg, `Liquidaciones`) | `Liquidation` (modelo existente) | Mapeo directo con transformación de tipos |
| Conceptos de cobro | `BillingConcept` | Catálogo de conceptos |
| CDC por procedencia | `ClientPricing` | Precios por cliente con factor |
| Contactos (portal) | `ClientContact` | Normalizado desde portales FM |
| Comunicaciones (portal) | `ClientNote` | Historial de comunicaciones |

### 8.2 Consideraciones de mapeo

- **Período:** FM usa texto libre ("Enero 2025", "1-2025"). Zeru usa `Date` (primer día del mes).
- **Montos:** FM usa `number` con decimales flotantes. Zeru usa `Decimal` (Prisma) para precisión financiera.
- **Estado:** FM usa texto libre ("Confirmado", etc.). Zeru usa enum.
- **Datos sucios:** El transformer debe parsear campos como `SALDO A FAVOR: "172146por estudios descargados"` → extraer solo el número.
- **Containers (PDF):** Se descargan y almacenan en S3 via `FilesModule` existente.
- **Campos calculados:** `_TOTAL`, `TOTAL LIQUIDACIÓN`, `TOTAL MENSUAL` son read-only en FM. No se escriben de vuelta.

## 9. Seguridad

- Credenciales FM almacenadas en env vars (no en DB — single tenant).
- Session tokens FM en memoria, nunca persistidos.
- El módulo FileMaker requiere autenticación JWT + TenantGuard (como todos los módulos).
- La UI de discovery solo es accesible para roles con permiso `settings:manage-org` (via RBAC existente).
- Los datos de FM con credenciales FTP se encriptan al importar a Zeru (via `EncryptionService`).

## 10. Fuera de alcance (futuro)

- Sync en tiempo real (webhooks FM → Zeru). FM no tiene webhooks nativos.
- Multi-tenant (otros clientes conectando sus propios FM). Solo Citolab.
- Módulos más allá de cobranzas. Se migran incrementalmente, cada uno con su transformer.
- Reimplementación completa de scripts FM. Se hace gradualmente.
- Middleware Next.js para rutas FM. No aplica — FM es backend-only.
