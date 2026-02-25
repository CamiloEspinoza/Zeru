import { Endpoint, Hr } from "../components/endpoint";
import { CodeBlock } from "../components/code-block";

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">Endpoints</p>
        <h1 className="text-3xl font-bold text-white mb-4">Reportes</h1>
        <p className="text-[15px] text-white/60 leading-relaxed">
          Todos los endpoints de reportes requieren el scope{" "}
          <code className="font-mono text-xs text-white/80">reports:read</code>{" "}
          y retornan datos en tiempo real basados en asientos{" "}
          <code className="font-mono text-xs text-white/80">POSTED</code>.
        </p>
      </div>

      {/* GET /v1/reports/trial-balance */}
      <Endpoint
        method="GET"
        path="/api/v1/reports/trial-balance"
        scope="reports:read"
        description="Balance de comprobación para un período fiscal. Muestra los débitos y créditos acumulados por cuenta."
        params={[
          {
            name: "fiscalPeriodId",
            type: "string (uuid)",
            required: true,
            location: "query",
            description: "ID del período fiscal",
          },
        ]}
      >
        <CodeBlock
          code={`curl "https://tu-instancia.zeru.app/api/v1/reports/trial-balance?fiscalPeriodId=uuid" \\
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
      "account_id": "uuid",
      "code": "1.1.1",
      "name": "Caja",
      "type": "ASSET",
      "period_debits": "500000",
      "period_credits": "200000",
      "balance": "300000"
    }
  ]
}`}
          language="json"
        />
      </Endpoint>

      <Hr />

      {/* GET /v1/reports/general-ledger */}
      <Endpoint
        method="GET"
        path="/api/v1/reports/general-ledger"
        scope="reports:read"
        description="Libro mayor de una cuenta: todos sus movimientos en un rango de fechas con saldo acumulado."
        params={[
          {
            name: "accountId",
            type: "string (uuid)",
            required: true,
            location: "query",
            description: "ID de la cuenta",
          },
          {
            name: "startDate",
            type: "string (YYYY-MM-DD)",
            required: true,
            location: "query",
            description: "Fecha de inicio del rango",
          },
          {
            name: "endDate",
            type: "string (YYYY-MM-DD)",
            required: true,
            location: "query",
            description: "Fecha de fin del rango",
          },
        ]}
      >
        <CodeBlock
          code={`curl "https://tu-instancia.zeru.app/api/v1/reports/general-ledger?accountId=uuid&startDate=2024-01-01&endDate=2024-01-31" \\
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
      "journal_entry_id": "uuid",
      "entry_date": "2024-01-05",
      "entry_number": 1,
      "description": "Cobro de cliente",
      "debit": "100000",
      "credit": "0",
      "running_balance": "100000"
    },
    {
      "journal_entry_id": "uuid",
      "entry_date": "2024-01-10",
      "entry_number": 3,
      "description": "Pago de servicios",
      "debit": "0",
      "credit": "30000",
      "running_balance": "70000"
    }
  ]
}`}
          language="json"
        />
      </Endpoint>

      <Hr />

      {/* GET /v1/reports/income-statement */}
      <Endpoint
        method="GET"
        path="/api/v1/reports/income-statement"
        scope="reports:read"
        description="Estado de resultados (IFRS IAS 1, método de función del gasto) para un período o año."
        params={[
          {
            name: "fiscalPeriodId",
            type: "string (uuid)",
            location: "query",
            description: "ID del período fiscal (usar este o year)",
          },
          {
            name: "year",
            type: "integer",
            location: "query",
            description: "Año (ej. 2024). Alternativa a fiscalPeriodId.",
          },
        ]}
      >
        <CodeBlock
          tabs={[
            {
              label: "Por período",
              code: `curl "https://tu-instancia.zeru.app/api/v1/reports/income-statement?fiscalPeriodId=uuid" \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id"`,
            },
            {
              label: "Por año",
              code: `curl "https://tu-instancia.zeru.app/api/v1/reports/income-statement?year=2024" \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id"`,
            },
          ]}
        />
        <CodeBlock
          filename="Respuesta"
          code={`{
  "object": "list",
  "data": [
    {
      "account_id": "uuid",
      "code": "4.1",
      "name": "Ingresos de Actividades Ordinarias",
      "type": "REVENUE",
      "ifrs_section": "REVENUE",
      "balance": "5000000"
    },
    {
      "account_id": "uuid",
      "code": "5.1",
      "name": "Costo de Ventas",
      "type": "EXPENSE",
      "ifrs_section": "COST_OF_SALES",
      "balance": "2000000"
    }
  ]
}`}
          language="json"
        />
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mt-3 text-sm text-white/50">
          <p className="font-medium text-white/70 mb-1">Secciones IFRS</p>
          <p>
            El campo <code className="font-mono text-xs">ifrs_section</code>{" "}
            clasifica cada cuenta según IAS 1:{" "}
            <code className="font-mono text-xs">REVENUE</code>,{" "}
            <code className="font-mono text-xs">OTHER_INCOME</code>,{" "}
            <code className="font-mono text-xs">COST_OF_SALES</code>,{" "}
            <code className="font-mono text-xs">OPERATING_EXPENSE</code>,{" "}
            <code className="font-mono text-xs">FINANCE_INCOME</code>,{" "}
            <code className="font-mono text-xs">FINANCE_COST</code>,{" "}
            <code className="font-mono text-xs">TAX_EXPENSE</code>.
          </p>
        </div>
      </Endpoint>
    </div>
  );
}
