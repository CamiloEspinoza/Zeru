'use client';

import { checkContrast } from '@/lib/theme-generator';

interface ContrastCheckerProps {
  fg: string;
  bg: string;
  label?: string;
}

export function ContrastChecker({ fg, bg, label }: ContrastCheckerProps) {
  const { ratio, passesAA } = checkContrast(fg, bg);

  if (passesAA) return null;

  return (
    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
      <span>&#9888;</span>
      <span>
        Contraste insuficiente{label ? ` (${label})` : ''}: {ratio.toFixed(1)}:1
        {' '}(min 4.5:1)
      </span>
    </p>
  );
}
