import { CodeBlock } from "../components/code-block";

export default function RateLimitsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">Introducción</p>
        <h1 className="text-3xl font-bold text-white mb-4">Rate Limiting</h1>
        <p className="text-[15px] text-white/60 leading-relaxed">
          Para garantizar la estabilidad del servicio, la API aplica límites de
          uso por API key.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-3xl font-bold text-white mb-1">100</p>
          <p className="text-sm text-white/50">peticiones por minuto</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-3xl font-bold text-white mb-1">por API key</p>
          <p className="text-sm text-white/50">el límite es por clave, no por IP</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Error al superar el límite
        </h2>
        <p className="text-sm text-white/60 mb-3">
          Cuando superas el límite, la API retorna{" "}
          <code className="font-mono text-xs text-[#f38ba8]">429 Too Many Requests</code>
          . Debes esperar hasta que el contador se resetee (cada 60 segundos).
        </p>
        <CodeBlock
          code={`{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}`}
          language="json"
          filename="429 response"
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Buenas prácticas
        </h2>
        <ul className="space-y-2 text-sm text-white/60">
          <li className="flex gap-2">
            <span className="text-white/30 shrink-0">—</span>
            Implementa un mecanismo de retry con backoff exponencial para
            manejar errores{" "}
            <code className="font-mono text-xs text-[#f38ba8]">429</code>.
          </li>
          <li className="flex gap-2">
            <span className="text-white/30 shrink-0">—</span>
            Para sincronizaciones masivas, usa lotes (batch) en lugar de
            peticiones individuales por cada transacción.
          </li>
          <li className="flex gap-2">
            <span className="text-white/30 shrink-0">—</span>
            Cachea las respuestas de endpoints de solo lectura (plan de cuentas,
            períodos) que no cambian frecuentemente.
          </li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-3">
          Ejemplo de retry en JavaScript
        </h2>
        <CodeBlock
          code={`async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status !== 429) return res;

    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Rate limit exceeded after retries');
}`}
          language="javascript"
          filename="retry.js"
        />
      </div>
    </div>
  );
}
