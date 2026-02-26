const BASE_URL = 'https://tu-instancia.zeru.app';

export const DOCS: Record<string, string> = {
  overview: `# Zeru API — Visión General

La API pública de Zeru permite integrar tu contabilidad con cualquier sistema externo: ERP, e-commerce, facturación o herramientas internas.

## Base URL
${BASE_URL}/api

Todas las rutas de la API pública usan el prefijo /api/v1/.

## Autenticación
Cada petición requiere dos headers:
- Authorization: Bearer zk_<tu_api_key>
- X-Tenant-Id: <uuid_de_tu_organización>

## Formato de respuesta
- Listas: { object: "list", data: [...], total: number, has_more: boolean }
- Errores: { message: string, error: string, statusCode: number }

## Recursos disponibles
- /api/v1/accounts — Plan de cuentas (GET list, GET by id, POST create)
- /api/v1/journal-entries — Asientos contables (CRUD + batch + post + void)
- /api/v1/fiscal-periods — Períodos fiscales (GET list)
- /api/v1/reports/trial-balance — Balance de comprobación
- /api/v1/reports/general-ledger — Libro mayor por cuenta
- /api/v1/reports/income-statement — Estado de resultados IFRS

## Inicio rápido
1. Genera una API key desde Configuración → API Keys en la app de Zeru.
2. Copia tu Tenant ID desde Configuración → Organización.
3. Llama a ${BASE_URL}/api/v1/fiscal-periods para obtener los períodos activos.
4. Usa el fiscalPeriodId de un período OPEN para crear asientos.`,

  authentication: `# Autenticación

La API de Zeru usa API keys para autenticar las peticiones.

## Headers requeridos
| Header | Valor | Descripción |
|--------|-------|-------------|
| Authorization | Bearer zk_... | Tu API key completa |
| X-Tenant-Id | uuid | UUID de tu organización |

## Ejemplo
\`\`\`bash
curl ${BASE_URL}/api/v1/accounts \\
  -H "Authorization: Bearer zk_your_api_key_here" \\
  -H "X-Tenant-Id: 8a3f1b2c-..."
\`\`\`

## Scopes disponibles
| Scope | Descripción |
|-------|-------------|
| accounts:read | Leer el plan de cuentas |
| accounts:write | Crear y editar cuentas |
| journal-entries:read | Leer asientos contables |
| journal-entries:write | Crear asientos en borrador |
| journal-entries:manage | Postear y anular asientos |
| fiscal-periods:read | Leer períodos fiscales |
| reports:read | Acceder a reportes contables |

## Formato de la API key
Todas las claves tienen el prefijo zk_ seguido de ~65 caracteres aleatorios.
IMPORTANTE: La clave completa se muestra solo una vez al generarla. Zeru almacena solo un hash SHA-256.

## Errores de autenticación
- 401 Unauthorized: API key inválida, revocada, o no incluida
- 403 Forbidden: La API key no tiene el scope requerido
  Ejemplo: { "message": "This API key does not have the required scope: journal-entries:write" }`,

  accounts: `# Plan de Cuentas

El plan de cuentas es la estructura jerárquica de cuentas contables de tu organización.

---
## GET /api/v1/accounts
Scope: accounts:read
Retorna el plan de cuentas completo como un árbol jerárquico.

### Respuesta
\`\`\`json
{
  "object": "list",
  "data": [
    {
      "id": "uuid",
      "code": "1",
      "name": "Activos",
      "type": "ASSET",
      "parentId": null,
      "isActive": true,
      "children": [
        {
          "id": "uuid",
          "code": "1.1",
          "name": "Activo Corriente",
          "type": "ASSET",
          "parentId": "uuid",
          "isActive": true,
          "children": []
        }
      ]
    }
  ]
}
\`\`\`

---
## GET /api/v1/accounts/:id
Scope: accounts:read
Retorna una cuenta específica por su ID.

### Path params
- id (string, uuid, requerido): UUID de la cuenta contable

---
## POST /api/v1/accounts
Scope: accounts:write
Crea una nueva cuenta en el plan de cuentas.

### Body params
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| code | string | sí | Código de la cuenta (ej. "1.1.1") |
| name | string | sí | Nombre descriptivo de la cuenta |
| type | enum | sí | ASSET, LIABILITY, EQUITY, REVENUE, o EXPENSE |
| parentId | string (uuid) | no | ID de la cuenta padre |

### Respuesta (201)
\`\`\`json
{
  "object": "account",
  "id": "uuid",
  "code": "1.1.1",
  "name": "Caja",
  "type": "ASSET",
  "parentId": "uuid",
  "isActive": true
}
\`\`\``,

  'journal-entries': `# Asientos Contables

Crea, lee, postea y anula asientos contables.

## Ciclo de vida
DRAFT → (post) → POSTED → (void) → VOIDED

Un asiento nace en estado DRAFT. Una vez posteado (POSTED) queda inmutable y afecta los reportes. Se puede anular (VOIDED) para excluirlo de reportes.

Los asientos deben estar balanceados: suma(debit) == suma(credit).

---
## POST /api/v1/journal-entries/batch
Scope: journal-entries:write
Crea hasta 1000 asientos en una sola llamada. Cada asiento se valida individualmente; se retornan creados y fallidos por índice.

### Body params
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| auto_post | boolean | no | Si true, crea asientos como POSTED. Requiere journal-entries:manage |
| entries | array | sí | Lista de asientos (1-1000) |
| entries[].external_id | string | no | ID externo del ERP para correlacionar respuesta |
| entries[].date | string (YYYY-MM-DD) | sí | Fecha del asiento |
| entries[].description | string | sí | Descripción del asiento |
| entries[].fiscalPeriodId | string (uuid) | sí | Período fiscal (debe estar OPEN) |
| entries[].lines | array | sí | Líneas contables (debe/haber balanceado) |

### Respuesta
\`\`\`json
{
  "object": "batch_result",
  "total": 2,
  "created": 1,
  "failed": 1,
  "results": [
    { "index": 0, "external_id": "ERP-001", "status": "created", "entry": { "id": "uuid", "number": 125, "status": "DRAFT" } },
    { "index": 1, "external_id": "ERP-002", "status": "failed", "error": { "code": "unbalanced", "message": "Debe y Haber deben ser iguales" } }
  ]
}
\`\`\`

---
## GET /api/v1/journal-entries
Scope: journal-entries:read
Lista asientos del tenant con paginación y filtros.

### Query params
| Param | Tipo | Descripción |
|-------|------|-------------|
| status | DRAFT, POSTED, o VOIDED | Filtrar por estado |
| page | integer | Página (default: 1) |
| perPage | integer | Ítems por página (default: 20, max: 100) |

---
## GET /api/v1/journal-entries/:id
Scope: journal-entries:read
Retorna el detalle completo de un asiento, incluyendo sus líneas y las cuentas asociadas.

---
## POST /api/v1/journal-entries
Scope: journal-entries:write
Crea un nuevo asiento en estado DRAFT.

### Body params
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| date | string (YYYY-MM-DD) | sí | Fecha de la transacción |
| description | string | sí | Descripción del asiento |
| fiscalPeriodId | string (uuid) | sí | ID del período fiscal (debe estar OPEN) |
| lines | array | sí | Mínimo 2 líneas balanceadas |
| lines[].accountId | string (uuid) | sí | ID de la cuenta contable |
| lines[].debit | number | sí | Monto al debe (0 si es haber) |
| lines[].credit | number | sí | Monto al haber (0 si es debe) |

### Ejemplo
\`\`\`json
{
  "date": "2024-01-15",
  "description": "Pago de proveedor",
  "fiscalPeriodId": "uuid-del-periodo",
  "lines": [
    { "accountId": "uuid-cuentas-por-pagar", "debit": 50000, "credit": 0 },
    { "accountId": "uuid-banco", "debit": 0, "credit": 50000 }
  ]
}
\`\`\`

---
## POST /api/v1/journal-entries/:id/post
Scope: journal-entries:manage
Postea un asiento DRAFT. Una vez posteado, el asiento queda inmutable y afecta los reportes.

---
## POST /api/v1/journal-entries/:id/void
Scope: journal-entries:manage
Anula un asiento posteado. El asiento queda en estado VOIDED y sus líneas no afectan los reportes.`,

  'fiscal-periods': `# Períodos Fiscales

Los períodos fiscales definen los rangos de tiempo contables (mensual, trimestral, anual).
Al crear un asiento necesitas el ID del período correspondiente con estado OPEN.

---
## GET /api/v1/fiscal-periods
Scope: fiscal-periods:read
Lista todos los períodos fiscales del tenant, ordenados por fecha de inicio descendente.

### Respuesta
\`\`\`json
{
  "object": "list",
  "data": [
    {
      "id": "uuid",
      "name": "Enero 2024",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.999Z",
      "status": "OPEN",
      "tenantId": "uuid"
    },
    {
      "id": "uuid",
      "name": "Diciembre 2023",
      "startDate": "2023-12-01T00:00:00.000Z",
      "endDate": "2023-12-31T23:59:59.999Z",
      "status": "CLOSED",
      "tenantId": "uuid"
    }
  ]
}
\`\`\`

## Notas importantes
- El campo fiscalPeriodId en POST /v1/journal-entries debe corresponder a un período con status OPEN.
- Si el período está CLOSED, la creación del asiento será rechazada.
- Flujo típico: 1) Listar períodos, 2) Seleccionar el OPEN, 3) Usar su ID al crear asientos.`,

  reports: `# Reportes Contables

Todos los endpoints de reportes requieren el scope reports:read y retornan datos en tiempo real basados en asientos POSTED.

---
## GET /api/v1/reports/trial-balance
Scope: reports:read
Balance de comprobación para un período fiscal. Muestra débitos y créditos acumulados por cuenta.

### Query params
| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| fiscalPeriodId | string (uuid) | sí | ID del período fiscal |

### Respuesta
\`\`\`json
{
  "object": "list",
  "data": [
    {
      "account_id": "uuid",
      "code": "1.1.1",
      "name": "Caja",
      "type": "ASSET",
      "period_debits": "500000",
      "period_credits": "200000",
      "balance": "300000"
    }
  ]
}
\`\`\`

---
## GET /api/v1/reports/general-ledger
Scope: reports:read
Libro mayor de una cuenta: todos sus movimientos en un rango de fechas con saldo acumulado.

### Query params
| Param | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| accountId | string (uuid) | sí | ID de la cuenta |
| startDate | string (YYYY-MM-DD) | sí | Fecha de inicio |
| endDate | string (YYYY-MM-DD) | sí | Fecha de fin |

### Respuesta
\`\`\`json
{
  "object": "list",
  "data": [
    {
      "journal_entry_id": "uuid",
      "entry_date": "2024-01-05",
      "entry_number": 1,
      "description": "Cobro de cliente",
      "debit": "100000",
      "credit": "0",
      "running_balance": "100000"
    }
  ]
}
\`\`\`

---
## GET /api/v1/reports/income-statement
Scope: reports:read
Estado de resultados (IFRS IAS 1, método de función del gasto) para un período o año.

### Query params
| Param | Tipo | Descripción |
|-------|------|-------------|
| fiscalPeriodId | string (uuid) | ID del período fiscal (usar este o year) |
| year | integer | Año (ej. 2024). Alternativa a fiscalPeriodId |

### Secciones IFRS (campo ifrs_section)
- REVENUE — Ingresos de Actividades Ordinarias
- OTHER_INCOME — Otros Ingresos
- COST_OF_SALES — Costo de Ventas
- OPERATING_EXPENSE — Gastos de Administración y Ventas
- FINANCE_INCOME — Ingresos Financieros
- FINANCE_COST — Costos Financieros
- TAX_EXPENSE — Impuesto a las Ganancias

### Respuesta
\`\`\`json
{
  "object": "list",
  "data": [
    { "account_id": "uuid", "code": "4.1", "name": "Ingresos de Actividades Ordinarias", "type": "REVENUE", "ifrs_section": "REVENUE", "balance": "5000000" },
    { "account_id": "uuid", "code": "5.1", "name": "Costo de Ventas", "type": "EXPENSE", "ifrs_section": "COST_OF_SALES", "balance": "2000000" }
  ]
}
\`\`\``,

  errors: `# Códigos de Error

La API usa códigos HTTP estándar para indicar el resultado de cada petición.

## Tabla de códigos
| Código | Significado |
|--------|-------------|
| 200 OK | La petición fue exitosa |
| 201 Created | El recurso fue creado correctamente |
| 204 No Content | Operación exitosa sin datos de retorno (ej. DELETE) |
| 400 Bad Request | El cuerpo o los parámetros de la petición son inválidos |
| 401 Unauthorized | La API key es inválida, fue revocada, o no se incluyó |
| 403 Forbidden | La API key no tiene el scope necesario para esta operación |
| 404 Not Found | El recurso solicitado no existe o no pertenece al tenant |
| 422 Unprocessable | Los datos no pasan la validación (Zod). Ver campo errors |
| 429 Too Many Requests | Se superó el límite de 100 peticiones por minuto |
| 500 Server Error | Error interno del servidor |

## Formato de error

### Validación (400)
\`\`\`json
{
  "message": ["lines must contain at least 2 items", "date must be a valid date string"],
  "error": "Bad Request",
  "statusCode": 400
}
\`\`\`

### No encontrado (404)
\`\`\`json
{
  "message": "Journal entry not found",
  "error": "Not Found",
  "statusCode": 404
}
\`\`\`

### Sin permisos (403)
\`\`\`json
{
  "message": "This API key does not have the required scope: journal-entries:write",
  "error": "Forbidden",
  "statusCode": 403
}
\`\`\`

## Manejo de errores en JavaScript
\`\`\`js
const res = await fetch('${BASE_URL}/api/v1/journal-entries', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer zk_...',
    'X-Tenant-Id': '...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  const error = await res.json();
  console.error('Error', res.status, error.message);
  throw new Error(error.message);
}
const data = await res.json();
\`\`\``,

  'rate-limits': `# Rate Limiting

Para garantizar la estabilidad del servicio, la API aplica límites de uso por API key.

## Límites
- 100 peticiones por minuto
- El límite es por API key, no por IP

## Error al superar el límite (429)
\`\`\`json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
\`\`\`

## Buenas prácticas
- Implementa retry con backoff exponencial para manejar errores 429.
- Para sincronizaciones masivas, usa el endpoint batch en lugar de peticiones individuales.
- Cachea las respuestas de endpoints de solo lectura (plan de cuentas, períodos) que no cambian frecuentemente.

## Ejemplo de retry en JavaScript
\`\`\`js
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Rate limit exceeded after retries');
}
\`\`\``,
};

