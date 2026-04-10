"use client";

import * as React from "react";
import { projectsApi } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  PlusSignIcon,
  Edit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { PropertyDefinitionForm } from "./property-definition-form";
import type {
  ProjectPropertyDefinition,
  PropertyType,
  CreatePropertyDefinitionPayload,
  UpdatePropertyDefinitionPayload,
} from "@/types/custom-properties";

const TYPE_ICONS: Record<PropertyType, typeof TextIcon> = {
  TEXT: TextIcon,
  NUMBER: Calculator01Icon,
  SELECT: ArrowDown01Icon,
  MULTI_SELECT: MoreHorizontalIcon,
  DATE: Calendar03Icon,
  PERSON: UserIcon,
  CHECKBOX: CheckmarkSquare01Icon,
  URL: Link01Icon,
};

const TYPE_LABELS: Record<PropertyType, string> = {
  TEXT: "Texto",
  NUMBER: "Numero",
  SELECT: "Seleccion",
  MULTI_SELECT: "Multi-seleccion",
  DATE: "Fecha",
  PERSON: "Persona",
  CHECKBOX: "Checkbox",
  URL: "URL",
};

interface PropertyDefinitionListProps {
  projectId: string;
}

export function PropertyDefinitionList({
  projectId,
}: PropertyDefinitionListProps) {
  const [definitions, setDefinitions] = React.useState<
    ProjectPropertyDefinition[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await projectsApi.listProperties(projectId);
        if (!cancelled) setDefinitions(data);
      } catch (err) {
        console.error("Failed to load property definitions", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleCreate = async (data: CreatePropertyDefinitionPayload) => {
    setSaving(true);
    try {
      const created = await projectsApi.createProperty(projectId, data);
      setDefinitions((prev) => [...prev, created]);
      setShowAddForm(false);
    } catch (err) {
      console.error("Failed to create property", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (
    id: string,
    data: UpdatePropertyDefinitionPayload,
  ) => {
    setSaving(true);
    try {
      const updated = await projectsApi.updateProperty(projectId, id, data);
      setDefinitions((prev) =>
        prev.map((d) => (d.id === id ? updated : d)),
      );
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update property", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await projectsApi.deleteProperty(projectId, id);
      setDefinitions((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Failed to delete property", err);
    }
  };

  const handleToggleVisibility = async (def: ProjectPropertyDefinition) => {
    await handleUpdate(def.id, { isVisible: !def.isVisible });
  };

  const handleToggleFilterable = async (def: ProjectPropertyDefinition) => {
    await handleUpdate(def.id, { isFilterable: !def.isFilterable });
  };

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Propiedades personalizadas</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm}
        >
          <HugeiconsIcon
            icon={PlusSignIcon}
            strokeWidth={2}
            className="size-3.5"
          />
          Agregar
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-md border p-3">
          <PropertyDefinitionForm
            onSubmit={handleCreate}
            onCancel={() => setShowAddForm(false)}
            isLoading={saving}
          />
        </div>
      )}

      {/* List of definitions */}
      {definitions.length > 0 ? (
        <div className="space-y-1">
          {definitions.map((def) => {
            const TypeIcon = TYPE_ICONS[def.type] ?? TextIcon;

            if (editingId === def.id) {
              return (
                <div key={def.id} className="rounded-md border p-3">
                  <PropertyDefinitionForm
                    existing={def}
                    onSubmit={(data) =>
                      handleUpdate(def.id, {
                        name: data.name,
                        options: data.options ?? null,
                        isRequired: data.isRequired,
                        isVisible: data.isVisible,
                        isFilterable: data.isFilterable,
                      })
                    }
                    onCancel={() => setEditingId(null)}
                    isLoading={saving}
                  />
                </div>
              );
            }

            return (
              <div
                key={def.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
              >
                <HugeiconsIcon
                  icon={TypeIcon}
                  strokeWidth={2}
                  className="size-3.5 text-muted-foreground shrink-0"
                />
                <span className="text-xs font-medium truncate flex-1">
                  {def.name}
                </span>
                <Badge variant="outline" className="text-[0.6rem] shrink-0">
                  {TYPE_LABELS[def.type]}
                </Badge>

                {/* Visibility toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleToggleVisibility(def)}
                  title={
                    def.isVisible
                      ? "Ocultar de tarjetas"
                      : "Mostrar en tarjetas"
                  }
                >
                  <span
                    className={`text-[0.5rem] ${def.isVisible ? "text-green-500" : "text-muted-foreground"}`}
                  >
                    {def.isVisible ? "V" : "H"}
                  </span>
                </Button>

                {/* Filterable toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleToggleFilterable(def)}
                  title={
                    def.isFilterable
                      ? "Quitar del filtro"
                      : "Agregar al filtro"
                  }
                >
                  <span
                    className={`text-[0.5rem] ${def.isFilterable ? "text-blue-500" : "text-muted-foreground"}`}
                  >
                    F
                  </span>
                </Button>

                {/* Edit */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={() => setEditingId(def.id)}
                  title="Editar"
                >
                  <HugeiconsIcon
                    icon={Edit02Icon}
                    strokeWidth={2}
                    className="size-3.5 text-muted-foreground"
                  />
                </Button>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={() => handleDelete(def.id)}
                  title="Eliminar"
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    strokeWidth={2}
                    className="size-3.5 text-destructive"
                  />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        !showAddForm && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No hay propiedades personalizadas. Agrega una para empezar.
          </p>
        )
      )}
    </div>
  );
}
