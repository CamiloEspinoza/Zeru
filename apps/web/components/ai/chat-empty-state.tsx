"use client";

const SUGGESTIONS = [
  "Crea los asientos de constitución de sociedad",
  "¿Cuál es el balance de comprobación?",
  "Crea un post de LinkedIn sobre liderazgo",
  "Genera un calendario de contenido para 30 días",
];

export function ChatEmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (suggestion: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-muted-foreground">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </div>
      <div>
        <p className="font-medium text-foreground">Asistente Zeru</p>
        <p className="text-sm mt-1">
          Puedo ayudarte con contabilidad, crear posts de LinkedIn, generar imágenes y gestionar tu
          calendario de contenido.
        </p>
        <p className="text-xs mt-1 text-muted-foreground/70">
          Arrastra archivos o pega imágenes directamente en el chat.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center max-w-md px-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestionClick(s)}
            className="rounded-full border border-border/60 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
