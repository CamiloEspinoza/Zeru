'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ContrastChecker } from './contrast-checker';
import { formatHex, parse } from 'culori';

interface TokenDef {
  variable: string;
  label: string;
  pairedForeground?: string;
}

interface TokenEditorGroupProps {
  title: string;
  tokens: TokenDef[];
  values: Record<string, string>;
  generatedValues: Record<string, string>;
  onChange: (variable: string, value: string) => void;
  onReset: (variable: string) => void;
}

function oklchToHexSafe(oklchStr: string): string {
  const parsed = parse(oklchStr);
  if (!parsed) return '#000000';
  return formatHex(parsed) ?? '#000000';
}

export function TokenEditorGroup({
  title,
  tokens,
  values,
  generatedValues,
  onChange,
  onReset,
}: TokenEditorGroupProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      <div className="space-y-2">
        {tokens.map(({ variable, label, pairedForeground }) => {
          const currentValue = values[variable] ?? '';
          const generatedValue = generatedValues[variable] ?? '';
          const isOverridden = currentValue !== generatedValue;
          const hexValue = oklchToHexSafe(currentValue);

          return (
            <div key={variable} className="flex items-center gap-2">
              <input
                type="color"
                value={hexValue}
                onChange={(e) => onChange(variable, e.target.value)}
                className="size-7 rounded border-0 cursor-pointer p-0 bg-transparent shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs truncate">{label}</span>
                  {isOverridden && (
                    <span className="text-[10px] text-amber-500 font-medium">
                      editado
                    </span>
                  )}
                </div>
                <Input
                  value={currentValue}
                  onChange={(e) => onChange(variable, e.target.value)}
                  className="h-6 text-xs font-mono mt-0.5"
                  placeholder="oklch(...) o #hex"
                />
                {pairedForeground && values[pairedForeground] && (
                  <ContrastChecker
                    fg={values[pairedForeground]}
                    bg={currentValue}
                    label={label}
                  />
                )}
              </div>
              {isOverridden && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => onReset(variable)}
                  title="Restaurar valor generado"
                >
                  &#8634;
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
