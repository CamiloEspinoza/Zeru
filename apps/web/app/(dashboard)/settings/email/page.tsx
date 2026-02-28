"use client";

import { EmailConfigForm } from "@/components/config/email-config-form";

export default function EmailSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Email</h1>
        <p className="text-muted-foreground mt-1">
          Configura las credenciales de Amazon SES para el envío de correos
          transaccionales de tu organización (códigos de acceso, notificaciones,
          etc.).
        </p>
      </div>

      <EmailConfigForm />
    </div>
  );
}
