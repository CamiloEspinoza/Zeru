"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { MermaidDiagram } from "@/components/org-intelligence/mermaid-diagram";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";

// ── Types ──────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface ProjectsResponse {
  data: Project[];
  meta: { total: number; page: number; perPage: number };
}

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

interface SearchResult {
  entities?: Array<{
    id: string;
    type: string;
    name: string;
    description: string | null;
    confidence: number;
    score?: number;
  }>;
  chunks?: Array<{
    id: string;
    content: string;
    speaker?: string;
    timestamp?: string;
    score?: number;
  }>;
}

// ── Entity Type Keys ───────────────────────────────────

const ENTITY_TYPES = Object.keys(ENTITY_TYPE_CONFIG);

// ── Page Component ─────────────────────────────────────

export default function KnowledgeBasePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Fetch projects on mount
  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const res = await api.get<ProjectsResponse>(
        "/org-intelligence/projects",
      );
      setProjects(res.data);
    } catch {
      // API may not be ready
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Base de Conocimiento</h1>
        <p className="text-muted-foreground mt-1">
          Explora todo el conocimiento extraído de las entrevistas. Busca entidades, relaciones y procesos organizacionales.
        </p>
      </div>

      {/* Project Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Proyecto:</span>
        {loadingProjects ? (
          <Skeleton className="h-7 w-48" />
        ) : projects.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            No hay proyectos disponibles
          </span>
        ) : (
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecciona un proyecto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedProjectId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Selecciona un proyecto para explorar su base de conocimiento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="entities">
          <TabsList>
            <TabsTrigger value="entities">Entidades</TabsTrigger>
            <TabsTrigger value="search">Búsqueda</TabsTrigger>
            <TabsTrigger value="processes">Procesos</TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="pt-4">
            <EntitiesTab projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="search" className="pt-4">
            <SearchTab projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="processes" className="pt-4">
            <ProcessesTab projectId={selectedProjectId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Entities Tab ───────────────────────────────────────

function EntitiesTab({ projectId }: { projectId: string }) {
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
      {/* Type filter chips */}
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

      {/* Confidence filter */}
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

      {/* Entities list */}
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
                        {relCount}{" "}
                        {relCount === 1 ? "relación" : "relaciones"}
                      </span>
                    )}
                    <ConfidenceBadge confidence={entity.confidence} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
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

      {/* Entity Detail Dialog */}
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

// ── Search Tab ─────────────────────────────────────────

