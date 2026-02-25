import Link from "next/link";
import { CodeBlock } from "../components/code-block";

export default function AuthenticationPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">Introducción</p>
        <h1 className="text-3xl font-bold text-white mb-4">Autenticación</h1>
        <p className="text-[15px] text-white/60 leading-relaxed">
          La API de Zeru usa <strong className="text-white/80">API keys</strong>{" "}
          para autenticar las peticiones. Puedes generar y revocar claves desde{" "}
          <Link
            href="/settings/api-keys"
            className="text-white/80 underline underline-offset-2 hover:text-white"
          >
            Configuración → API Keys
          </Link>
          .
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Headers requeridos
        </h2>
        <p className="text-sm text-white/60 mb-4">
          Cada petición debe incluir dos headers obligatorios:
        </p>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Header</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Descripción</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5">
                <td className="px-4 py-3"><code className="text-xs font-mono text-[#89dceb]">Authorization</code></td>
                <td className="px-4 py-3"><code className="text-xs font-mono text-white/60">Bearer zk_...</code></td>
                <td className="px-4 py-3 text-xs text-white/50">Tu API key completa</td>
              </tr>
              <tr>
                <td className="px-4 py-3"><code className="text-xs font-mono text-[#89dceb]">X-Tenant-Id</code></td>
                <td className="px-4 py-3"><code className="text-xs font-mono text-white/60">uuid</code></td>
                <td className="px-4 py-3 text-xs text-white/50">UUID de tu organización en Zeru</td>
              </tr>
            </tbody>
          </table>
        </div>
        <CodeBlock
          code={`curl https://tu-instancia.zeru.app/api/v1/accounts \\
  -H "Authorization: Bearer zk_your_api_key_here" \\
  -H "X-Tenant-Id: 8a3f1b2c-..."`}
          language="bash"
          filename="Ejemplo"
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">Scopes</h2>
        <p className="text-sm text-white/60 mb-4">
          Cada API key tiene un conjunto de scopes que definen qué operaciones
          puede realizar. Si una petición requiere un scope que la clave no
          tiene, se retorna{" "}
          <code className="font-mono text-xs text-[#f38ba8]">403 Forbidden</code>.
        </p>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Scope</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["accounts:read", "Leer el plan de cuentas"],
                ["accounts:write", "Crear y editar cuentas"],
                ["journal-entries:read", "Leer asientos contables"],
                ["journal-entries:write", "Crear asientos en borrador"],
                ["journal-entries:manage", "Postear y anular asientos"],
                ["fiscal-periods:read", "Leer períodos fiscales"],
                ["reports:read", "Acceder a reportes contables"],
              ].map(([scope, desc], i) => (
                <tr
                  key={scope}
                  className={`border-b border-white/5 last:border-0 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <code className="text-xs font-mono text-[#a6e3a1]">{scope}</code>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-white/50">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Formato de la API key
        </h2>
        <p className="text-sm text-white/60 mb-3">
          Todas las claves tienen el prefijo{" "}
          <code className="font-mono text-xs text-white/80">zk_</code> seguido
          de una cadena aleatoria de ~65 caracteres. En el panel de control solo
          se muestra el prefijo truncado (ej.{" "}
          <code className="font-mono text-xs text-white/80">zk_abc123...</code>
          ).
        </p>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm text-amber-400/80 font-medium mb-1">
            Guarda tu clave al crearla
          </p>
          <p className="text-sm text-amber-400/60">
            La clave completa se muestra solo una vez al generarla. Zeru solo
            almacena un hash SHA-256 y no puede recuperar la clave original.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Respuestas de error
        </h2>
        <CodeBlock
          tabs={[
            {
              label: "401 Unauthorized",
              code: `{
  "statusCode": 401,
  "message": "Valid API key required"
}`,
              language: "json",
            },
            {
              label: "403 Forbidden (scope)",
              code: `{
  "statusCode": 403,
  "message": "This API key does not have the required scope: journal-entries:write"
}`,
              language: "json",
            },
          ]}
        />
      </div>
    </div>
  );
}
