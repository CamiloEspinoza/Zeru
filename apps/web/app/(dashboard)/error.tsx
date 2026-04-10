'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-lg font-semibold">Algo salio mal</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message || 'Ha ocurrido un error inesperado.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
