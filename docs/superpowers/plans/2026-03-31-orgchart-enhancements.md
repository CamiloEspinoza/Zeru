# Orgchart Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the org chart from a static visualization into an interactive management tool with 11 features.

**Architecture:** Modular — 5 hooks + 6 components extracted from the current monolithic page. Each hook has a single responsibility. The page becomes a slim orchestrator delegating to `orgchart-canvas.tsx`.

**Tech Stack:** @xyflow/react 12.10.2, @dagrejs/dagre 3.0.0, html-to-image 1.11.11, Radix UI (Dialog, DropdownMenu), Tailwind CSS, sonner (toasts)

**Spec:** `docs/superpowers/specs/2026-03-31-orgchart-enhancements-design.md`

---

## Task 0: Install dependency and create directory structure

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/hooks/org-intelligence/` (directory)
- Create: `apps/web/components/org-intelligence/orgchart/` (directory)

- [ ] **Step 1: Install html-to-image**

```bash
pnpm add html-to-image@1.11.11 --filter @zeru/web
```

- [ ] **Step 2: Create directories**

```bash
mkdir -p apps/web/hooks/org-intelligence
mkdir -p apps/web/components/org-intelligence/orgchart
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/hooks/org-intelligence/.gitkeep apps/web/components/org-intelligence/orgchart/.gitkeep
git commit -m "chore(orgchart): add html-to-image dependency and directory structure"
```

---

## Task 1: Extract shared types

Shared types used across all hooks and components. Extracted once, imported everywhere.

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/types.ts`

- [ ] **Step 1: Create types file**

```ts
// apps/web/components/org-intelligence/orgchart/types.ts
import type { Node, Edge } from "@xyflow/react";

export interface OrgChartPerson {
  id: string;
  name: string;
  role?: string;
  position?: string;
  department?: { id: string; name: string; color: string | null } | null;
  avatarUrl?: string | null;
  status?: string;
  source?: string;
  directReportsCount?: number;
  directReports?: OrgChartPerson[];
}

export interface OrgChartResponse {
  roots: OrgChartPerson[];
  unassigned: OrgChartPerson[];
  stats: OrgChartStats;
}

export interface OrgChartStats {
  totalPersons: number;
  totalActive: number;
  totalVacant: number;
  totalUnassigned: number;
  departments: string[];
  maxDepth: number;
}

export interface OrgChartNodeData {
  name: string;
  role?: string;
  department?: string;
  avatarUrl?: string | null;
  directReportsCount: number;
  status: string;
  hasChildren: boolean;
  [key: string]: unknown;
}

export type OrgNode = Node<OrgChartNodeData>;
export type OrgEdge = Edge;

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  hasReportsTo: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/types.ts
git commit -m "feat(orgchart): extract shared types"
```

---

## Task 2: Create `useOrgChart` hook

Extracts all data-fetching, tree-to-node transformation, and dagre layout logic from the current page.

**Files:**
- Create: `apps/web/hooks/org-intelligence/use-orgchart.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/hooks/org-intelligence/use-orgchart.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { useNodesState, useEdgesState, useReactFlow } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { api } from "@/lib/api-client";
import type {
  OrgChartPerson,
  OrgChartResponse,
  OrgChartStats,
  OrgChartNodeData,
  OrgNode,
  OrgEdge,
} from "@/components/org-intelligence/orgchart/types";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

function treeToNodesAndEdges(
  tree: OrgChartPerson[],
  parentId?: string,
  nodes: OrgNode[] = [],
  edges: OrgEdge[] = [],
): { nodes: OrgNode[]; edges: OrgEdge[] } {
  for (const person of tree) {
    nodes.push({
      id: person.id,
      type: "orgChartNode",
      position: { x: 0, y: 0 },
      data: {
        name: person.name,
        role: person.role || person.position,
        department: person.department?.name,
        avatarUrl: person.avatarUrl ?? null,
        directReportsCount:
          person.directReports?.length ?? person.directReportsCount ?? 0,
        status: person.status || "ACTIVE",
        hasChildren: (person.directReports?.length ?? 0) > 0,
      },
    });

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${person.id}`,
        source: parentId,
        target: person.id,
        type: "orgChartEdge",
        className: "orgchart-edge",
      });
    }

    if (person.directReports?.length) {
      treeToNodesAndEdges(person.directReports, person.id, nodes, edges);
    }
  }
  return { nodes, edges };
}

