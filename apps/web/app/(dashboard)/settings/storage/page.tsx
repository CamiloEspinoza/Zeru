"use client";

import { StorageConfigForm } from "@/components/config/storage-config-form";

export default function StorageSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Almacenamiento</h1>
        <p className="text-muted-foreground mt-1">
          Configura las credenciales de Amazon S3 para almacenar documentos de
          tu organización.
        </p>
      </div>

      <StorageConfigForm />
    </div>
  );
}
