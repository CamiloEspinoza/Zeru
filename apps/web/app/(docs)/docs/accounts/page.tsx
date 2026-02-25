import { Endpoint, Hr } from "../components/endpoint";
import { CodeBlock } from "../components/code-block";

export default function AccountsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">Endpoints</p>
        <h1 className="text-3xl font-bold text-white mb-4">Plan de Cuentas</h1>
        <p className="text-[15px] text-white/60 leading-relaxed">
          El plan de cuentas es la estructura jerárquica de cuentas contables de
          tu organización. Puedes leerlo y ampliarlo mediante la API.
        </p>
      </div>

      {/* GET /v1/accounts */}
      <Endpoint
        method="GET"
        path="/api/v1/accounts"
        scope="accounts:read"
        description="Retorna el plan de cuentas completo como un árbol jerárquico."
      >
        <CodeBlock
          tabs={[
            {
              label: "curl",
              code: `curl https://tu-instancia.zeru.app/api/v1/accounts \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id"`,
            },
            {
              label: "JavaScript",
              code: `const res = await fetch('/api/v1/accounts', {
  headers: {
    'Authorization': 'Bearer zk_...',
    'X-Tenant-Id': 'your-tenant-id',
  },
});
const { data } = await res.json();`,
            },
            {
              label: "Python",
              code: `import requests

r = requests.get('/api/v1/accounts', headers={
    'Authorization': 'Bearer zk_...',
    'X-Tenant-Id': 'your-tenant-id',
})
accounts = r.json()['data']`,
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
}`}
          language="json"
        />
      </Endpoint>

      <Hr />

      {/* GET /v1/accounts/:id */}
      <Endpoint
        method="GET"
        path="/api/v1/accounts/:id"
        scope="accounts:read"
        description="Retorna una cuenta específica por su ID."
        params={[
          {
            name: "id",
            type: "string (uuid)",
            required: true,
            location: "path",
            description: "UUID de la cuenta contable",
          },
        ]}
      >
        <CodeBlock
          code={`curl https://tu-instancia.zeru.app/api/v1/accounts/8a3f1b2c-... \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id"`}
          language="bash"
          filename="curl"
        />
      </Endpoint>

      <Hr />

      {/* POST /v1/accounts */}
      <Endpoint
        method="POST"
        path="/api/v1/accounts"
        scope="accounts:write"
        description="Crea una nueva cuenta en el plan de cuentas."
        params={[
          {
            name: "code",
            type: "string",
            required: true,
            location: "body",
            description: "Código de la cuenta (ej. '1.1.1')",
          },
          {
            name: "name",
            type: "string",
            required: true,
            location: "body",
            description: "Nombre descriptivo de la cuenta",
          },
          {
            name: "type",
            type: "enum",
            required: true,
            location: "body",
            description: "ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE",
          },
          {
            name: "parentId",
            type: "string (uuid)",
            required: false,
            location: "body",
            description: "ID de la cuenta padre en la jerarquía",
          },
        ]}
      >
        <CodeBlock
          tabs={[
            {
              label: "curl",
              code: `curl -X POST https://tu-instancia.zeru.app/api/v1/accounts \\
  -H "Authorization: Bearer zk_..." \\
  -H "X-Tenant-Id: your-tenant-id" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "1.1.1",
    "name": "Caja",
    "type": "ASSET",
    "parentId": "uuid-de-cuenta-padre"
  }'`,
            },
            {
              label: "JavaScript",
              code: `const res = await fetch('/api/v1/accounts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer zk_...',
    'X-Tenant-Id': 'your-tenant-id',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code: '1.1.1',
    name: 'Caja',
    type: 'ASSET',
    parentId: 'uuid-de-cuenta-padre',
  }),
});
const account = await res.json();`,
            },
          ]}
        />
        <CodeBlock
          filename="Respuesta (201)"
          code={`{
  "object": "account",
  "id": "uuid",
  "code": "1.1.1",
  "name": "Caja",
  "type": "ASSET",
  "parentId": "uuid",
  "isActive": true
}`}
          language="json"
        />
      </Endpoint>
    </div>
  );
}