function SearchTab({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      setLoading(true);
      setSearched(true);

      // Try both search endpoints
      let entityResults: SearchResult["entities"] = [];
      let chunkResults: SearchResult["chunks"] = [];

      try {
        const entityRes = await api.post<{
          data: NonNullable<SearchResult["entities"]>;
        }>("/org-intelligence/search/entities", {
          projectId,
          query: query.trim(),
          limit: 20,
        });
        entityResults = entityRes.data;
      } catch {
        // endpoint may not be ready
      }

      try {
        const chunkRes = await api.post<{
          data: NonNullable<SearchResult["chunks"]>;
        }>("/org-intelligence/search", {
          projectId,
          query: query.trim(),
          limit: 20,
        });
        chunkResults = chunkRes.data;
      } catch {
        // endpoint may not be ready
      }

      setResults({ entities: entityResults, chunks: chunkResults });
    } catch {
      setResults({ entities: [], chunks: [] });
    } finally {
      setLoading(false);
    }
  };

  const hasResults =
    results &&
    ((results.entities && results.entities.length > 0) ||
      (results.chunks && results.chunks.length > 0));

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Ej: 'problemas en logística', 'quién maneja las compras', 'sistemas que usa producción'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          La búsqueda semántica entiende el significado de tu consulta, no solo palabras exactas. Busca en todas las transcripciones y entidades del proyecto.
        </p>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-3">
                <Skeleton className="mb-2 h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !searched ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Escribe una consulta para buscar en el conocimiento
              organizacional.
            </p>
          </CardContent>
        </Card>
      ) : !hasResults ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No se encontraron resultados para &quot;{query}&quot;.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Entity results */}
          {results?.entities && results.entities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Entidades ({results.entities.length})
              </h3>
              {results.entities.map((entity) => (
                <Card key={entity.id}>
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
                    <ConfidenceBadge confidence={entity.confidence} />
                    {entity.score != null && (
                      <span className="text-xs text-muted-foreground">
                        Relevancia: {Math.round(entity.score * 100)}%
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Chunk results */}
          {results?.chunks && results.chunks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Fragmentos de entrevista ({results.chunks.length})
              </h3>
              {results.chunks.map((chunk) => (
                <Card key={chunk.id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {chunk.speaker && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {chunk.speaker}
                        </span>
                      )}
                      {chunk.timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {chunk.timestamp}
                        </span>
                      )}
                      {chunk.score != null && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Relevancia: {Math.round(chunk.score * 100)}%
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{chunk.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Processes Tab (Mermaid Diagrams) ───────────────────

function ProcessesTab({ projectId }: { projectId: string }) {
  const [processes, setProcesses] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<Entity | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activities, setActivities] = useState<Entity[]>([]);

  const fetchProcesses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<EntitiesResponse>(
        `/org-intelligence/entities?projectId=${projectId}&type=PROCESS&perPage=50`,
      );
      setProcesses(res.data);
    } catch {
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  const handleProcessClick = async (process: Entity) => {
    setSelectedProcess(process);
    setActivities([]);
    try {
      setLoadingDetail(true);
      const detail = await api.get<Entity>(
        `/org-intelligence/entities/${process.id}`,
      );
      // Try to extract activities from relations
      const activityRelations =
        detail.relations?.filter(
          (r) => r.targetEntity.type === "ACTIVITY",
        ) || [];

      if (activityRelations.length > 0) {
        // Fetch each activity for details
        const activityEntities = await Promise.all(
          activityRelations.map(async (rel) => {
            try {
              return await api.get<Entity>(
                `/org-intelligence/entities/${rel.targetEntity.id}`,
              );
            } catch {
              return {
                id: rel.targetEntity.id,
                name: rel.targetEntity.name,
                type: "ACTIVITY",
                description: null,
                confidence: 0,
                aliases: [],
                metadata: null,
              } as Entity;
            }
          }),
        );
        setActivities(activityEntities);
      }
    } catch {
      // keep basic process data
    } finally {
      setLoadingDetail(false);
    }
  };

  const generateMermaidChart = (
    process: Entity,
    acts: Entity[],
  ): string | null => {
    if (acts.length === 0) return null;

    const lines = ["flowchart TD"];
    acts.forEach((act, i) => {
      const nodeId = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? i : "");
      const label = act.name.replace(/"/g, "'");
      lines.push(`    ${nodeId}["${label}"]`);
    });

    // Connect activities sequentially
    for (let i = 0; i < acts.length - 1; i++) {
      const fromId =
        String.fromCharCode(65 + (i % 26)) + (i >= 26 ? i : "");
      const toId =
        String.fromCharCode(65 + ((i + 1) % 26)) + (i + 1 >= 26 ? i + 1 : "");
      lines.push(`    ${fromId} --> ${toId}`);
    }

    return lines.join("\n");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-3">
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No se encontraron procesos en este proyecto.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Los diagramas se generan cuando el entrevistado describe un proceso paso a paso. Si no ves procesos, puede que las entrevistas aún no hayan sido procesadas o que no se hayan descrito procesos específicos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Diagramas de flujo generados automáticamente desde las entrevistas. Cada proceso muestra sus actividades, responsables y dependencias.
      </p>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* Process list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Procesos</h3>
        {processes.map((process) => (
          <Card
            key={process.id}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedProcess?.id === process.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleProcessClick(process)}
          >
            <CardContent className="py-3">
              <p className="text-sm font-medium">{process.name}</p>
              {process.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {process.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Diagram area */}
      <div>
        {!selectedProcess ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Selecciona un proceso para ver su diagrama.
              </p>
            </CardContent>
          </Card>
        ) : loadingDetail ? (
          <Card>
            <CardContent className="py-10">
              <div className="space-y-3">
                <Skeleton className="mx-auto h-6 w-48" />
                <Skeleton className="mx-auto h-40 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <EntityTypeBadge type="PROCESS" />
                {selectedProcess.name}
              </CardTitle>
              {selectedProcess.description && (
                <CardDescription>
                  {selectedProcess.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {(() => {
                const chart = generateMermaidChart(
                  selectedProcess,
                  activities,
                );
                if (!chart) {
                  return (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No hay actividades definidas para este proceso.
                    </p>
                  );
                }
                return (
                  <div className="overflow-auto rounded-md border p-4">
                    <MermaidDiagram chart={chart} />
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </div>
  );
}
