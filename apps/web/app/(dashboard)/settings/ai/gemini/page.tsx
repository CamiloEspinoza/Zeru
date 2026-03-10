import { GeminiConfigForm } from "@/components/config/gemini-config-form";

export default function GeminiSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Google Gemini</h1>
        <p className="text-muted-foreground mt-1">
          Configura tu API key de Gemini para habilitar la generación de imágenes en LinkedIn.
        </p>
      </div>

      <GeminiConfigForm />
    </div>
  );
}
