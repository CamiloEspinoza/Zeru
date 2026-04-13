"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PropertyOptionsEditor } from "./property-options-editor";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  TextIcon,
  Calculator01Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  UserIcon,
  CheckmarkSquare01Icon,
  Link01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import type {
  PropertyType,
  PropertyOption,
  CreatePropertyDefinitionPayload,
  ProjectPropertyDefinition,
} from "@/types/custom-properties";

const PROPERTY_TYPES: Array<{
  value: PropertyType;
  label: string;
  icon: typeof TextIcon;
}> = [
  { value: "TEXT", label: "Texto", icon: TextIcon },
  { value: "NUMBER", label: "Número", icon: Calculator01Icon },
  { value: "SELECT", label: "Selección", icon: ArrowDown01Icon },
  { value: "MULTI_SELECT", label: "Multi-selección", icon: MoreHorizontalIcon },
  { value: "DATE", label: "Fecha", icon: Calendar03Icon },
  { value: "PERSON", label: "Persona", icon: UserIcon },
  { value: "CHECKBOX", label: "Checkbox", icon: CheckmarkSquare01Icon },
  { value: "URL", label: "URL", icon: Link01Icon },
];

interface PropertyDefinitionFormProps {
  /** If provided, we are editing an existing definition. Type change is blocked. */
  existing?: ProjectPropertyDefinition;
  onSubmit: (data: CreatePropertyDefinitionPayload) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PropertyDefinitionForm({
  existing,
  onSubmit,
  onCancel,
  isLoading = false,
}: PropertyDefinitionFormProps) {
  const [name, setName] = React.useState(existing?.name ?? "");
  const [type, setType] = React.useState<PropertyType>(
    existing?.type ?? "TEXT",
  );
  const [options, setOptions] = React.useState<PropertyOption[]>(
    existing?.options ?? [],
  );
  const [isRequired, setIsRequired] = React.useState(
    existing?.isRequired ?? false,
  );
  const [isVisible, setIsVisible] = React.useState(
    existing?.isVisible ?? false,
  );
  const [isFilterable, setIsFilterable] = React.useState(
    existing?.isFilterable ?? true,
  );

  const needsOptions = type === "SELECT" || type === "MULTI_SELECT";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Ensure options have ids
    const finalOptions = options.map((o) => ({
      ...o,
      id: o.id || crypto.randomUUID(),
    }));

    const payload: CreatePropertyDefinitionPayload = {
      name: name.trim(),
      type,
      isRequired,
      isVisible,
      isFilterable,
      ...(needsOptions && finalOptions.length > 0
        ? { options: finalOptions }
        : {}),
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Nombre</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la propiedad"
          className="h-8 text-xs"
          maxLength={100}
          autoFocus
        />
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Tipo</label>
        {existing ? (
          <div className="flex items-center gap-2 h-8 px-3 rounded-md border bg-muted/50 text-xs">
            {(() => {
              const t = PROPERTY_TYPES.find((pt) => pt.value === type);
              return t ? (
                <>
                  <HugeiconsIcon
                    icon={t.icon}
                    strokeWidth={2}
                    className="size-3.5 text-muted-foreground"
                  />
                  {t.label}
                  <span className="text-muted-foreground ml-1">
                    (no se puede cambiar)
                  </span>
                </>
              ) : (
                type
              );
            })()}
          </div>
        ) : (
          <Select
            value={type}
            onValueChange={(v) => setType(v as PropertyType)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((pt) => (
                <SelectItem key={pt.value} value={pt.value}>
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={pt.icon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                    {pt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Options editor for SELECT/MULTI_SELECT */}
      {needsOptions && (
        <PropertyOptionsEditor options={options} onChange={setOptions} />
      )}

      {/* Flags */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="prop-required"
            checked={isRequired}
            onCheckedChange={(c) => setIsRequired(c === true)}
          />
          <label htmlFor="prop-required" className="text-xs">
            Requerido
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="prop-visible"
            checked={isVisible}
            onCheckedChange={(c) => setIsVisible(c === true)}
          />
          <label htmlFor="prop-visible" className="text-xs">
            Visible en tarjetas
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="prop-filterable"
            checked={isFilterable}
            onCheckedChange={(c) => setIsFilterable(c === true)}
          />
          <label htmlFor="prop-filterable" className="text-xs">
            Filtrable
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={
            isLoading ||
            !name.trim() ||
            (needsOptions &&
              options.filter((o) => o.label.trim()).length === 0)
          }
          className="h-7 text-xs"
        >
          {existing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
