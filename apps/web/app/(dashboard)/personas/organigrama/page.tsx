"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EducationalEmptyState } from "@/components/org-intelligence/educational-empty-state";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import {
  OrgChartNode,
  type OrgChartNodeData,
} from "@/components/org-intelligence/orgchart-node";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Maximize01Icon,
} from "@hugeicons/core-free-icons";

/* ---------- Types ---------- */

interface OrgChartPerson {
  id: string;
  name: string;
  role?: string;
  position?: string;
  department?: string;
  avatarUrl?: string | null;
  status?: string;
  source?: string;
  directReportsCount?: number;
  directReports?: OrgChartPerson[];
}

interface OrgChartResponse {
  roots: OrgChartPerson[];
  unassigned: OrgChartPerson[];
  stats: {
    totalPersons: number;
    totalActive: number;
    totalVacant: number;
    totalUnassigned: number;
    departments: string[];
    maxDepth: number;
  };
}

/* ---------- Helpers ---------- */

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

function treeToNodesAndEdges(
  tree: OrgChartPerson[],
  parentId?: string,
  nodes: Node<OrgChartNodeData>[] = [],
  edges: Edge[] = [],
) {
  for (const person of tree) {
    nodes.push({
      id: person.id,
      type: "orgChartNode",
      position: { x: 0, y: 0 },
      data: {
        name: person.name,
        role: person.role || person.position,
        department: person.department,
        avatarUrl: person.avatarUrl ?? null,
        directReportsCount: person.directReports?.length ?? person.directReportsCount ?? 0,
        status: person.status || "ACTIVE",
      },
    });

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${person.id}`,
        source: parentId,
        target: person.id,
        type: "smoothstep",
        style: { stroke: "#94A3B8", strokeWidth: 1.5 },
      });
    }

    if (person.directReports?.length) {
      treeToNodesAndEdges(person.directReports, person.id, nodes, edges);
    }
  }
  return { nodes, edges };
}

function getLayoutedElements(
  nodes: Node<OrgChartNodeData>[],
  edges: Edge[],
): { nodes: Node<OrgChartNodeData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

  nodes.forEach((node) =>
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }),
  );
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* ---------- Component ---------- */

const nodeTypes = { orgChartNode: OrgChartNode };

export default function OrganigramaPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<OrgChartNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stats, setStats] = useState<OrgChartResponse["stats"] | null>(null);
  const reactFlowRef = useRef<{ fitView: () => void } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchOrgChart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<OrgChartResponse>(
        "/org-intelligence/persons/orgchart",
      );

      const hasHierarchy =
        res.roots && res.roots.length > 0;

      if (!hasHierarchy) {
        setIsEmpty(true);
        setNodes([]);
        setEdges([]);
        setStats(res.stats ?? null);
        return;
      }

      setIsEmpty(false);
      setStats(res.stats ?? null);

      const { nodes: rawNodes, edges: rawEdges } = treeToNodesAndEdges(
        res.roots,
      );

      // Also add unassigned persons as separate nodes
      if (res.unassigned?.length) {
        for (const person of res.unassigned) {
          rawNodes.push({
            id: person.id,
            type: "orgChartNode",
            position: { x: 0, y: 0 },
            data: {
              name: person.name,
              role: person.role || person.position,
              department: person.department,
              avatarUrl: person.avatarUrl ?? null,
              directReportsCount: 0,
              status: person.status || "ACTIVE",
            },
          });
        }
      }

      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
        rawNodes,
        rawEdges,
      );

      setNodes(layouted);
      setEdges(layoutedEdges);
    } catch (err: unknown) {
      console.error("Error al cargar organigrama:", err);
      // If 404 or endpoint doesn't exist yet, show empty state
      const status = (err as { status?: number })?.status;
      const message = (err as { message?: string })?.message;
      if (status === 404 || message?.includes("404")) {
        setIsEmpty(true);
        setError(null);
      } else {
        setIsEmpty(true);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  // Search: highlight matching nodes, dim others
  const styledNodes = useMemo(() => {
    if (!debouncedSearch.trim()) return nodes;
    const q = debouncedSearch.toLowerCase();
    return nodes.map((node) => {
      const d = node.data as OrgChartNodeData;
      const matches =
        d.name.toLowerCase().includes(q) ||
        (d.role?.toLowerCase().includes(q) ?? false) ||
        (d.department?.toLowerCase().includes(q) ?? false);
      return {
        ...node,
        style: matches ? {} : { opacity: 0.25 },
      };
    });
  }, [nodes, debouncedSearch]);

  const handleFitView = useCallback(() => {
    reactFlowRef.current?.fitView();
  }, []);

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Organigrama</h1>
          <HelpTooltip text="Visualiza la estructura jer&aacute;rquica de tu organizaci&oacute;n. Cada persona aparece como un nodo conectado a su jefatura directa." />
        </div>
        <EducationalEmptyState
          icon={
            <svg
              className="size-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="8.5" y="16" width="7" height="5" rx="1" />
              <line x1="6.5" y1="8" x2="6.5" y2="12" />
              <line x1="17.5" y1="8" x2="17.5" y2="12" />
              <line x1="6.5" y1="12" x2="17.5" y2="12" />
              <line x1="12" y1="12" x2="12" y2="16" />
            </svg>
          }
          title="Construye el organigrama de tu organizaci&oacute;n"
          description={
            <>
              <p>
                El organigrama muestra la estructura jer&aacute;rquica de tu equipo.
                Para empezar, necesitas definir qui&eacute;n reporta a qui&eacute;n.
              </p>
              <p className="mt-2">
                Ve al{" "}
                <a
                  href="/personas/directorio"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Directorio de Personas
                </a>{" "}
                y asigna la relaci&oacute;n &quot;Reporta a&quot; en cada perfil. Una vez que
                existan relaciones jer&aacute;rquicas, el organigrama se generar&aacute;
                autom&aacute;ticamente.
              </p>
            </>
          }
          action={{
            label: "Ir al Directorio",
            onClick: () => {
              window.location.href = "/personas/directorio";
            },
          }}
          tip='Tip: Comienza por registrar al l&iacute;der de la organizaci&oacute;n (ej: Gerente General). Luego agrega sus reportes directos y asigna la relaci&oacute;n "Reporta a".'
        />
        {stats && stats.totalPersons > 0 && (
          <div className="rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Hay {stats.totalPersons} persona{stats.totalPersons !== 1 ? "s" : ""}{" "}
            registrada{stats.totalPersons !== 1 ? "s" : ""} en el directorio, pero
            ninguna tiene una relaci&oacute;n jer&aacute;rquica (&quot;reporta a&quot;) definida.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Organigrama</h1>
          <HelpTooltip text="Visualiza la estructura jer&aacute;rquica de tu organizaci&oacute;n. Cada persona aparece como un nodo conectado a su jefatura directa." />
          {stats && (
            <span className="ml-2 text-sm text-muted-foreground">
              {stats.totalPersons} persona{stats.totalPersons !== 1 ? "s" : ""}
              {stats.departments?.length
                ? ` en ${stats.departments.length} departamento${stats.departments.length !== 1 ? "s" : ""}`
                : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Buscar persona..."
              className="h-9 w-56 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFitView}
            title="Ajustar vista"
          >
            <HugeiconsIcon icon={Maximize01Icon} className="size-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* React Flow Canvas */}
      <div className="flex-1 min-h-[500px] rounded-lg border bg-background">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          onInit={(instance) => {
            reactFlowRef.current = instance;
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-muted/50 !border-border rounded-lg"
          />
          <Controls
            className="!bg-card !border-border !rounded-lg !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