export const ALL_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/accounts', scope: 'accounts:read', description: 'Lista el plan de cuentas completo como árbol jerárquico' },
  { method: 'GET', path: '/api/v1/accounts/:id', scope: 'accounts:read', description: 'Obtiene una cuenta por su UUID' },
  { method: 'POST', path: '/api/v1/accounts', scope: 'accounts:write', description: 'Crea una nueva cuenta contable' },
  { method: 'GET', path: '/api/v1/journal-entries', scope: 'journal-entries:read', description: 'Lista asientos con paginación y filtros (status, page, perPage)' },
  { method: 'GET', path: '/api/v1/journal-entries/:id', scope: 'journal-entries:read', description: 'Obtiene el detalle completo de un asiento con sus líneas' },
  { method: 'POST', path: '/api/v1/journal-entries', scope: 'journal-entries:write', description: 'Crea un asiento en estado DRAFT' },
  { method: 'POST', path: '/api/v1/journal-entries/batch', scope: 'journal-entries:write', description: 'Crea hasta 1000 asientos en una sola llamada (soporta auto_post)' },
  { method: 'POST', path: '/api/v1/journal-entries/:id/post', scope: 'journal-entries:manage', description: 'Postea un asiento DRAFT, dejándolo inmutable' },
  { method: 'POST', path: '/api/v1/journal-entries/:id/void', scope: 'journal-entries:manage', description: 'Anula un asiento POSTED' },
  { method: 'GET', path: '/api/v1/fiscal-periods', scope: 'fiscal-periods:read', description: 'Lista períodos fiscales del tenant (OPEN, CLOSED)' },
  { method: 'GET', path: '/api/v1/reports/trial-balance', scope: 'reports:read', description: 'Balance de comprobación para un período fiscal (?fiscalPeriodId=uuid)' },
  { method: 'GET', path: '/api/v1/reports/general-ledger', scope: 'reports:read', description: 'Libro mayor de una cuenta en un rango de fechas (?accountId=&startDate=&endDate=)' },
  { method: 'GET', path: '/api/v1/reports/income-statement', scope: 'reports:read', description: 'Estado de resultados IFRS IAS 1 (?fiscalPeriodId=uuid o ?year=2024)' },
];