export function layoutWithDagre(
  nodes: OrgNode[],
  edges: OrgEdge[],
): { nodes: OrgNode[]; edges: OrgEdge[] } {
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

export function useOrgChart() {
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<OrgEdge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [stats, setStats] = useState<OrgChartStats | null>(null);
  const [unassigned, setUnassigned] = useState<OrgChartPerson[]>([]);
  const { getViewport, setViewport } = useReactFlow();

  const fetchOrgChart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<OrgChartResponse>(
        "/org-intelligence/persons/orgchart",
      );

      const hasHierarchy = res.roots && res.roots.length > 0;

      if (!hasHierarchy) {
        setIsEmpty(true);
        setNodes([]);
        setEdges([]);
        setStats(res.stats ?? null);
        setUnassigned(res.unassigned ?? []);
        return;
      }

      setIsEmpty(false);
      setStats(res.stats ?? null);
      setUnassigned(res.unassigned ?? []);

      const { nodes: rawNodes, edges: rawEdges } = treeToNodesAndEdges(
        res.roots,
      );

      const { nodes: layouted, edges: layoutedEdges } = layoutWithDagre(
        rawNodes,
        rawEdges,
      );

      setNodes(layouted);
      setEdges(layoutedEdges);
    } catch (err: unknown) {
      console.error("Error al cargar organigrama:", err);
      setIsEmpty(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  const refetchPreservingViewport = useCallback(async () => {
    const vp = getViewport();
    await fetchOrgChart();
    requestAnimationFrame(() => setViewport(vp));
  }, [fetchOrgChart, getViewport, setViewport]);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    stats,
    loading,
    error,
    isEmpty,
    unassigned,
    fetchOrgChart,
    refetchPreservingViewport,
  };
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint --filter @zeru/web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks/org-intelligence/use-orgchart.ts
git commit -m "feat(orgchart): extract useOrgChart hook"
```

---

## Task 3: Create `useOrgChartActions` hook

All mutation handlers: connect, delete edges, reconnect, delete/unlink persons with automatic child reconnection.

**Files:**
- Create: `apps/web/hooks/org-intelligence/use-orgchart-actions.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/hooks/org-intelligence/use-orgchart-actions.ts
"use client";

import { useCallback } from "react";
import {
  reconnectEdge,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
  type Connection,
} from "@xyflow/react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { OrgNode, OrgEdge } from "@/components/org-intelligence/orgchart/types";

interface UseOrgChartActionsArgs {
  nodes: OrgNode[];
  edges: OrgEdge[];
  setEdges: React.Dispatch<React.SetStateAction<OrgEdge[]>>;
  refetch: () => Promise<void>;
}

async function reconnectChildrenToParent(
  nodeId: string,
  nodes: OrgNode[],
  edges: OrgEdge[],
) {
  const incomers = getIncomers({ id: nodeId } as OrgNode, nodes, edges);
  const outgoers = getOutgoers({ id: nodeId } as OrgNode, nodes, edges);
  const parentId = incomers.length > 0 ? incomers[0].id : null;

  for (const child of outgoers) {
    await api.patch(
      `/org-intelligence/persons/${child.id}/reports-to`,
      { reportsToId: parentId },
    );
  }

  return { parentId, childCount: outgoers.length };
}

export function useOrgChartActions({
  nodes,
  edges,
  setEdges,
  refetch,
}: UseOrgChartActionsArgs) {
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const personId = connection.target;
      const reportsToId = connection.source;

      if (personId === reportsToId) {
        toast.error("Una persona no puede reportar a sí misma");
        return;
      }

      try {
        await api.patch(
          `/org-intelligence/persons/${personId}/reports-to`,
          { reportsToId },
        );
        toast.success("Relación jerárquica actualizada");
        await refetch();
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message ??
          "Error al actualizar la relación";
        toast.error(message);
      }
    },
    [refetch],
  );

  const onEdgesDelete = useCallback(
    async (deletedEdges: OrgEdge[]) => {
      for (const edge of deletedEdges) {
        try {
          await api.patch(
            `/org-intelligence/persons/${edge.target}/reports-to`,
            { reportsToId: null },
          );
          toast.success("Conexión eliminada");
        } catch (err: unknown) {
          const message =
            (err as { message?: string })?.message ??
            "Error al eliminar la conexión";
          toast.error(message);
        }
      }
      await refetch();
    },
    [refetch],
  );

  const onReconnect = useCallback(
    (oldEdge: OrgEdge, newConnection: Connection) => {
      setEdges((els) => reconnectEdge(oldEdge, newConnection, els));

      const newTarget = newConnection.target;
      const newSource = newConnection.source;
      if (!newTarget || !newSource) return;

      api
        .patch(`/org-intelligence/persons/${newTarget}/reports-to`, {
          reportsToId: newSource,
        })
        .then(() => {
          toast.success("Relación actualizada");
          refetch();
        })
        .catch((err: unknown) => {
          const message =
            (err as { message?: string })?.message ??
            "Error al reconectar";
          toast.error(message);
          refetch();
        });
    },
    [setEdges, refetch],
  );

  const unlinkPerson = useCallback(
    async (personId: string) => {
      try {
        const { childCount } = await reconnectChildrenToParent(
          personId,
          nodes,
          edges,
        );
        await api.patch(
          `/org-intelligence/persons/${personId}/reports-to`,
          { reportsToId: null },
        );
        const msg =
          childCount > 0
            ? `Persona desvinculada, ${childCount} reporte${childCount !== 1 ? "s" : ""} reasignado${childCount !== 1 ? "s" : ""}`
            : "Persona desvinculada del organigrama";
        toast.success(msg);
        await refetch();
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message ??
          "Error al desvincular";
        toast.error(message);
      }
    },
    [nodes, edges, refetch],
  );

  const deletePerson = useCallback(
    async (personId: string) => {
      try {
        const { childCount } = await reconnectChildrenToParent(
          personId,
          nodes,
          edges,
        );
        await api.delete(`/org-intelligence/persons/${personId}`);
        const msg =
          childCount > 0
            ? `Persona eliminada, ${childCount} reporte${childCount !== 1 ? "s" : ""} reasignado${childCount !== 1 ? "s" : ""}`
            : "Persona eliminada";
        toast.success(msg);
        await refetch();
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message ?? "Error al eliminar";
        toast.error(message);
      }
    },
    [nodes, edges, refetch],
  );

  return {
    onConnect,
    onEdgesDelete,
    onReconnect,
    unlinkPerson,
    deletePerson,
  };
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint --filter @zeru/web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks/org-intelligence/use-orgchart-actions.ts
git commit -m "feat(orgchart): extract useOrgChartActions hook"
```

---

## Task 4: Create `useExpandCollapse` hook

Manages a Set of collapsed node IDs and filters nodes/edges to only show visible ones, then recalculates dagre layout.

**Files:**
- Create: `apps/web/hooks/org-intelligence/use-expand-collapse.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/hooks/org-intelligence/use-expand-collapse.ts
"use client";

import { useState, useMemo, useCallback } from "react";
import { layoutWithDagre } from "./use-orgchart";
import type { OrgNode, OrgEdge } from "@/components/org-intelligence/orgchart/types";

function getDescendantIds(
  nodeId: string,
  childrenMap: Map<string, string[]>,
): Set<string> {
  const descendants = new Set<string>();
  const stack = childrenMap.get(nodeId) ?? [];

  while (stack.length > 0) {
    const current = stack.pop()!;
    descendants.add(current);
    const children = childrenMap.get(current) ?? [];
    for (const child of children) {
      stack.push(child);
    }
  }

  return descendants;
}

function countDescendants(
  nodeId: string,
  childrenMap: Map<string, string[]>,
): number {
  return getDescendantIds(nodeId, childrenMap).size;
}

export function useExpandCollapse(nodes: OrgNode[], edges: OrgEdge[]) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of edges) {
      const children = map.get(edge.source) ?? [];
      children.push(edge.target);
      map.set(edge.source, children);
    }
    return map;
  }, [edges]);

  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const collapsedId of collapsedIds) {
      const descendants = getDescendantIds(collapsedId, childrenMap);
      for (const d of descendants) {
        hidden.add(d);
      }
    }
    return hidden;
  }, [collapsedIds, childrenMap]);

  const { visibleNodes, visibleEdges } = useMemo(() => {
    const filteredNodes = nodes.filter((n) => !hiddenIds.has(n.id));
    const filteredEdges = edges.filter(
      (e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target),
    );

    if (hiddenIds.size === 0) {
      return { visibleNodes: nodes, visibleEdges: edges };
    }

    const { nodes: layouted, edges: layoutedEdges } = layoutWithDagre(
      filteredNodes,
      filteredEdges,
    );
    return { visibleNodes: layouted, visibleEdges: layoutedEdges };
  }, [nodes, edges, hiddenIds]);

  const toggleExpand = useCallback(
    (nodeId: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    },
    [],
  );

  const expandAll = useCallback(() => setCollapsedIds(new Set()), []);

  const collapseAll = useCallback(() => {
    const rootIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      rootIds.delete(edge.target);
    }
    const withChildren = new Set<string>();
    for (const edge of edges) {
      if (rootIds.has(edge.source) || childrenMap.has(edge.source)) {
        withChildren.add(edge.source);
      }
    }
    setCollapsedIds(withChildren);
  }, [nodes, edges, childrenMap]);

  const getHiddenCount = useCallback(
    (nodeId: string) => countDescendants(nodeId, childrenMap),
    [childrenMap],
  );

  return {
    visibleNodes,
    visibleEdges,
    toggleExpand,
    expandAll,
    collapseAll,
    collapsedIds,
    getHiddenCount,
  };
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint --filter @zeru/web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks/org-intelligence/use-expand-collapse.ts
git commit -m "feat(orgchart): add useExpandCollapse hook"
```

---

## Task 5: Create `useViewportPersistence` hook

Saves and restores viewport position/zoom in localStorage per tenant.

**Files:**
- Create: `apps/web/hooks/org-intelligence/use-viewport-persistence.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/hooks/org-intelligence/use-viewport-persistence.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Viewport } from "@xyflow/react";

