"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

interface PropertyDateEditorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PropertyDateEditor({
  value,
  onChange,
  placeholder = "Sin fecha",
  disabled = false,
}: PropertyDateEditorProps) {
  const [open, setOpen] = React.useState(false);
  const date = value ? new Date(value) : undefined;

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(day.toISOString());
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
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
            !date && "text-muted-foreground",
          )}
        >
          <HugeiconsIcon
            icon={Calendar03Icon}
            strokeWidth={2}
            className="mr-1.5 size-3.5"
          />
          {date ? format(date, "dd MMM yyyy", { locale: es }) : placeholder}
          {date && (
            <button
              type="button"
              onClick={handleClear}
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
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={es}
        />
      </PopoverContent>
    </Popover>
  );
}
