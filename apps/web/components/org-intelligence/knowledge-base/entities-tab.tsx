"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  EntityTypeBadge,
  ENTITY_TYPE_CONFIG,
} from "@/components/org-intelligence/entity-type-badge";
import { ConfidenceBadge } from "@/components/org-intelligence/confidence-badge";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";

interface Entity {
  id: string;
  type: string;
  name: string;
  description: string | null;
  confidence: number;
  aliases: string[];
  metadata: Record<string, unknown> | null;
  relations?: EntityRelation[];
  _count?: { relations: number; reverseRelations: number };
}

interface EntityRelation {
  id: string;
  type: string;
  targetEntity: { id: string; name: string; type: string };
}

interface EntitiesResponse {
  data: Entity[];
  meta: { total: number; page: number; perPage: number };
}

const ENTITY_TYPES = Object.keys(ENTITY_TYPE_CONFIG);

export function EntitiesTab({ projectId }: { projectId: string }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [minConfidence, setMinConfidence] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const perPage = 20;

  const fetchEntities = useCallback(async () => {
    try {
      setLoading(true);
      const typeParam =
        activeTypes.size === 1 ? `&type=${[...activeTypes][0]}` : "";
      const res = await api.get<EntitiesResponse>(
        `/org-intelligence/entities?projectId=${projectId}&page=${page}&perPage=${perPage}${typeParam}`,
      );
      setEntities(res.data);
      setTotal(res.meta.total);
    } catch {
      setEntities([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, activeTypes]);

  useEffect(() => {
    setPage(1);
  }, [projectId, activeTypes]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const filteredEntities = entities.filter((e) => {
    if (activeTypes.size > 0 && !activeTypes.has(e.type)) return false;
    if (e.confidence < minConfidence) return false;
    return true;
  });

  const handleEntityClick = async (entity: Entity) => {
    setDetailOpen(true);
    setSelectedEntity(entity);
    try {
      setLoadingDetail(true);
      const detail = await api.get<Entity>(
        `/org-intelligence/entities/${entity.id}`,
      );
      setSelectedEntity(detail);
    } catch {
      // keep the basic entity data
    } finally {
      setLoadingDetail(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <HelpTooltip text="Filtra por tipo de entidad. Los tipos incluyen departamentos, roles, procesos, sistemas, problemas y más. Cada tipo tiene un color distintivo." />
        {ENTITY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeTypes.has(type)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {ENTITY_TYPE_CONFIG[type].label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Confianza mínima: {Math.round(minConfidence * 100)}%
        </span>
        <Slider
          className="w-48"
          value={[minConfidence * 100]}
          min={0}
          max={100}
          step={5}
          onValueChange={([val]) => setMinConfidence(val / 100)}
        />
        <HelpTooltip text="La confianza indica qué tan segura está la IA de la información extraída. 100% = mencionado explícitamente, 50% = inferido del contexto, <50% = requiere validación humana." />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 py-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-5 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEntities.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No se encontraron entidades
              {activeTypes.size > 0 ? " con los filtros seleccionados" : ""}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {filteredEntities.map((entity) => {
              const relCount =
                (entity._count?.relations ?? 0) +
                (entity._count?.reverseRelations ?? 0);
              return (
                <Card
                  key={entity.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => handleEntityClick(entity)}
                >
                  <CardContent className="flex items-center gap-4 py-3">
                    <EntityTypeBadge type={entity.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{entity.name}</p>
                      {entity.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {entity.description}
                        </p>
                      )}
                    </div>
                    {relCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {relCount} {relCount === 1 ? "relación" : "relaciones"}
                      </span>
                    )}
                    <ConfidenceBadge confidence={entity.confidence} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEntity && (
                <>
                  <EntityTypeBadge type={selectedEntity.type} />
                  {selectedEntity.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>Detalle de la entidad</DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : selectedEntity ? (
            <div className="space-y-4">
              {selectedEntity.description && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Descripción
                  </h4>
                  <p className="text-sm">{selectedEntity.description}</p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Confianza
                  </h4>
                  <ConfidenceBadge confidence={selectedEntity.confidence} />
                </div>
              </div>
              {selectedEntity.aliases && selectedEntity.aliases.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Alias
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedEntity.aliases.map((alias, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedEntity.metadata &&
                Object.keys(selectedEntity.metadata).length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                      Metadata
                    </h4>
                    <pre className="max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs">
                      {JSON.stringify(selectedEntity.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              {selectedEntity.relations &&
                selectedEntity.relations.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                      Relaciones
                    </h4>
                    <div className="space-y-1">
                      {selectedEntity.relations.map((rel) => (
                        <div
                          key={rel.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="text-muted-foreground">
                            {rel.type}
                          </span>
                          <span className="font-medium">
                            {rel.targetEntity.name}
                          </span>
                          <EntityTypeBadge type={rel.targetEntity.type} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