function getStorageKey(): string {
  const tenantId =
    typeof window !== "undefined"
      ? localStorage.getItem("tenantId")
      : null;
  return `orgchart-viewport-${tenantId ?? "default"}`;
}

export function useViewportPersistence() {
  const [savedViewport] = useState<Viewport | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(getStorageKey());
      return raw ? (JSON.parse(raw) as Viewport) : null;
    } catch {
      return null;
    }
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          localStorage.setItem(getStorageKey(), JSON.stringify(viewport));
        } catch {
          // localStorage full or unavailable — ignore
        }
      }, 500);
    },
    [],
  );

  return { savedViewport, onMoveEnd };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/org-intelligence/use-viewport-persistence.ts
git commit -m "feat(orgchart): add useViewportPersistence hook"
```

---

## Task 6: Create `usePathHighlight` hook

Applies search highlighting to nodes and edges, and supports chain-of-command highlighting.

**Files:**
- Create: `apps/web/hooks/org-intelligence/use-path-highlight.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/hooks/org-intelligence/use-path-highlight.ts
"use client";

import { useMemo, useState, useCallback } from "react";
import type { OrgNode, OrgEdge, OrgChartNodeData } from "@/components/org-intelligence/orgchart/types";

function getPathToRoot(
  nodeId: string,
  targetToEdge: Map<string, OrgEdge>,
): Set<string> {
  const pathEdgeIds = new Set<string>();
  let current = nodeId;

  while (true) {
    const edge = targetToEdge.get(current);
    if (!edge) break;
    pathEdgeIds.add(edge.id);
    current = edge.source;
  }

  return pathEdgeIds;
}

function getNodesOnPath(
  nodeId: string,
  targetToEdge: Map<string, OrgEdge>,
): Set<string> {
  const nodeIds = new Set<string>();
  nodeIds.add(nodeId);
  let current = nodeId;

  while (true) {
    const edge = targetToEdge.get(current);
    if (!edge) break;
    nodeIds.add(edge.source);
    current = edge.source;
  }

  return nodeIds;
}

