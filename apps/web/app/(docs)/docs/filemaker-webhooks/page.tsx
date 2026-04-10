"use client";

import { CodeBlock } from "../components/code-block";

export default function FileMakerWebhooksPage() {
  return (
    <div className="space-y-12">
      <div>
        <p className="text-sm font-mono text-white/50 mb-3">
          Guías de configuración
        </p>
        <h1 className="text-4xl font-bold text-white mb-4">
          Configurar Webhooks en FileMaker
        </h1>
        <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
          Guía paso a paso para configurar FileMaker Server y enviar
          notificaciones a Zeru cada vez que se crea, actualiza o elimina un
          registro en una tabla sincronizada.
        </p>
      </div>

      {/* ── Requisitos ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Requisitos previos</h2>
        <ul className="space-y-2 text-sm text-white/70">
          <li className="flex gap-2">
            <span className="text-emerald-400">&#10003;</span>
            FileMaker Server 19+ (soporte para Insert from URL con cURL)
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">&#10003;</span>
            Acceso de administrador a las bases de datos FM
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400">&#10003;</span>
            URL del API de Zeru y Webhook Key configurada
          </li>
        </ul>
      </section>

      {/* ── Concepto ── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Cómo funciona</h2>
        <p className="text-sm text-white/60 leading-relaxed">
          Zeru expone un endpoint webhook que FileMaker llama cada vez que un
          registro cambia. El endpoint recibe un JSON con la información del
          cambio y lo encola para procesamiento asíncrono.
        </p>
        <CodeBlock
          language="bash"
          filename="Endpoint"
          code="POST https://api.zeru.cl/filemaker/webhook"
        />
        <p className="text-sm text-white/60 leading-relaxed">
          Payload que espera Zeru:
        </p>
        <CodeBlock
          language="json"
          filename="Payload"
          code={`{
  "database": "BIOPSIAS",
  "layout": "Liquidaciones",
  "recordId": "12176",
  "action": "update"
}`}
        />
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-2 text-white/70 font-medium">Campo</th>
                <th className="text-left px-4 py-2 text-white/70 font-medium">Tipo</th>
                <th className="text-left px-4 py-2 text-white/70 font-medium">Descripción</th>
              </tr>
            </thead>
            <tbody className="text-white/60">
              <tr className="border-b border-white/5">
                <td className="px-4 py-2 font-mono text-xs text-emerald-400">database</td>
                <td className="px-4 py-2">texto</td>
                <td className="px-4 py-2">Nombre de la base de datos FM (ej: BIOPSIAS)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="px-4 py-2 font-mono text-xs text-emerald-400">layout</td>
                <td className="px-4 py-2">texto</td>
                <td className="px-4 py-2">Nombre del layout donde ocurrió el cambio</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="px-4 py-2 font-mono text-xs text-emerald-400">recordId</td>
                <td className="px-4 py-2">texto</td>
                <td className="px-4 py-2">ID del registro en FM (Get(RecordID))</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs text-emerald-400">action</td>
                <td className="px-4 py-2">texto</td>
                <td className="px-4 py-2">create, update, o delete</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-white/60">
          Autenticación: Header{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-emerald-400">
            X-FM-Webhook-Key
          </code>{" "}
          con la clave configurada en Zeru.
        </p>
      </section>

      {/* ── Paso 1: Script ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold">
            1
          </span>
          <h2 className="text-2xl font-semibold text-white">
            Crear el script de webhook
          </h2>
        </div>
        <p className="text-sm text-white/60 leading-relaxed">
          En FileMaker Pro, crea un nuevo script llamado{" "}
          <strong className="text-white/80">Webhook - Notificar Zeru</strong>.
          Este script recibe un parámetro JSON con el layout y la acción,
          construye el payload y lo envía a Zeru.
        </p>
        <CodeBlock
          language="filemaker"
          filename="Webhook - Notificar Zeru"
          code={`# ============================================
# Script: Webhook - Notificar Zeru
# Parámetro: JSON con "layout" y "action"
# ============================================

Set Error Capture [ On ]

# Leer parámetros
Set Variable [ $param ; Value: Get ( ScriptParameter ) ]
Set Variable [ $layout ; Value: JSONGetElement ( $param ; "layout" ) ]
Set Variable [ $action ; Value: JSONGetElement ( $param ; "action" ) ]

# Construir el payload JSON
Set Variable [ $payload ; Value:
  JSONSetElement ( "{}" ;
    [ "database" ; Get ( FileName ) ; JSONString ] ;
    [ "layout" ; $layout ; JSONString ] ;
    [ "recordId" ; Get ( RecordID ) ; JSONString ] ;
    [ "action" ; $action ; JSONString ]
  )
]

# URL del webhook de Zeru
Set Variable [ $url ; Value: "https://api.zeru.cl/filemaker/webhook" ]

# Clave de autenticación
Set Variable [ $webhookKey ; Value: "TU_FM_WEBHOOK_KEY_AQUI" ]

# Opciones cURL para POST con JSON
Set Variable [ $curlOptions ; Value:
  "--request POST" &
  " --header \\"Content-Type: application/json\\"" &
  " --header \\"X-FM-Webhook-Key: " & $webhookKey & "\\"" &
  " --data @$payload" &
  " --show-error" &
  " --max-time 5"
]

# Enviar la notificación
Insert from URL [ Select ; With dialog: Off ;
  Target: $response ; $url ; cURL options: $curlOptions ]

# Log de errores (opcional)
If [ Get ( LastError ) ≠ 0 ]
  # Registrar error en tabla de log
End If`}
        />
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-white/70 space-y-2">
          <p className="font-medium text-amber-400">Notas importantes:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>
              <code className="font-mono text-xs">Get ( FileName )</code> devuelve el nombre
              de la base de datos actual (ej: &quot;BIOPSIAS&quot;)
            </li>
            <li>
              <code className="font-mono text-xs">--data @$payload</code> envía el contenido
              de la variable. El prefijo @ indica a FM que lea la variable.
            </li>
            <li>
              <code className="font-mono text-xs">--max-time 5</code> establece timeout de 5s
              para no bloquear FM si Zeru no responde.
            </li>
            <li>
              Las comillas dentro de cURL deben escaparse con{" "}
              <code className="font-mono text-xs">\&quot;</code>
            </li>
          </ul>
        </div>
      </section>

      {/* ── Paso 2: Triggers ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold">
            2
          </span>
          <h2 className="text-2xl font-semibold text-white">
            Configurar Script Triggers
          </h2>
        </div>
        <p className="text-sm text-white/60 leading-relaxed">
          Para cada layout que quieras sincronizar, configura un Script Trigger
          en FileMaker Pro:
        </p>
        <ol className="space-y-4 text-sm text-white/70">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              1
            </span>
            <p>
              Abre el layout que quieres sincronizar (ej:{" "}
              <code className="font-mono text-xs text-emerald-400">Liquidaciones</code>)
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              2
            </span>
            <p>
              Ve a <strong className="text-white/80">Layout Setup</strong> → pestaña{" "}
              <strong className="text-white/80">Script Triggers</strong>
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              3
            </span>
            <p>
              Agrega un trigger <strong className="text-white/80">OnRecordCommit</strong> →
              Script: <strong className="text-white/80">Webhook - Notificar Zeru</strong>
            </p>
          </li>
        </ol>
        <p className="text-sm text-white/60 mt-4">
          Parámetro del trigger por layout:
        </p>
        <CodeBlock
          language="filemaker"
          filename="Parámetro para Liquidaciones"
          code={`JSONSetElement ( "{}" ;
  [ "layout" ; "Liquidaciones" ; JSONString ] ;
  [ "action" ; "update" ; JSONString ]
)`}
        />
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-2 text-white/70 font-medium">Layout FM</th>
                <th className="text-left px-4 py-2 text-white/70 font-medium">Prioridad</th>
              </tr>
            </thead>
            <tbody className="text-white/60">
              <tr className="border-b border-white/5">
                <td className="px-4 py-2 font-mono text-xs">Liquidaciones</td>
                <td className="px-4 py-2"><span className="rounded bg-red-500/10 text-red-400 px-2 py-0.5 text-xs">Alta</span></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="px-4 py-2 font-mono text-xs">Procedencias*</td>
                <td className="px-4 py-2"><span className="rounded bg-red-500/10 text-red-400 px-2 py-0.5 text-xs">Alta</span></td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="px-4 py-2 font-mono text-xs">FICHA INSTITUCION COBRANZAS</td>
                <td className="px-4 py-2"><span className="rounded bg-amber-500/10 text-amber-400 px-2 py-0.5 text-xs">Media</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">Conceptos de cobro (CDC)*</td>
                <td className="px-4 py-2"><span className="rounded bg-white/10 text-white/50 px-2 py-0.5 text-xs">Baja</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Paso 3: Eliminaciones ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold">
            3
          </span>
          <h2 className="text-2xl font-semibold text-white">
            Manejar eliminaciones
          </h2>
        </div>
        <p className="text-sm text-white/60 leading-relaxed">
          OnRecordCommit no se ejecuta al eliminar registros. Para capturar
          eliminaciones, llama al webhook <strong className="text-white/80">antes</strong>{" "}
          de ejecutar Delete Record en cualquier script FM que elimine registros:
        </p>
        <CodeBlock
          language="filemaker"
          filename="Antes de eliminar"
          code={`# Notificar a Zeru antes de eliminar
Perform Script [ "Webhook - Notificar Zeru" ;
  Parameter: JSONSetElement ( "{}" ;
    [ "layout" ; "Liquidaciones" ; JSONString ] ;
    [ "action" ; "delete" ; JSONString ]
  )
]
Delete Record/Request [ With dialog: Off ]`}
        />
      </section>

      {/* ── Paso 4: Probar ── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold">
            4
          </span>
          <h2 className="text-2xl font-semibold text-white">
            Probar la conexión
          </h2>
        </div>
        <ol className="space-y-3 text-sm text-white/70">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              1
            </span>
            <p>Abre un registro en el layout configurado y modifica cualquier campo</p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              2
            </span>
            <p>Haz commit del registro (click fuera del campo o Ctrl+S)</p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              3
            </span>
            <p>
              En Zeru, ve a{" "}
              <strong className="text-white/80">
                Integraciones → FileMaker → Estado de Sync
              </strong>
            </p>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              4
            </span>
            <p>
              Deberías ver un nuevo log con la operación{" "}
              <code className="font-mono text-xs text-emerald-400">webhook:update</code>
            </p>
          </li>
        </ol>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-white/70 space-y-2">
          <p className="font-medium text-blue-400">Debugging:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>
              <strong className="text-white/80">En FileMaker:</strong> Si el webhook falla,
              revisa Get ( LastError ) y Get ( LastErrorDetail )
            </li>
            <li>
              <strong className="text-white/80">En Zeru:</strong> Los logs se registran en
              Integraciones → FileMaker → Estado de Sync → Logs
            </li>
            <li>
              <strong className="text-white/80">Timeout:</strong> Si Zeru no responde en 5
              segundos, FM continúa sin bloquear al usuario
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
