"use client";

import { AiConfigForm } from "@/components/config/ai-config-form";

export default function AiSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Asistente IA</h1>
        <p className="text-muted-foreground mt-1">
          Configura el proveedor de inteligencia artificial para el contador
          virtual.
        </p>
      </div>

      <AiConfigForm />
    </div>
  );
}