export function usePathHighlight(
  nodes: OrgNode[],
  edges: OrgEdge[],
  search: string,
) {
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );

  const targetToEdge = useMemo(() => {
    const map = new Map<string, OrgEdge>();
    for (const edge of edges) {
      map.set(edge.target, edge);
    }
    return map;
  }, [edges]);

  const highlightChain = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedNodeId(null);
  }, []);

  const { styledNodes, styledEdges } = useMemo(() => {
    // Chain of command mode
    if (highlightedNodeId) {
      const pathEdgeIds = getPathToRoot(highlightedNodeId, targetToEdge);
      const pathNodeIds = getNodesOnPath(highlightedNodeId, targetToEdge);

      const styled = nodes.map((node) => ({
        ...node,
        style: pathNodeIds.has(node.id) ? {} : { opacity: 0.15 },
      }));

      const styledE = edges.map((edge) => ({
        ...edge,
        className: pathEdgeIds.has(edge.id)
          ? "orgchart-edge highlighted"
          : "orgchart-edge dimmed",
      }));

      return { styledNodes: styled, styledEdges: styledE };
    }

    // Search mode
    const q = search.trim().toLowerCase();
    if (!q) {
      return { styledNodes: nodes, styledEdges: edges };
    }

    const matchingNodeIds = new Set<string>();
    const styledN = nodes.map((node) => {
      const d = node.data as OrgChartNodeData;
      const matches =
        d.name.toLowerCase().includes(q) ||
        (d.role?.toLowerCase().includes(q) ?? false) ||
        (d.department?.toLowerCase().includes(q) ?? false);
      if (matches) matchingNodeIds.add(node.id);
      return {
        ...node,
        style: matches ? {} : { opacity: 0.25 },
      };
    });

    // Highlight edges on paths from matches to root
    const highlightedEdgeIds = new Set<string>();
    for (const matchId of matchingNodeIds) {
      const pathIds = getPathToRoot(matchId, targetToEdge);
      for (const id of pathIds) {
        highlightedEdgeIds.add(id);
      }
    }

    const styledE = edges.map((edge) => ({
      ...edge,
      className: highlightedEdgeIds.has(edge.id)
        ? "orgchart-edge highlighted"
        : matchingNodeIds.size > 0
          ? "orgchart-edge dimmed"
          : "orgchart-edge",
    }));

    return { styledNodes: styledN, styledEdges: styledE };
  }, [nodes, edges, search, highlightedNodeId, targetToEdge]);

  return {
    styledNodes,
    styledEdges,
    highlightChain,
    clearHighlight,
    isHighlighting: highlightedNodeId !== null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/org-intelligence/use-path-highlight.ts
git commit -m "feat(orgchart): add usePathHighlight hook with search and chain-of-command"
```

---

## Task 7: Create `orgchart-context-menu.tsx`

Right-click context menu on nodes with all management actions.

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/orgchart-context-menu.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/org-intelligence/orgchart/orgchart-context-menu.tsx
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserGroupIcon,
  Edit02Icon,
  Delete02Icon,
  Add01Icon,
  Cancel01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import type { ContextMenuState } from "./types";

interface OrgChartContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onHighlightChain: (nodeId: string) => void;
  onAddReport: (reportsToId: string) => void;
  onUnlink: (personId: string) => void;
  onDelete: (personId: string) => void;
  onEdit: (personId: string) => void;
}

export function OrgChartContextMenu({
  menu,
  onClose,
  onHighlightChain,
  onAddReport,
  onUnlink,
  onDelete,
  onEdit,
}: OrgChartContextMenuProps) {
  const router = useRouter();

  const handleAction = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose],
  );

  if (!menu.visible) return null;

  // Ensure menu stays within viewport
  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
  };

  const menuWidth = 220;
  const menuHeight = 280;

  if (menu.x + menuWidth > window.innerWidth) {
    style.right = window.innerWidth - menu.x;
  } else {
    style.left = menu.x;
  }

  if (menu.y + menuHeight > window.innerHeight) {
    style.bottom = window.innerHeight - menu.y;
  } else {
    style.top = menu.y;
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        style={style}
        className="min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        <button
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          onClick={() =>
            handleAction(() =>
              router.push(`/personas/directorio?id=${menu.nodeId}`),
            )
          }
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          Ver perfil
        </button>

        <button
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          onClick={() => handleAction(() => onEdit(menu.nodeId))}
        >
          <HugeiconsIcon icon={Edit02Icon} className="size-4" />
          Editar cargo
        </button>

        <button
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          onClick={() => handleAction(() => onHighlightChain(menu.nodeId))}
        >
          <HugeiconsIcon icon={UserGroupIcon} className="size-4" />
          Ver cadena de mando
        </button>

        <div className="my-1 h-px bg-border" />

        <button
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          onClick={() => handleAction(() => onAddReport(menu.nodeId))}
        >
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          Agregar reporte directo
        </button>

        <div className="my-1 h-px bg-border" />

        <button
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          onClick={() => handleAction(() => onUnlink(menu.nodeId))}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          Desvincular del organigrama
        </button>

        <button
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          onClick={() => handleAction(() => onDelete(menu.nodeId))}
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          Eliminar persona
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/orgchart-context-menu.tsx
git commit -m "feat(orgchart): add context menu component"
```

---

## Task 8: Create `add-person-dialog.tsx`

Minimal dialog for creating a person inline with name, role, and department.

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/add-person-dialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/org-intelligence/orgchart/add-person-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
  color: string | null;
}

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportsToId: string | null;
  reportsToName?: string;
  onCreated: () => void;
}

