'use client';

import { generateShadeScale } from '@/lib/theme-generator';
import { formatHex } from 'culori';
import type { Oklch } from 'culori';

interface ShadePreviewProps {
  primaryHex: string;
}

const SHADE_NAMES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export function ShadePreview({ primaryHex }: ShadePreviewProps) {
  if (!primaryHex || !/^#[0-9a-fA-F]{6}$/.test(primaryHex)) return null;

  const scale = generateShadeScale(primaryHex);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Escala generada</p>
      <div className="flex gap-1 rounded-lg overflow-hidden">
        {SHADE_NAMES.map((shade) => {
          const color = scale[shade];
          const oklch: Oklch = { mode: 'oklch', l: color.l, c: color.c, h: color.h };
          const hex = formatHex(oklch) ?? '#000';
          return (
            <div
              key={shade}
              className="flex-1 flex flex-col items-center"
              title={`${shade}: ${hex}`}
            >
              <div
                className="w-full h-8 rounded-sm"
                style={{ backgroundColor: hex }}
              />
              <span className="text-[10px] text-muted-foreground mt-1">
                {shade}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
