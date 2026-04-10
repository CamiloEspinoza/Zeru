"use client";

import { useState, useCallback } from "react";
import {
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { api } from "@/lib/api-client";
import type {
  OrgChartPerson,
  OrgChartResponse,
  OrgChartStats,
  OrgChartNodeData,
} from "@/components/org-intelligence/orgchart/types";

/* ---------- Constants ---------- */

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

/* ---------- treeToNodesAndEdges ---------- */

export function treeToNodesAndEdges(
  tree: OrgChartPerson[],
  parentId?: string,
  nodes: Node<OrgChartNodeData>[] = [],
  edges: Edge[] = [],
): { nodes: Node<OrgChartNodeData>[]; edges: Edge[] } {
  for (const person of tree) {
    const hasChildren = Boolean(
      person.directReports?.length || (person.directReportsCount ?? 0) > 0,
    );

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
        hasChildren,
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

/* ---------- layoutWithDagre ---------- */

export function layoutWithDagre(
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

/* ---------- useOrgChart hook ---------- */

export function useOrgChart() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<OrgChartNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [stats, setStats] = useState<OrgChartStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
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