export function AddPersonDialog({
  open,
  onOpenChange,
  reportsToId,
  reportsToName,
  onCreated,
}: AddPersonDialogProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      api
        .get<Department[]>("/org-intelligence/departments")
        .then(setDepartments)
        .catch(() => setDepartments([]));
    }
  }, [open]);

  function reset() {
    setName("");
    setRole("");
    setDepartmentId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const person = await api.post<{ id: string }>(
        "/org-intelligence/persons",
        {
          name: name.trim(),
          role: role.trim() || undefined,
          departmentId: departmentId || undefined,
        },
      );

      if (reportsToId) {
        await api.patch(
          `/org-intelligence/persons/${person.id}/reports-to`,
          { reportsToId },
        );
      }

      toast.success(`${name.trim()} agregado al organigrama`);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ?? "Error al crear persona";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Agregar persona</DialogTitle>
            <DialogDescription>
              {reportsToName
                ? `Nuevo reporte directo de ${reportsToName}`
                : "Nueva persona en el organigrama"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <label className="text-sm font-medium">
                Nombre <span className="text-destructive">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium">Cargo</label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ej: Gerente de Operaciones"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Departamento</label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/add-person-dialog.tsx
git commit -m "feat(orgchart): add inline person creation dialog"
```

---

## Task 9: Create `orgchart-toolbar.tsx`

Top toolbar with search, expand/collapse controls, PNG export, and fit view.

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/orgchart-toolbar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/org-intelligence/orgchart/orgchart-toolbar.tsx
"use client";

import { useCallback } from "react";
import { getNodesBounds, getViewportForBounds, useReactFlow } from "@xyflow/react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Maximize01Icon,
  Image02Icon,
  ArrowUpDoubleIcon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import type { OrgChartStats, OrgNode } from "./types";

interface OrgChartToolbarProps {
  stats: OrgChartStats | null;
  search: string;
  onSearchChange: (value: string) => void;
  nodes: OrgNode[];
  onExpandAll: () => void;
  onCollapseAll: () => void;
  hasCollapsed: boolean;
}

export function OrgChartToolbar({
  stats,
  search,
  onSearchChange,
  nodes,
  onExpandAll,
  onCollapseAll,
  hasCollapsed,
}: OrgChartToolbarProps) {
  const { fitView } = useReactFlow();

  const handleExportPng = useCallback(async () => {
    const viewportEl = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;
    if (!viewportEl) return;

    try {
      const bounds = getNodesBounds(nodes);
      const imageWidth = 2048;
      const imageHeight = 1536;
      const viewport = getViewportForBounds(
        bounds,
        imageWidth,
        imageHeight,
        0.5,
        2,
      );

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: "#ffffff",
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      const link = document.createElement("a");
      link.download = "organigrama.png";
      link.href = dataUrl;
      link.click();
      toast.success("Organigrama exportado como PNG");
    } catch {
      toast.error("Error al exportar la imagen");
    }
  }, [nodes]);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Organigrama</h1>
        <HelpTooltip text="Visualiza la estructura jerárquica de tu organización. Haz click derecho en un nodo para ver las acciones disponibles." />
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
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar persona..."
            className="h-9 w-56 pl-8"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={hasCollapsed ? onExpandAll : onCollapseAll}
          title={hasCollapsed ? "Expandir todo" : "Colapsar todo"}
        >
          <HugeiconsIcon
            icon={hasCollapsed ? ArrowUpDoubleIcon : ArrowDown01Icon}
            className="size-4"
          />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPng}
          title="Exportar PNG"
        >
          <HugeiconsIcon icon={Image02Icon} className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fitView({ padding: 0.2 })}
          title="Ajustar vista"
        >
          <HugeiconsIcon icon={Maximize01Icon} className="size-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/orgchart-toolbar.tsx
git commit -m "feat(orgchart): add toolbar with search, expand/collapse, and PNG export"
```

---

## Task 10: Create `orgchart-sidebar.tsx`

Collapsible right panel for unassigned persons with drag & drop to canvas.

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/orgchart-sidebar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/org-intelligence/orgchart/orgchart-sidebar.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { PersonAvatar } from "@/components/org-intelligence/person-avatar";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { OrgChartPerson, OrgNode } from "./types";

interface OrgChartSidebarProps {
  unassigned: OrgChartPerson[];
  nodes: OrgNode[];
  onAssigned: () => Promise<void>;
}

export function OrgChartSidebar({
  unassigned,
  nodes,
  onAssigned,
}: OrgChartSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const dragRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const findNearestNode = useCallback(
    (flowX: number, flowY: number): OrgNode | null => {
      let nearest: OrgNode | null = null;
      let minDist = Infinity;

      for (const node of nodes) {
        const dx = node.position.x - flowX;
        const dy = node.position.y - flowY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          nearest = node;
        }
      }

      return nearest;
    },
    [nodes],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, personId: string) => {
      setDraggingId(personId);
      dragRef.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingId) return;
      dragRef.current = { x: e.clientX, y: e.clientY };
    },
    [draggingId],
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!draggingId) return;

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isOverCanvas = el?.closest(".react-flow");

      if (isOverCanvas) {
        const flowPos = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        const nearest = findNearestNode(flowPos.x, flowPos.y);

        if (nearest) {
          const person = unassigned.find((p) => p.id === draggingId);
          try {
            await api.patch(
              `/org-intelligence/persons/${draggingId}/reports-to`,
              { reportsToId: nearest.id },
            );
            toast.success(
              `${person?.name ?? "Persona"} ahora reporta a ${(nearest.data as { name: string }).name}`,
            );
            await onAssigned();
          } catch (err: unknown) {
            const message =
              (err as { message?: string })?.message ??
              "Error al asignar persona";
            toast.error(message);
          }
        }
      }

      setDraggingId(null);
    },
    [draggingId, screenToFlowPosition, findNearestNode, unassigned, onAssigned],
  );

  if (unassigned.length === 0) return null;

  if (collapsed) {
    return (
      <div className="absolute right-4 top-4 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCollapsed(false)}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 rotate-180" />
          Sin asignar
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {unassigned.length}
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="absolute right-0 top-0 z-10 flex h-full w-[280px] flex-col border-l bg-card"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Sin asignar</span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {unassigned.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setCollapsed(true)}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {unassigned.map((person) => (
          <div
            key={person.id}
            className={`flex cursor-grab items-center gap-3 rounded-md border bg-background p-2.5 mb-2 transition-shadow hover:shadow-sm active:cursor-grabbing ${
              draggingId === person.id ? "opacity-50" : ""
            }`}
            onPointerDown={(e) => handlePointerDown(e, person.id)}
          >
            <PersonAvatar
              name={person.name}
              avatarUrl={person.avatarUrl ?? undefined}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{person.name}</p>
              {(person.role || person.position) && (
                <p className="truncate text-xs text-muted-foreground">
                  {person.role || person.position}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Arrastra una persona al organigrama para asignarla
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/orgchart-sidebar.tsx
git commit -m "feat(orgchart): add unassigned persons sidebar with drag-and-drop"
```

---

## Task 11: Enhance `orgchart-node.tsx` with expand/collapse and contextual zoom

Move existing node to new location and add expand/collapse toggle + contextual zoom.

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/orgchart-node.tsx` (new location)
- Delete: `apps/web/components/org-intelligence/orgchart-node.tsx` (old location)

- [ ] **Step 1: Create enhanced node at new location**

```tsx
// apps/web/components/org-intelligence/orgchart/orgchart-node.tsx
"use client";

import { Handle, Position, useStore } from "@xyflow/react";
import { PersonAvatar } from "@/components/org-intelligence/person-avatar";
import type { OrgChartNodeData } from "./types";

const zoomSelector = (s: { transform: [number, number, number] }) =>
  s.transform[2];

interface OrgChartNodeProps {
  id: string;
  data: OrgChartNodeData & {
    isCollapsed?: boolean;
    hiddenCount?: number;
    onToggleExpand?: (nodeId: string) => void;
  };
}

export function OrgChartNode({ id, data }: OrgChartNodeProps) {
  const zoom = useStore(zoomSelector);
  const isZoomedOut = zoom < 0.5;

  if (isZoomedOut) {
    return (
      <div className="group/node relative rounded-lg border bg-card p-2 shadow-sm min-w-[140px] max-w-[160px]">
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/40 !opacity-0 group-hover/node:!opacity-100 !transition-opacity"
        />
        <div className="flex items-center gap-2">
          <PersonAvatar
            name={data.name}
            avatarUrl={data.avatarUrl ?? undefined}
            size="sm"
            className="shrink-0"
          />
          <p className="truncate text-xs font-semibold">{data.name}</p>
        </div>
        {data.hasChildren && (
          <button
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleExpand?.(id);
            }}
          >
            {data.isCollapsed ? `▶ ${data.hiddenCount}` : "▼"}
          </button>
        )}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/40 !opacity-0 group-hover/node:!opacity-100 !transition-opacity"
        />
      </div>
    );
  }

  return (
    <div className="group/node relative rounded-lg border bg-card p-3 shadow-sm min-w-[200px] max-w-[240px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/40 !opacity-0 group-hover/node:!opacity-100 !transition-opacity"
      />
      <div className="flex items-center gap-3">
        <PersonAvatar
          name={data.name}
          avatarUrl={data.avatarUrl ?? undefined}
          size="md"
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {data.name}
          </p>
          {data.role && (
            <p className="truncate text-xs text-muted-foreground leading-tight mt-0.5">
              {data.role}
            </p>
          )}
          {data.department && (
            <p className="truncate text-[11px] text-muted-foreground/70 leading-tight mt-0.5">
              {data.department}
            </p>
          )}
        </div>
      </div>
      {data.hasChildren && (
        <button
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleExpand?.(id);
          }}
        >
          {data.isCollapsed ? `▶ ${data.hiddenCount}` : "▼"}
        </button>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/40 !opacity-0 group-hover/node:!opacity-100 !transition-opacity"
      />
    </div>
  );
}
```

- [ ] **Step 2: Delete old file**

```bash
rm apps/web/components/org-intelligence/orgchart-node.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/orgchart-node.tsx
git add apps/web/components/org-intelligence/orgchart-node.tsx
git commit -m "feat(orgchart): enhance node with expand/collapse and contextual zoom"
```

---

## Task 12: Move `orgchart-edge.tsx` to new location and add highlight support

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/orgchart-edge.tsx` (new location)
- Delete: `apps/web/components/org-intelligence/orgchart-edge.tsx` (old location)

- [ ] **Step 1: Create enhanced edge at new location**

Same content as current edge — it already supports className-based styling. No code changes needed, just move.

```tsx
// apps/web/components/org-intelligence/orgchart/orgchart-edge.tsx
"use client";

import {
  BaseEdge,
  EdgeToolbar,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

export function OrgChartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} />
      {selected && (
        <EdgeToolbar
          edgeId={id}
          x={labelX}
          y={labelY}
          alignY="bottom"
          alignX="center"
          isVisible
        >
          <Button
            variant="destructive"
            size="icon"
            className="h-6 w-6 rounded-full shadow-md"
            onClick={() => deleteElements({ edges: [{ id }] })}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3" />
          </Button>
        </EdgeToolbar>
      )}
    </>
  );
}
```

- [ ] **Step 2: Delete old file**

```bash
rm apps/web/components/org-intelligence/orgchart-edge.tsx
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/orgchart-edge.tsx
git add apps/web/components/org-intelligence/orgchart-edge.tsx
git commit -m "refactor(orgchart): move edge component to orgchart directory"
```

---

## Task 13: Add CSS for highlighted and dimmed edges

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add highlighted and dimmed edge styles**

Add after the existing `.react-flow__edge.orgchart-edge.selected` rule in `globals.css`:

```css
.react-flow__edge.orgchart-edge.highlighted .react-flow__edge-path {
  stroke: var(--primary);
  stroke-width: 2.5;
  transition: stroke 0.15s, stroke-width 0.15s;
}

.react-flow__edge.orgchart-edge.dimmed .react-flow__edge-path {
  opacity: 0.15;
  transition: opacity 0.15s;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(orgchart): add highlighted and dimmed edge CSS"
```

---

## Task 14: Create `orgchart-canvas.tsx` — the main orchestrator

Composes all hooks and components into the main ReactFlow canvas. This is the heart of the refactor.

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/orgchart-canvas.tsx`

- [ ] **Step 1: Create the canvas component**

```tsx
// apps/web/components/org-intelligence/orgchart/orgchart-canvas.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Skeleton } from "@/components/ui/skeleton";
import { EducationalEmptyState } from "@/components/org-intelligence/educational-empty-state";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import { useOrgChart } from "@/hooks/org-intelligence/use-orgchart";
import { useOrgChartActions } from "@/hooks/org-intelligence/use-orgchart-actions";
import { useExpandCollapse } from "@/hooks/org-intelligence/use-expand-collapse";
import { useViewportPersistence } from "@/hooks/org-intelligence/use-viewport-persistence";
import { usePathHighlight } from "@/hooks/org-intelligence/use-path-highlight";
import { OrgChartNode } from "./orgchart-node";
import { OrgChartEdge } from "./orgchart-edge";
import { OrgChartContextMenu } from "./orgchart-context-menu";
import { OrgChartToolbar } from "./orgchart-toolbar";
import { OrgChartSidebar } from "./orgchart-sidebar";
import { AddPersonDialog } from "./add-person-dialog";
import type { ContextMenuState, OrgNode } from "./types";

const nodeTypes = { orgChartNode: OrgChartNode };
const edgeTypes = { orgChartEdge: OrgChartEdge };

export function OrgChartCanvas() {
  const { fitView, screenToFlowPosition } = useReactFlow();

  // Data
  const {
    nodes,
    edges,
    setEdges,
    onNodesChange,
    onEdgesChange,
    stats,
    loading,
    isEmpty,
    unassigned,
    refetchPreservingViewport,
  } = useOrgChart();

  // Actions
  const { onConnect, onEdgesDelete, onReconnect, unlinkPerson, deletePerson } =
    useOrgChartActions({
      nodes,
      edges,
      setEdges,
      refetch: refetchPreservingViewport,
    });

  // Expand/Collapse
  const {
    visibleNodes,
    visibleEdges,
    toggleExpand,
    expandAll,
    collapseAll,
    collapsedIds,
    getHiddenCount,
  } = useExpandCollapse(nodes, edges);

  // Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Path highlight
  const { styledNodes, styledEdges, highlightChain, clearHighlight, isHighlighting } =
    usePathHighlight(visibleNodes, visibleEdges, debouncedSearch);

  // Inject expand/collapse data into node data
  const enrichedNodes = useMemo(
    () =>
      styledNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isCollapsed: collapsedIds.has(node.id),
          hiddenCount: getHiddenCount(node.id),
          onToggleExpand: toggleExpand,
        },
      })),
    [styledNodes, collapsedIds, getHiddenCount, toggleExpand],
  );

  // Viewport persistence
  const { savedViewport, onMoveEnd } = useViewportPersistence();

  // Context menu
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    nodeId: "",
    nodeName: "",
    hasReportsTo: false,
  });

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const data = node.data as { name: string };
      const hasParent = edges.some((e) => e.target === node.id);
      setMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeName: data.name,
        hasReportsTo: hasParent,
      });
    },
    [edges],
  );

  const onPaneClick = useCallback(() => {
    setMenu((m) => ({ ...m, visible: false }));
    if (isHighlighting) clearHighlight();
  }, [isHighlighting, clearHighlight]);

  // Add person dialog
  const [addPersonState, setAddPersonState] = useState<{
    open: boolean;
    reportsToId: string | null;
    reportsToName?: string;
  }>({ open: false, reportsToId: null });

  // onConnectEnd — create person on edge drop
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { isValid: boolean; fromNode: { id: string; data: unknown } | null }) => {
      if (connectionState.isValid || !connectionState.fromNode) return;

      const fromData = connectionState.fromNode.data as { name: string };
      setAddPersonState({
        open: true,
        reportsToId: connectionState.fromNode.id,
        reportsToName: fromData.name,
      });
    },
    [],
  );

  // Edit person (simplified — opens add dialog for now, can be extended)
  const handleEdit = useCallback(
    (personId: string) => {
      const node = nodes.find((n) => n.id === personId);
      if (node) {
        const data = node.data as { name: string };
        // For now navigate to profile — edit dialog can be added later
        window.location.href = `/personas/directorio?id=${personId}`;
      }
    },
    [nodes],
  );

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
          <HelpTooltip text="Visualiza la estructura jerárquica de tu organización. Cada persona aparece como un nodo conectado a su jefatura directa." />
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
          title="Construye el organigrama de tu organización"
          description={
            <>
              <p>
                El organigrama muestra la estructura jerárquica de tu equipo.
                Para empezar, necesitas definir quién reporta a quién.
              </p>
              <p className="mt-2">
                Ve al{" "}
                <a
                  href="/personas/directorio"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Directorio de Personas
                </a>{" "}
                y asigna la relación &ldquo;Reporta a&rdquo; en cada perfil.
              </p>
            </>
          }
          action={{
            label: "Ir al Directorio",
            onClick: () => {
              window.location.href = "/personas/directorio";
            },
          }}
          tip='Tip: Comienza por registrar al líder de la organización (ej: Gerente General). Luego agrega sus reportes directos y asigna la relación "Reporta a".'
        />
        {stats && stats.totalPersons > 0 && (
          <div className="rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Hay {stats.totalPersons} persona
            {stats.totalPersons !== 1 ? "s" : ""} registrada
            {stats.totalPersons !== 1 ? "s" : ""} en el directorio, pero
            ninguna tiene una relación jerárquica definida.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <OrgChartToolbar
        stats={stats}
        search={search}
        onSearchChange={setSearch}
        nodes={enrichedNodes}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        hasCollapsed={collapsedIds.size > 0}
      />

      <div className="relative flex-1 min-h-[500px] rounded-lg border bg-background">
        <ReactFlow
          nodes={enrichedNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onReconnect={onReconnect}
          onConnectEnd={onConnectEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          onMoveEnd={onMoveEnd}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          onInit={() => {
            if (savedViewport) {
              // Use saved viewport if available
              // Delay to let nodes render first
              requestAnimationFrame(() => {
                const { setViewport } = useReactFlow.getState?.() ?? {};
                // fallback: just fitView
              });
            }
            fitView({ padding: 0.2 });
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            className="!bg-background"
          />
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-muted/50 !border-border rounded-lg"
          />
          <Controls className="!bg-card !border-border !rounded-lg !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
        </ReactFlow>

        <OrgChartSidebar
          unassigned={unassigned}
          nodes={enrichedNodes}
          onAssigned={refetchPreservingViewport}
        />
      </div>

      <OrgChartContextMenu
        menu={menu}
        onClose={() => setMenu((m) => ({ ...m, visible: false }))}
        onHighlightChain={highlightChain}
        onAddReport={(reportsToId) => {
          const node = nodes.find((n) => n.id === reportsToId);
          const name = node
            ? (node.data as { name: string }).name
            : undefined;
          setAddPersonState({
            open: true,
            reportsToId,
            reportsToName: name,
          });
        }}
        onUnlink={unlinkPerson}
        onDelete={deletePerson}
        onEdit={handleEdit}
      />

      <AddPersonDialog
        open={addPersonState.open}
        onOpenChange={(open) =>
          setAddPersonState((s) => ({ ...s, open }))
        }
        reportsToId={addPersonState.reportsToId}
        reportsToName={addPersonState.reportsToName}
        onCreated={refetchPreservingViewport}
      />
    </div>
  );
}
```

- [ ] **Step 2: Fix onInit to properly use saved viewport**

The `onInit` handler needs access to `setViewport` from useReactFlow. Since `useReactFlow` is already available at component level, refactor `onInit`:

Replace the `onInit` block inside ReactFlow with:

```tsx
onInit={(instance) => {
  if (savedViewport) {
    instance.setViewport(savedViewport);
  } else {
    instance.fitView({ padding: 0.2 });
  }
}}
```

- [ ] **Step 3: Verify lint passes**

```bash
pnpm lint --filter @zeru/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/orgchart-canvas.tsx
git commit -m "feat(orgchart): create main canvas orchestrator component"
```

---

## Task 15: Rewrite `page.tsx` as slim orchestrator

Replace the current 480-line page with a slim wrapper.

**Files:**
- Modify: `apps/web/app/(dashboard)/personas/organigrama/page.tsx`

- [ ] **Step 1: Replace page.tsx contents**

```tsx
// apps/web/app/(dashboard)/personas/organigrama/page.tsx
"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { OrgChartCanvas } from "@/components/org-intelligence/orgchart/orgchart-canvas";

export default function OrganigramaPage() {
  return (
    <ReactFlowProvider>
      <OrgChartCanvas />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint --filter @zeru/web
```

- [ ] **Step 3: Verify the app loads without errors**

```bash
# Check Next.js devtools for errors
# Navigate to /personas/organigrama in the browser
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/personas/organigrama/page.tsx
git commit -m "refactor(orgchart): slim down page.tsx to orchestrator"
```

---

## Task 16: Create barrel export and clean up old imports

Ensure all imports across the codebase point to the new locations.

**Files:**
- Create: `apps/web/components/org-intelligence/orgchart/index.ts`

- [ ] **Step 1: Create barrel export**

```ts
// apps/web/components/org-intelligence/orgchart/index.ts
export { OrgChartCanvas } from "./orgchart-canvas";
export { OrgChartNode } from "./orgchart-node";
export { OrgChartEdge } from "./orgchart-edge";
export type {
  OrgChartNodeData,
  OrgChartPerson,
  OrgNode,
  OrgEdge,
} from "./types";
```

- [ ] **Step 2: Verify no remaining imports from old paths**

```bash
grep -r "from.*org-intelligence/orgchart-node\|from.*org-intelligence/orgchart-edge" apps/web/ --include="*.tsx" --include="*.ts"
```

Expected: no matches (all imports now go through new locations).

- [ ] **Step 3: Run full lint**

```bash
pnpm lint --filter @zeru/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/org-intelligence/orgchart/index.ts
git commit -m "refactor(orgchart): add barrel export and clean up imports"
```

---

## Task 17: End-to-end verification

- [ ] **Step 1: Run lint**

```bash
pnpm lint --filter @zeru/web
```

- [ ] **Step 2: Check Next.js devtools for errors**

Use `mcp__next-devtools__nextjs_call` with `get_errors` on the running dev server.

- [ ] **Step 3: Manual verification checklist**

Navigate to `/personas/organigrama` and verify:

1. **Basic rendering**: Org chart loads with nodes and edges
2. **Context menu**: Right-click a node → menu appears with all 6 actions
3. **Expand/collapse**: Click chevron below a node with children → children hide, show `▶ N`
4. **Expand/collapse toolbar**: Click expand all / collapse all buttons
5. **Contextual zoom**: Zoom out past 50% → nodes simplify to avatar + name only
6. **Search**: Type a name → matching nodes highlighted, path to root highlighted
7. **Chain of command**: Right-click → "Ver cadena de mando" → path to root highlighted
8. **Download PNG**: Click export button → PNG downloads
9. **Add node on edge drop**: Drag from handle to empty canvas → dialog opens → create person
10. **Reconnect edge**: Drag edge endpoint to different node → hierarchy updates
11. **Sidebar**: Unassigned persons show in right panel → drag to canvas → assigns
12. **Delete edge**: Select edge → trash button → edge deleted
13. **Delete middle node**: Right-click → "Eliminar persona" → children reconnect to parent
14. **Unlink**: Right-click → "Desvincular" → person moves to sidebar
15. **Viewport persistence**: Pan/zoom → refresh page → viewport restored

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(orgchart): complete 11 interactive enhancements

- Context menu with view/edit/chain/add/unlink/delete actions
- Expand/collapse branches with custom hook (no Pro dependency)
- Contextual zoom: simplified nodes when zoomed out
- PNG export via html-to-image
- Add person on edge drop with minimal dialog
- Edge reconnection for hierarchy reassignment
- Drag-and-drop sidebar for unassigned persons
- Delete middle node with automatic child reconnection
- Path highlight on search (nodes + edges to root)
- Chain of command highlight from context menu
- Viewport persistence in localStorage"
```
