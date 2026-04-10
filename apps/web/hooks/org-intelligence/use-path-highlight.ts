"use client";
import { useMemo, useState, useCallback } from "react";
import type {
  OrgNode,
  OrgEdge,
  OrgChartNodeData,
} from "@/components/org-intelligence/orgchart/types";

/* ---------- Helpers ---------- */

function getPathToRoot(
  nodeId: string,
  targetToEdge: Map<string, OrgEdge>,
): Set<string> {
  const edgeIds = new Set<string>();
  let current = nodeId;

  while (targetToEdge.has(current)) {
    const edge = targetToEdge.get(current)!;
    edgeIds.add(edge.id);
    current = edge.source;
  }

  return edgeIds;
}

function getNodesOnPath(
  nodeId: string,
  targetToEdge: Map<string, OrgEdge>,
): Set<string> {
  const nodeIds = new Set<string>();
  let current = nodeId;
  nodeIds.add(current);

  while (targetToEdge.has(current)) {
    const edge = targetToEdge.get(current)!;
    current = edge.source;
    nodeIds.add(current);
  }

  return nodeIds;
}

/* ---------- Hook ---------- */

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

  const { styledNodes, styledEdges } = useMemo(() => {
    // Chain-of-command highlight mode
    if (highlightedNodeId !== null) {
      const pathNodeIds = getNodesOnPath(highlightedNodeId, targetToEdge);
      const pathEdgeIds = getPathToRoot(highlightedNodeId, targetToEdge);

      const styledNodes = nodes.map((node) => {
        const onPath = pathNodeIds.has(node.id);
        return {
          ...node,
          style: {
            ...(node.style ?? {}),
            opacity: onPath ? 1 : 0.15,
          },
        };
      });

      const styledEdges = edges.map((edge) => {
        const onPath = pathEdgeIds.has(edge.id);
        return {
          ...edge,
          className: onPath ? "orgchart-edge highlighted" : "orgchart-edge dimmed",
        };
      });

      return { styledNodes, styledEdges };
    }

    // Search mode
    if (search.trim() !== "") {
      const lowerSearch = search.trim().toLowerCase();
      const matchingIds = new Set<string>();

      for (const node of nodes) {
        const data = node.data as OrgChartNodeData;
        const nameMatch = data.name?.toLowerCase().includes(lowerSearch);
        const roleMatch = data.role?.toLowerCase().includes(lowerSearch);
        const deptMatch = data.department?.toLowerCase().includes(lowerSearch);
        if (nameMatch || roleMatch || deptMatch) {
          matchingIds.add(node.id);
        }
      }

      if (matchingIds.size === 0) {
        return { styledNodes: nodes, styledEdges: edges };
      }

      // Collect all path edge IDs from every matching node to root
      const pathEdgeIds = new Set<string>();
      for (const matchId of matchingIds) {
        const edgeIds = getPathToRoot(matchId, targetToEdge);
        for (const id of edgeIds) {
          pathEdgeIds.add(id);
        }
      }

      const styledNodes = nodes.map((node) => {
        const isMatch = matchingIds.has(node.id);
        return {
          ...node,
          style: {
            ...(node.style ?? {}),
            opacity: isMatch ? 1 : 0.25,
          },
        };
      });

      const styledEdges = edges.map((edge) => {
        const onPath = pathEdgeIds.has(edge.id);
        return {
          ...edge,
          className: onPath ? "orgchart-edge highlighted" : "orgchart-edge dimmed",
        };
      });

      return { styledNodes, styledEdges };
    }

    // No highlight — return as-is
    return { styledNodes: nodes, styledEdges: edges };
  }, [nodes, edges, search, highlightedNodeId, targetToEdge]);

  const highlightChain = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId);
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedNodeId(null);
  }, []);

  return {
    styledNodes,
    styledEdges,
    highlightChain,
    clearHighlight,
    isHighlighting: highlightedNodeId !== null,
  };
}
