"use client";
import { useState, useMemo, useCallback } from "react";
import { layoutWithDagre } from "./use-orgchart";
import type { OrgNode, OrgEdge } from "@/components/org-intelligence/orgchart/types";

/* ---------- Helpers ---------- */

function getDescendantIds(
  nodeId: string,
  childrenMap: Map<string, string[]>,
): Set<string> {
  const result = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenMap.get(current) ?? [];
    for (const child of children) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }

  return result;
}

function countDescendants(
  nodeId: string,
  childrenMap: Map<string, string[]>,
): number {
  return getDescendantIds(nodeId, childrenMap).size;
}

/* ---------- Hook ---------- */

export function useExpandCollapse(nodes: OrgNode[], edges: OrgEdge[]) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of edges) {
      const existing = map.get(edge.source) ?? [];
      existing.push(edge.target);
      map.set(edge.source, existing);
    }
    return map;
  }, [edges]);

  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const collapsedId of collapsedIds) {
      const descendants = getDescendantIds(collapsedId, childrenMap);
      for (const id of descendants) {
        hidden.add(id);
      }
    }
    return hidden;
  }, [collapsedIds, childrenMap]);

  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (hiddenIds.size === 0) {
      return { visibleNodes: nodes, visibleEdges: edges };
    }

    const filteredNodes = nodes.filter((n) => !hiddenIds.has(n.id));
    const filteredEdges = edges.filter(
      (e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target),
    );

    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutWithDagre(
      filteredNodes,
      filteredEdges,
    );

    return { visibleNodes: layoutedNodes, visibleEdges: layoutedEdges };
  }, [nodes, edges, hiddenIds]);

  const toggleExpand = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    const sources = new Set<string>();
    for (const edge of edges) {
      sources.add(edge.source);
    }
    setCollapsedIds(sources);
  }, [edges]);

  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
  }, []);

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
