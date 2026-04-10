"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface PropertyMultiSelectEditorProps {
  value: string[];
  options: PropertyOption[];
  onChange: (selectedIds: string[]) => void;
  onClear: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PropertyMultiSelectEditor({
  value,
  options,
  onChange,
  onClear,
  placeholder = "Seleccionar...",
  disabled = false,
}: PropertyMultiSelectEditorProps) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = new Set(value);
  const selectedOptions = options.filter((o) => selectedSet.has(o.id));

  const handleToggle = (optionId: string) => {
    const updated = selectedSet.has(optionId)
      ? value.filter((id) => id !== optionId)
      : [...value, optionId];
    onChange(updated);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-auto min-h-7 w-full justify-start px-2 py-1 text-xs font-normal",
            selectedOptions.length === 0 && "text-muted-foreground",
          )}
        >
          {selectedOptions.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {selectedOptions.map((opt) => (
                <Badge
                  key={opt.id}
                  variant="outline"
                  className="gap-1 text-[0.625rem]"
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(opt.id);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      strokeWidth={2}
                      className="size-2.5"
                    />
                  </button>
                </Badge>
              ))}
            </span>
          ) : (
            placeholder
          )}
          {selectedOptions.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
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
                  onSelect={() => handleToggle(option.id)}
                  data-checked={selectedSet.has(option.id) || undefined}
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
