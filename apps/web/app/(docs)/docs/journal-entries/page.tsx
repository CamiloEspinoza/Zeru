import { Endpoint, Hr } from "../components/endpoint";
import { CodeBlock } from "../components/code-block";

export default function JournalEntriesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">Endpoints</p>
        <h1 className="text-3xl font-bold text-white mb-4">
          Asientos Contables
        </h1>
        <p className="text-[15px] text-white/60 leading-relaxed">
          Crea, lee, postea y anula asientos contables. Un asiento nace en
          estado <code className="font-mono text-xs text-white/80">DRAFT</code>
          , se puede revisar y luego se postea a
          <code className="font-mono text-xs text-white/80"> POSTED</code>. Los
          asientos deben estar balanceados (débitos = créditos).
        </p>
      </div>

      {/* Lifecycle note */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/60 space-y-2">
        <p className="font-semibold text-white/80">Ciclo de vida de un asiento</p>
        <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
          <span className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">DRAFT</span>
          <span className="text-white/30">→ post →</span>
          <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">POSTED</span>
          <span className="text-white/30">→ void →</span>
          <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400">VOIDED</span>
        </div>
      </div>

      <Endpoint
        method="POST"
        path="/api/v1/journal-entries/batch"
        scope="journal-entries:write"
        description="Crea cientos o miles de asientos en una sola llamada. Cada asiento se valida individualmente; el resultado retorna creados y fallidos por índice para facilitar reconciliación en sistemas externos."
        params={[
          {
            name: "auto_post",
            type: "boolean",
            required: false,
            location: "body",
            description: "Si es true, crea asientos como POSTED. Requiere scope journal-entries:manage.",
          },
          {
            name: "entries",
            type: "array (1..1000)",
            required: true,
            location: "body",
            description: "Lista de asientos a crear.",
          },
          {
            name: "entries[].external_id",
            type: "string",
            required: false,
            location: "body",
            description: "ID externo del ERP para correlacionar respuesta.",
          },
          {
            name: "entries[].date",
            type: "string (YYYY-MM-DD)",
            required: true,
            location: "body",
            description: "Fecha del asiento.",
          },
          {
            name: "entries[].description",
            type: "string",
            required: true,
            location: "body",
            description: "Descripción del asiento.",
          },
          {
            name: "entries[].fiscalPeriodId",
            type: "string (uuid)",
            required: true,
            location: "body",
            description: "Periodo fiscal; debe existir y estar OPEN.",
          },
          {
            name: "entries[].lines",
            type: "array",
            required: true,
            location: "body",
            description: "Líneas contables (debe/haber balanceado).",
          },
        ]}
      >
        <CodeBlock
          tabs={[
            {
              label: "curl",
              code: `curl -X POST https://tu-instancia.zeru.app/api/v1/journal-entries/batch \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id" \\
  -H "Content-Type: application/json" \\
  -d '{
    "auto_post": false,
    "entries": [
      {
        "external_id": "ERP-INV-001",
        "date": "2024-01-15",
        "description": "Venta factura 001",
        "fiscalPeriodId": "uuid-del-periodo",
        "lines": [
          { "accountId": "uuid-caja", "debit": 100000, "credit": 0 },
          { "accountId": "uuid-ingresos", "debit": 0, "credit": 100000 }
        ]
      },
      {
        "external_id": "ERP-INV-002",
        "date": "2024-01-15",
        "description": "Asiento inválido de ejemplo",
        "fiscalPeriodId": "uuid-del-periodo",
        "lines": [
          { "accountId": "uuid-caja", "debit": 100000, "credit": 0 },
          { "accountId": "uuid-ingresos", "debit": 0, "credit": 90000 }
        ]
      }
    ]
  }'`,
            },
            {
              label: "JavaScript",
              code: `const res = await fetch('/api/v1/journal-entries/batch', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer zk_...',
    'X-Tenant-Id': 'your-tenant-id',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    auto_post: false,
    entries: batchEntries,
  }),
});

const result = await res.json();
for (const item of result.results) {
  if (item.status === 'created') {
    console.log(item.external_id, item.entry.id); // marcar contabilizado en ERP
  } else {
    console.error(item.external_id, item.error.code, item.error.message);
  }
}`,
            },
          ]}
        />
        <CodeBlock
          filename="Respuesta"
          language="json"
          code={`{
  "object": "batch_result",
  "total": 2,
  "created": 1,
  "failed": 1,
  "results": [
    {
      "index": 0,
      "external_id": "ERP-INV-001",
      "status": "created",
      "entry": { "id": "uuid", "number": 125, "status": "DRAFT" }
    },
    {
      "index": 1,
      "external_id": "ERP-INV-002",
      "status": "failed",
      "error": {
        "code": "unbalanced",
        "message": "Debe y Haber deben ser iguales"
      }
    }
  ]
}`}
        />
      </Endpoint>

      <Hr />

      {/* GET /v1/journal-entries */}
      <Endpoint
        method="GET"
        path="/api/v1/journal-entries"
        scope="journal-entries:read"
        description="Lista todos los asientos del tenant con paginación y filtros opcionales."
        params={[
          {
            name: "status",
            type: "DRAFT | POSTED | VOIDED",
            location: "query",
            description: "Filtra por estado",
          },
          {
            name: "page",
            type: "integer",
            location: "query",
            description: "Página (default: 1)",
          },
          {
            name: "perPage",
            type: "integer",
            location: "query",
            description: "Ítems por página (default: 20, max: 100)",
          },
        ]}
      >
        <CodeBlock
          code={`curl "https://tu-instancia.zeru.app/api/v1/journal-entries?status=DRAFT&page=1&perPage=20" \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id"`}
          language="bash"
          filename="curl"
        />
        <CodeBlock
          filename="Respuesta"
          code={`{
  "object": "list",
  "data": [
    {
      "id": "uuid",
      "number": 1,
      "date": "2024-01-15T00:00:00.000Z",
      "description": "Venta de productos",
      "status": "DRAFT",
      "fiscalPeriodId": "uuid",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 42,
  "has_more": true
}`}
          language="json"
        />
      </Endpoint>

      <Hr />

      {/* GET /v1/journal-entries/:id */}
      <Endpoint
        method="GET"
        path="/api/v1/journal-entries/:id"
        scope="journal-entries:read"
        description="Retorna el detalle completo de un asiento, incluyendo sus líneas."
        params={[
          {
            name: "id",
            type: "string (uuid)",
            required: true,
            location: "path",
            description: "UUID del asiento",
          },
        ]}
      >
        <CodeBlock
          filename="Respuesta"
          code={`{
  "object": "journal_entry",
  "id": "uuid",
  "number": 1,
  "date": "2024-01-15T00:00:00.000Z",
  "description": "Venta de productos",
  "status": "POSTED",
  "fiscalPeriodId": "uuid",
  "lines": [
    {
      "id": "uuid",
      "accountId": "uuid",
      "account": { "code": "1.1.1", "name": "Caja" },
      "debit": 100000,
      "credit": 0,
      "description": null
    },
    {
      "id": "uuid",
      "accountId": "uuid",
      "account": { "code": "4.1.1", "name": "Ingresos por ventas" },
      "debit": 0,
      "credit": 100000,
      "description": null
    }
  ]
}`}
          language="json"
        />
      </Endpoint>

      <Hr />

      {/* POST /v1/journal-entries */}
      <Endpoint
        method="POST"
        path="/api/v1/journal-entries"
        scope="journal-entries:write"
        description="Crea un nuevo asiento en estado DRAFT. Las líneas deben estar balanceadas (suma débitos = suma créditos)."
        params={[
          {
            name: "date",
            type: "string (YYYY-MM-DD)",
            required: true,
            location: "body",
            description: "Fecha de la transacción",
          },
          {
            name: "description",
            type: "string",
            required: true,
            location: "body",
            description: "Descripción del asiento",
          },
          {
            name: "fiscalPeriodId",
            type: "string (uuid)",
            required: true,
            location: "body",
            description: "ID del período fiscal. Ver /v1/fiscal-periods.",
          },
          {
            name: "lines",
            type: "array",
            required: true,
            location: "body",
            description: "Mínimo 2 líneas. Cada línea lleva accountId, debit y credit.",
          },
          {
            name: "lines[].accountId",
            type: "string (uuid)",
            required: true,
            location: "body",
            description: "ID de la cuenta contable",
          },
          {
            name: "lines[].debit",
            type: "number",
            required: true,
            location: "body",
            description: "Monto al debe (0 si es haber)",
          },
          {
            name: "lines[].credit",
            type: "number",
            required: true,
            location: "body",
            description: "Monto al haber (0 si es debe)",
          },
        ]}
      >
        <CodeBlock
          tabs={[
            {
              label: "curl",
              code: `curl -X POST https://tu-instancia.zeru.app/api/v1/journal-entries \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id" \\
  -H "Content-Type: application/json" \\
  -d '{
    "date": "2024-01-15",
    "description": "Pago de proveedor",
    "fiscalPeriodId": "uuid-del-periodo",
    "lines": [
      { "accountId": "uuid-cuentas-por-pagar", "debit": 50000, "credit": 0 },
      { "accountId": "uuid-banco", "debit": 0, "credit": 50000 }
    ]
  }'`,
            },
            {
              label: "JavaScript",
              code: `const res = await fetch('/api/v1/journal-entries', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer zk_...',
    'X-Tenant-Id': 'your-tenant-id',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    date: '2024-01-15',
    description: 'Pago de proveedor',
    fiscalPeriodId: 'uuid-del-periodo',
    lines: [
      { accountId: 'uuid-cuentas-por-pagar', debit: 50000, credit: 0 },
      { accountId: 'uuid-banco', debit: 0, credit: 50000 },
    ],
  }),
});

const entry = await res.json();
console.log(entry.id, entry.status); // uuid, "DRAFT"`,
            },
          ]}
        />
      </Endpoint>

      <Hr />

      {/* POST /v1/journal-entries/:id/post */}
      <Endpoint
        method="POST"
        path="/api/v1/journal-entries/:id/post"
        scope="journal-entries:manage"
        description="Postea un asiento en estado DRAFT. Una vez posteado, el asiento queda inmutable y afecta los reportes."
        params={[
          {
            name: "id",
            type: "string (uuid)",
            required: true,
            location: "path",
            description: "UUID del asiento a postear",
          },
        ]}
      >
        <CodeBlock
          code={`curl -X POST https://tu-instancia.zeru.app/api/v1/journal-entries/uuid/post \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id"`}
          language="bash"
          filename="curl"
        />
      </Endpoint>

      <Hr />

      {/* POST /v1/journal-entries/:id/void */}
      <Endpoint
        method="POST"
        path="/api/v1/journal-entries/:id/void"
        scope="journal-entries:manage"
        description="Anula un asiento posteado. El asiento queda en estado VOIDED y sus líneas no afectan los reportes."
        params={[
          {
            name: "id",
            type: "string (uuid)",
            required: true,
            location: "path",
            description: "UUID del asiento a anular",
          },
        ]}
      >
        <CodeBlock
          code={`curl -X POST https://tu-instancia.zeru.app/api/v1/journal-entries/uuid/void \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id"`}
          language="bash"
          filename="curl"
        />
      </Endpoint>
    </div>
  );
}
