import Link from "next/link";
import { CodeBlock } from "./components/code-block";

export default function DocsIntroPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">Introducción</p>
        <h1 className="text-4xl font-bold text-white mb-4">Zeru API</h1>
        <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
          La API pública de Zeru te permite integrar tu contabilidad con
          cualquier sistema externo: ERP, e-commerce, facturación, o tus propias
          herramientas internas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            title: "Plan de cuentas",
            desc: "Lee y crea cuentas contables desde tu sistema.",
            href: "/docs/accounts",
          },
          {
            title: "Asientos contables",
            desc: "Registra asientos directamente desde aplicaciones externas.",
            href: "/docs/journal-entries",
          },
          {
            title: "Reportes",
            desc: "Extrae balances, libro mayor y estado de resultados.",
            href: "/docs/reports",
          },
          {
            title: "Autenticación",
            desc: "API keys con scopes para controlar permisos.",
            href: "/docs/authentication",
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 hover:bg-white/[0.05] transition-all"
          >
            <p className="font-semibold text-white mb-1">{card.title}</p>
            <p className="text-sm text-white/50">{card.desc}</p>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">Base URL</h2>
        <CodeBlock
          code="https://tu-instancia.zeru.app/api"
          language="bash"
          filename="Base URL"
        />
        <p className="text-sm text-white/50">
          Todas las rutas de la API pública se encuentran bajo el prefijo{" "}
          <code className="text-white/70 font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">
            /api/v1/
          </code>
          .
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Inicio rápido
        </h2>
        <p className="text-sm text-white/60 mb-3">
          1. Genera una API key desde{" "}
          <Link
            href="/settings/api-keys"
            className="text-white/80 underline underline-offset-2 hover:text-white"
          >
            Configuración → API Keys
          </Link>
          .<br />
          2. Incluye la clave y tu Tenant ID en cada petición.
        </p>
        <CodeBlock
          tabs={[
            {
              label: "curl",
              language: "bash",
              code: `curl https://tu-instancia.zeru.app/api/v1/fiscal-periods \\
  -H "Authorization: Bearer zk_your_api_key_here" \\
  -H "X-Tenant-Id: your-tenant-id"`,
            },
            {
              label: "JavaScript",
              language: "js",
              code: `const response = await fetch(
  'https://tu-instancia.zeru.app/api/v1/fiscal-periods',
  {
    headers: {
      'Authorization': 'Bearer zk_your_api_key_here',
      'X-Tenant-Id': 'your-tenant-id',
    },
  }
);

const { data } = await response.json();
console.log(data); // Array de períodos fiscales`,
            },
            {
              label: "Python",
              language: "python",
              code: `import requests

resp = requests.get(
    'https://tu-instancia.zeru.app/api/v1/fiscal-periods',
    headers={
        'Authorization': 'Bearer zk_your_api_key_here',
        'X-Tenant-Id': 'your-tenant-id',
    }
)

data = resp.json()['data']
print(data)  # Lista de períodos fiscales`,
            },
          ]}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
        <p className="text-sm font-semibold text-white">Formato de respuesta</p>
        <p className="text-sm text-white/50">
          Todas las respuestas son JSON. Las listas retornan un objeto con{" "}
          <code className="font-mono text-white/70 text-xs">data</code>,{" "}
          <code className="font-mono text-white/70 text-xs">total</code> y{" "}
          <code className="font-mono text-white/70 text-xs">has_more</code>. Los
          errores siguen el formato{" "}
          <code className="font-mono text-white/70 text-xs">
            {"{ error: { type, message, code } }"}
          </code>
          .
        </p>
      </div>
    </div>
  );
}
