"use client";

import { StorageConfigForm } from "@/components/config/storage-config-form";
import { EmailConfigForm } from "@/components/config/email-config-form";

export default function StorageSettingsPage() {
  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Almacenamiento y Email</h1>
        <p className="text-muted-foreground mt-1">
          Configura las credenciales de Amazon Web Services para almacenamiento
          de documentos (S3) y envío de correos (SES).
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Almacenamiento (S3)</h2>
          <p className="text-muted-foreground text-sm mt-0.5 mb-4">
            Credenciales de Amazon S3 para guardar documentos de tu
            organización.
          </p>
          <StorageConfigForm docsHref="/docs/setup-credentials#aws" />
        </div>
      </div>

      <div className="border-t pt-10 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Email (SES)</h2>
          <p className="text-muted-foreground text-sm mt-0.5 mb-4">
            Credenciales de Amazon SES para el envío de alertas y
            notificaciones. Los correos de acceso (códigos de login) se envían
            desde la cuenta del sistema.
          </p>
          <EmailConfigForm docsHref="/docs/setup-credentials#aws" />
        </div>
      </div>
    </div>
  );
}
