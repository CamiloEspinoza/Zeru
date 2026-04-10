"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityTypeBadge } from "@/components/org-intelligence/entity-type-badge";
import { ConfidenceBadge } from "@/components/org-intelligence/confidence-badge";
import { ChunkCard } from "@/components/org-intelligence/chunk-card";

interface SearchChunk {
  id: string;
  content: string;
  interviewId: string;
  speakerId: string | null;
  startTimeMs: number | null;
  endTimeMs: number | null;
  rrfScore: number;
  interviewTitle: string | null;
  interviewDate: string | null;
  hasAudio: boolean;
  speakerName: string | null;
  speakerRole: string | null;
  speakerDepartment: string | null;
  isInterviewer: boolean | null;
}

interface SearchResult {
  entities?: Array<{
    id: string;
    type: string;
    name: string;
    description: string | null;
    similarity: number;
  }>;
  chunks?: SearchChunk[];
}

const SEARCH_EXAMPLES = [
  "problemas de coordinación",
  "procesos manuales",
  "quién usa SAP",
  "dependencias entre áreas",
];

export function SearchTab({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (overrideQuery?: string) => {
    const searchQuery = overrideQuery ?? query;
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      setSearched(true);

      let entityResults: SearchResult["entities"] = [];
      let chunkResults: SearchResult["chunks"] = [];

      try {
        const entityRes = await api.post<{
          data: NonNullable<SearchResult["entities"]>;
        }>("/org-intelligence/search/entities", {
          projectId,
          query: searchQuery.trim(),
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
          query: searchQuery.trim(),
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

  const handleExampleClick = (example: string) => {
    setQuery(example);
    handleSearch(example);
  };

  const hasResults =
    results &&
    ((results.entities && results.entities.length > 0) ||
      (results.chunks && results.chunks.length > 0));

  return (
    <div className="space-y-4">
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
          <Button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
          >
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          La búsqueda semántica entiende el significado de tu consulta, no solo
          palabras exactas. Busca en todas las transcripciones y entidades del
          proyecto.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Prueba:</span>
          {SEARCH_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => handleExampleClick(example)}
              className="rounded-md border border-muted-foreground/20 bg-muted/50 px-2 py-1 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

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
              Escribe una consulta para buscar en el conocimiento organizacional.
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
                    <ConfidenceBadge confidence={entity.similarity} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {results?.chunks && results.chunks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Fragmentos de entrevista ({results.chunks.length})
              </h3>
              {results.chunks.map((chunk) => (
                <ChunkCard
                  key={chunk.id}
                  content={chunk.content}
                  speakerName={chunk.speakerName ?? undefined}
                  speakerRole={chunk.speakerRole ?? undefined}
                  isInterviewer={chunk.isInterviewer ?? undefined}
                  interviewId={chunk.interviewId}
                  interviewTitle={chunk.interviewTitle ?? undefined}
                  interviewDate={chunk.interviewDate ?? undefined}
                  startTimeMs={chunk.startTimeMs ?? undefined}
                  endTimeMs={chunk.endTimeMs ?? undefined}
                  hasAudio={chunk.hasAudio}
                  similarity={chunk.rrfScore}
                  projectId={projectId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
