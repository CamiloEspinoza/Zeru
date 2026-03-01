export default function SetupCredentialsPage() {
  return (
    <div className="space-y-12">
      <div>
        <p className="text-sm font-mono text-white/30 mb-3">
          Guías de configuración
        </p>
        <h1 className="text-4xl font-bold text-white mb-4">
          Obtener credenciales
        </h1>
        <p className="text-lg text-white/60 leading-relaxed max-w-2xl">
          Guía paso a paso para obtener las credenciales necesarias para
          configurar Zeru: API key de OpenAI y credenciales de AWS.
        </p>
      </div>

      {/* ── OpenAI API Key ── */}
      <section id="openai" className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold">
            1
          </span>
          <h2 className="text-2xl font-semibold text-white">
            API Key de OpenAI
          </h2>
        </div>

        <p className="text-sm text-white/60 leading-relaxed">
          La API key de OpenAI permite que el asistente IA de Zeru procese y
          analice tus documentos contables. Necesitas una cuenta en OpenAI con
          créditos disponibles.
        </p>

        <ol className="space-y-4 text-sm text-white/70">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              1
            </span>
            <div>
              <p className="text-white/90 font-medium">
                Crea una cuenta en OpenAI
              </p>
              <p className="mt-1 text-white/50">
                Ingresa a{" "}
                <a
                  href="https://platform.openai.com/signup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 underline underline-offset-2 hover:text-white"
                >
                  platform.openai.com/signup
                </a>{" "}
                y crea tu cuenta. Si ya tienes una, inicia sesión.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              2
            </span>
            <div>
              <p className="text-white/90 font-medium">Agrega créditos</p>
              <p className="mt-1 text-white/50">
                Ve a{" "}
                <a
                  href="https://platform.openai.com/settings/organization/billing/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 underline underline-offset-2 hover:text-white"
                >
                  Billing → Overview
                </a>{" "}
                y agrega un método de pago. OpenAI cobra por uso, así que solo
                pagarás por las consultas que realices.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              3
            </span>
            <div>
              <p className="text-white/90 font-medium">Genera tu API key</p>
              <p className="mt-1 text-white/50">
                Ve a{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 underline underline-offset-2 hover:text-white"
                >
                  API Keys
                </a>
                , haz clic en{" "}
                <strong className="text-white/70">
                  &quot;Create new secret key&quot;
                </strong>
                . Asígnale un nombre descriptivo como &quot;Zeru&quot;.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
              4
            </span>
            <div>
              <p className="text-white/90 font-medium">Copia la key</p>
              <p className="mt-1 text-white/50">
                La API key se muestra solo una vez. Cópiala inmediatamente y
                pégala en la configuración de Zeru. La key comienza con{" "}
                <code className="font-mono text-white/70 text-xs bg-white/5 px-1.5 py-0.5 rounded">
                  sk-
                </code>
                .
              </p>
            </div>
          </li>
        </ol>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/80">
          <p className="font-medium text-amber-200">Importante</p>
          <p className="mt-1 text-amber-200/60">
            Nunca compartas tu API key. Zeru la almacena cifrada y solo se usa
            del lado del servidor para comunicarse con OpenAI.
          </p>
        </div>
      </section>

      {/* ── AWS Credentials ── */}
      <section id="aws" className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 text-sm font-bold">
            2
          </span>
          <h2 className="text-2xl font-semibold text-white">
            Credenciales de AWS (S3 y SES)
          </h2>
        </div>

        <p className="text-sm text-white/60 leading-relaxed">
          AWS S3 almacena los documentos de tu organización y AWS SES envía
          correos de notificación. Ambos servicios usan credenciales IAM.
        </p>

        {/* Step A: Create AWS account */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white/90">
            A. Crear una cuenta de AWS
          </h3>
          <ol className="space-y-4 text-sm text-white/70">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                1
              </span>
              <div>
                <p className="text-white/90 font-medium">Regístrate en AWS</p>
                <p className="mt-1 text-white/50">
                  Ingresa a{" "}
                  <a
                    href="https://aws.amazon.com/free/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 underline underline-offset-2 hover:text-white"
                  >
                    aws.amazon.com/free
                  </a>{" "}
                  y crea una cuenta. AWS ofrece un nivel gratuito que incluye 5
                  GB de almacenamiento S3.
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Step B: Create S3 bucket */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white/90">
            B. Crear un bucket S3
          </h3>
          <ol className="space-y-4 text-sm text-white/70">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                1
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Abre la consola de S3
                </p>
                <p className="mt-1 text-white/50">
                  Ve a{" "}
                  <a
                    href="https://s3.console.aws.amazon.com/s3/buckets"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 underline underline-offset-2 hover:text-white"
                  >
                    Consola S3
                  </a>{" "}
                  y haz clic en{" "}
                  <strong className="text-white/70">
                    &quot;Create bucket&quot;
                  </strong>
                  .
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                2
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Configura el bucket
                </p>
                <p className="mt-1 text-white/50">
                  Asigna un nombre único (ej:{" "}
                  <code className="font-mono text-white/70 text-xs bg-white/5 px-1.5 py-0.5 rounded">
                    mi-empresa-zeru-docs
                  </code>
                  ), selecciona la región más cercana y deja las opciones por
                  defecto. Haz clic en{" "}
                  <strong className="text-white/70">
                    &quot;Create bucket&quot;
                  </strong>
                  .
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Step C: Create IAM user */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white/90">
            C. Crear un usuario IAM con permisos
          </h3>
          <ol className="space-y-4 text-sm text-white/70">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                1
              </span>
              <div>
                <p className="text-white/90 font-medium">Abre IAM</p>
                <p className="mt-1 text-white/50">
                  Ve a{" "}
                  <a
                    href="https://console.aws.amazon.com/iam/home#/users"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 underline underline-offset-2 hover:text-white"
                  >
                    IAM → Users
                  </a>{" "}
                  y haz clic en{" "}
                  <strong className="text-white/70">
                    &quot;Create user&quot;
                  </strong>
                  .
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                2
              </span>
              <div>
                <p className="text-white/90 font-medium">Nombra el usuario</p>
                <p className="mt-1 text-white/50">
                  Usa un nombre descriptivo como{" "}
                  <code className="font-mono text-white/70 text-xs bg-white/5 px-1.5 py-0.5 rounded">
                    zeru-app
                  </code>
                  . No marques la opción de acceso a la consola.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                3
              </span>
              <div>
                <p className="text-white/90 font-medium">Asigna permisos</p>
                <p className="mt-1 text-white/50">
                  Selecciona{" "}
                  <strong className="text-white/70">
                    &quot;Attach policies directly&quot;
                  </strong>{" "}
                  y agrega las siguientes políticas:
                </p>
                <ul className="mt-2 space-y-1 text-white/50">
                  <li>
                    <code className="font-mono text-white/70 text-xs bg-white/5 px-1.5 py-0.5 rounded">
                      AmazonS3FullAccess
                    </code>{" "}
                    — para almacenamiento de documentos
                  </li>
                  <li>
                    <code className="font-mono text-white/70 text-xs bg-white/5 px-1.5 py-0.5 rounded">
                      AmazonSESFullAccess
                    </code>{" "}
                    — para envío de correos (opcional)
                  </li>
                </ul>
                <p className="mt-2 text-white/40 text-xs">
                  Para mayor seguridad, puedes crear políticas personalizadas
                  que limiten el acceso solo al bucket específico y a
                  ses:SendEmail.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                4
              </span>
              <div>
                <p className="text-white/90 font-medium">Crea el usuario</p>
                <p className="mt-1 text-white/50">
                  Revisa la configuración y haz clic en{" "}
                  <strong className="text-white/70">
                    &quot;Create user&quot;
                  </strong>
                  .
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Step D: Generate access keys */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white/90">
            D. Generar Access Keys
          </h3>
          <ol className="space-y-4 text-sm text-white/70">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                1
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Accede al usuario creado
                </p>
                <p className="mt-1 text-white/50">
                  En la lista de usuarios IAM, haz clic en el usuario que
                  acabas de crear (ej:{" "}
                  <code className="font-mono text-white/70 text-xs bg-white/5 px-1.5 py-0.5 rounded">
                    zeru-app
                  </code>
                  ).
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                2
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Crea las access keys
                </p>
                <p className="mt-1 text-white/50">
                  Ve a la pestaña{" "}
                  <strong className="text-white/70">
                    &quot;Security credentials&quot;
                  </strong>
                  , busca la sección &quot;Access keys&quot; y haz clic en{" "}
                  <strong className="text-white/70">
                    &quot;Create access key&quot;
                  </strong>
                  .
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                3
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Selecciona el caso de uso
                </p>
                <p className="mt-1 text-white/50">
                  Elige{" "}
                  <strong className="text-white/70">
                    &quot;Application running outside AWS&quot;
                  </strong>{" "}
                  y continúa.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                4
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Copia las credenciales
                </p>
                <p className="mt-1 text-white/50">
                  Copia el{" "}
                  <strong className="text-white/70">Access Key ID</strong>{" "}
                  (comienza con{" "}
                  <code className="font-mono text-white/70 text-xs bg-white/5 px-1.5 py-0.5 rounded">
                    AKIA
                  </code>
                  ) y el{" "}
                  <strong className="text-white/70">Secret Access Key</strong>.
                  Este último solo se muestra una vez.
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Step E: SES setup */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white/90">
            E. Configurar SES (opcional)
          </h3>
          <ol className="space-y-4 text-sm text-white/70">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                1
              </span>
              <div>
                <p className="text-white/90 font-medium">Abre SES</p>
                <p className="mt-1 text-white/50">
                  Ve a{" "}
                  <a
                    href="https://console.aws.amazon.com/ses/home"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 underline underline-offset-2 hover:text-white"
                  >
                    Consola SES
                  </a>
                  . Asegúrate de estar en la misma región donde creaste el
                  usuario IAM.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                2
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Verifica una identidad
                </p>
                <p className="mt-1 text-white/50">
                  Ve a{" "}
                  <strong className="text-white/70">
                    &quot;Verified identities&quot;
                  </strong>{" "}
                  y haz clic en{" "}
                  <strong className="text-white/70">
                    &quot;Create identity&quot;
                  </strong>
                  . Puedes verificar una dirección de email individual o un
                  dominio completo.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                3
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Confirma la verificación
                </p>
                <p className="mt-1 text-white/50">
                  Si verificas un email, recibirás un correo de confirmación.
                  Haz clic en el enlace para completar la verificación. Si
                  verificas un dominio, agrega los registros DNS indicados.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
                4
              </span>
              <div>
                <p className="text-white/90 font-medium">
                  Solicita salir del sandbox (producción)
                </p>
                <p className="mt-1 text-white/50">
                  Por defecto, SES está en modo sandbox y solo puede enviar a
                  direcciones verificadas. Para enviar a cualquier destinatario,
                  solicita la salida del sandbox desde{" "}
                  <strong className="text-white/70">
                    &quot;Account dashboard&quot;
                  </strong>
                  .
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/80">
          <p className="font-medium text-amber-200">Importante</p>
          <p className="mt-1 text-amber-200/60">
            Las mismas credenciales IAM (Access Key ID y Secret Access Key) se
            pueden usar tanto para S3 como para SES, siempre que el usuario
            tenga los permisos correspondientes. En Zeru puedes configurarlas
            de forma independiente si necesitas usar usuarios IAM distintos.
          </p>
        </div>
      </section>

      {/* ── Summary ── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Resumen</h2>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="pb-2 font-medium text-white/60">Servicio</th>
                <th className="pb-2 font-medium text-white/60">
                  Dato necesario
                </th>
                <th className="pb-2 font-medium text-white/60">Formato</th>
              </tr>
            </thead>
            <tbody className="text-white/50">
              <tr className="border-b border-white/5">
                <td className="py-2 text-white/70">OpenAI</td>
                <td className="py-2">API Key</td>
                <td className="py-2">
                  <code className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/60">
                    sk-...
                  </code>
                </td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-white/70" rowSpan={4}>
                  AWS (S3 + SES)
                </td>
                <td className="py-2">Access Key ID</td>
                <td className="py-2">
                  <code className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/60">
                    AKIA...
                  </code>
                </td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2">Secret Access Key</td>
                <td className="py-2 text-white/40">String largo</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2">Nombre del bucket S3</td>
                <td className="py-2">
                  <code className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/60">
                    mi-bucket
                  </code>
                </td>
              </tr>
              <tr>
                <td className="py-2">Email verificado (SES)</td>
                <td className="py-2">
                  <code className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/60">
                    noreply@tudominio.com
                  </code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
