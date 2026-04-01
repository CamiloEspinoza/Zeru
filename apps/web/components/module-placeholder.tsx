import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

interface ModulePlaceholderProps {
  icon: IconSvgElement;
  title: string;
  description: string;
  features?: string[];
}

export function ModulePlaceholder({
  icon,
  title,
  description,
  features,
}: ModulePlaceholderProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <HugeiconsIcon
            icon={icon}
            className="h-8 w-8 text-muted-foreground"
          />
        </div>
        <h1 className="mb-3 text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mb-6">{description}</p>
        {features && features.length > 0 && (
          <div className="mx-auto max-w-sm text-left">
            <p className="mb-3 text-sm font-medium">
              Funcionalidades planificadas:
            </p>
            <ul className="text-muted-foreground space-y-1.5 text-sm">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="bg-muted-foreground/50 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
