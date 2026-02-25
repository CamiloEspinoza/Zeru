import { Endpoint } from "../components/endpoint";
import { CodeBlock } from "../components/code-block";

export default function FiscalPeriodsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">Endpoints</p>
        <h1 className="text-3xl font-bold text-white mb-4">Períodos Fiscales</h1>
        <p className="text-[15px] text-white/60 leading-relaxed">
          Los períodos fiscales definen los rangos de tiempo contables (mensual,
          anual, etc.). Al crear un asiento necesitas el ID del período
          correspondiente.
        </p>
      </div>

      {/* GET /v1/fiscal-periods */}
      <Endpoint
        method="GET"
        path="/api/v1/fiscal-periods"
        scope="fiscal-periods:read"
        description="Lista todos los períodos fiscales del tenant, ordenados por fecha de inicio descendente."
      >
        <CodeBlock
          tabs={[
            {
              label: "curl",
              code: `curl https://tu-instancia.zeru.app/api/v1/fiscal-periods \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id"`,
            },
            {
              label: "JavaScript",
              code: `const res = await fetch('/api/v1/fiscal-periods', {
  headers: {
    'Authorization': 'Bearer zk_...',
    'X-Tenant-Id': 'your-tenant-id',
  },
});
const { data } = await res.json();
// Selecciona el período activo
const openPeriod = data.find((p) => p.status === 'OPEN');`,
            },
          ]}
        />
        <CodeBlock
          filename="Respuesta"
          code={`{
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
}`}
          language="json"
        />
      </Endpoint>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 mt-8">
        <p className="text-sm text-blue-400/80 font-medium mb-1">
          Usa el período para crear asientos
        </p>
        <p className="text-sm text-blue-400/60">
          Al llamar a <code className="font-mono text-xs">POST /v1/journal-entries</code>,
          el campo <code className="font-mono text-xs">fiscalPeriodId</code> debe
          corresponder a un período con estado <code className="font-mono text-xs">OPEN</code>.
          Si el período está cerrado, el asiento será rechazado.
        </p>
      </div>
    </div>
  );
}
