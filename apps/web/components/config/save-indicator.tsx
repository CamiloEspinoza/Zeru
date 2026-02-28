import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveIndicator({
  status,
  error,
}: {
  status: SaveStatus;
  error: string;
}) {
  if (status === "idle") return null;
  return (
    <span
      className={cn(
        "text-xs transition-opacity",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-green-600 dark:text-green-400",
        status === "error" && "text-destructive",
      )}
    >
      {status === "saving" && "Guardando..."}
      {status === "saved" && "Guardado"}
      {status === "error" && (error || "Error al guardar")}
    </span>
  );
}
