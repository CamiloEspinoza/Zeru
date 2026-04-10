"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { PropertyOption } from "@/types/custom-properties";

interface PropertySelectEditorProps {
  value: string[];
  options: PropertyOption[];
  onChange: (selectedIds: string[]) => void;
  onClear: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PropertySelectEditor({
  value,
  options,
  onChange,
  onClear,
  placeholder = "Seleccionar...",
  disabled = false,
}: PropertySelectEditorProps) {
  const [open, setOpen] = React.useState(false);
  const selectedId = value[0] ?? null;
  const selectedOption = options.find((o) => o.id === selectedId);

  const handleSelect = (optionId: string) => {
    if (optionId === selectedId) {
      // Deselect
      onClear();
    } else {
      onChange([optionId]);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-7 w-full justify-start px-2 text-xs font-normal",
            !selectedOption && "text-muted-foreground",
          )}
        >
          {selectedOption ? (
            <span className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedOption.color }}
              />
              <span className="truncate">{selectedOption.label}</span>
            </span>
          ) : (
            placeholder
          )}
          {selectedOption && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                className="size-3"
              />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => handleSelect(option.id)}
                  data-checked={option.id === selectedId || undefined}
                >
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
