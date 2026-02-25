import { CodeBlock } from "../components/code-block";

export default function ErrorsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">Introducción</p>
        <h1 className="text-3xl font-bold text-white mb-4">Errores</h1>
        <p className="text-[15px] text-white/60 leading-relaxed">
          La API usa códigos HTTP estándar para indicar el resultado de cada
          petición.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Códigos de estado
        </h2>
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Código</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/40">Significado</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["200 OK", "La petición fue exitosa."],
                ["201 Created", "El recurso fue creado correctamente."],
                ["204 No Content", "La operación fue exitosa pero no retorna datos (ej. DELETE)."],
                ["400 Bad Request", "El cuerpo o los parámetros de la petición son inválidos."],
                ["401 Unauthorized", "La API key es inválida, fue revocada, o no se incluyó."],
                ["403 Forbidden", "La API key no tiene el scope necesario para esta operación."],
                ["404 Not Found", "El recurso solicitado no existe o no pertenece al tenant."],
                ["422 Unprocessable", "Los datos no pasan la validación (Zod). Ver campo errors."],
                ["429 Too Many Requests", "Se superó el límite de 100 peticiones por minuto."],
                ["500 Server Error", "Error interno del servidor. Intenta de nuevo o contacta soporte."],
              ].map(([code, desc], i) => (
                <tr
                  key={code}
                  className={`border-b border-white/5 last:border-0 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <code className="text-xs font-mono text-[#f38ba8]">{code}</code>
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
          Formato de error
        </h2>
        <CodeBlock
          tabs={[
            {
              label: "Validación (400)",
              code: `{
  "message": [
    "lines must contain at least 2 items",
    "date must be a valid date string"
  ],
  "error": "Bad Request",
  "statusCode": 400
}`,
              language: "json",
            },
            {
              label: "No encontrado (404)",
              code: `{
  "message": "Journal entry not found",
  "error": "Not Found",
  "statusCode": 404
}`,
              language: "json",
            },
            {
              label: "Sin permisos (403)",
              code: `{
  "message": "This API key does not have the required scope: journal-entries:write",
  "error": "Forbidden",
  "statusCode": 403
}`,
              language: "json",
            },
          ]}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Manejo de errores en JavaScript
        </h2>
        <CodeBlock
          code={`const res = await fetch('https://tu-instancia.zeru.app/api/v1/journal-entries', {
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

const data = await res.json();`}
          language="javascript"
          filename="error-handling.js"
        />
      </div>
    </div>
  );
}
