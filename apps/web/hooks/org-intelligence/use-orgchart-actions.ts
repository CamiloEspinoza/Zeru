"use client";

import { useCallback } from "react";
import {
  reconnectEdge,
  getIncomers,
  getOutgoers,
  type Connection,
} from "@xyflow/react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type {
  OrgNode,
  OrgEdge,
} from "@/components/org-intelligence/orgchart/types";

interface UseOrgChartActionsArgs {
  nodes: OrgNode[];
  edges: OrgEdge[];
  setEdges: React.Dispatch<React.SetStateAction<OrgEdge[]>>;
  refetch: () => Promise<void>;
}

function reconnectChildrenToParent(
  nodeId: string,
  nodes: OrgNode[],
  edges: OrgEdge[],
): { parentId: string | null; childCount: number } {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return { parentId: null, childCount: 0 };

  const incomers = getIncomers(node, nodes, edges);
  const outgoers = getOutgoers(node, nodes, edges);

  const parentId = incomers.length > 0 ? incomers[0].id : null;

  for (const child of outgoers) {
    void api.patch(`/org-intelligence/persons/${child.id}/reports-to`, {
      reportsToId: parentId ?? null,
    });
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
      if (connection.source === connection.target) {
        toast.error("Una persona no puede reportar a sí misma");
        return;
      }

      try {
        await api.patch(
          `/org-intelligence/persons/${connection.target}/reports-to`,
          { reportsToId: connection.source },
        );
        toast.success("Reporte actualizado");
        await refetch();
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message ?? "Error al conectar nodos";
        toast.error(message);
      }
    },
    [refetch],
  );

  const onEdgesDelete = useCallback(
    async (deletedEdges: OrgEdge[]) => {
      try {
        await Promise.all(
          deletedEdges.map((edge) =>
            api.patch(`/org-intelligence/persons/${edge.target}/reports-to`, {
              reportsToId: null,
            }),
          ),
        );
        await refetch();
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message ??
          "Error al eliminar conexiones";
        toast.error(message);
      }
    },
    [refetch],
  );

  const onReconnect = useCallback(
    (oldEdge: OrgEdge, newConnection: Connection) => {
      setEdges((currentEdges) =>
        reconnectEdge(oldEdge, newConnection, currentEdges),
      );

      void (async () => {
        try {
          await api.patch(
            `/org-intelligence/persons/${newConnection.target}/reports-to`,
            { reportsToId: newConnection.source },
          );
        } catch (err: unknown) {
          const message =
            (err as { message?: string })?.message ??
            "Error al reconectar nodos";
          toast.error(message);
          await refetch();
        }
      })();
    },
    [setEdges, refetch],
  );

  const unlinkPerson = useCallback(
    async (id: string) => {
      try {
        const { childCount } = reconnectChildrenToParent(id, nodes, edges);

        await api.patch(`/org-intelligence/persons/${id}/reports-to`, {
          reportsToId: null,
        });

        if (childCount > 0) {
          toast.success(
            `Persona desvinculada. ${childCount} reporte${childCount !== 1 ? "s" : ""} reasignado${childCount !== 1 ? "s" : ""}.`,
          );
        } else {
          toast.success("Persona desvinculada");
        }

        await refetch();
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message ?? "Error al desvincular";
        toast.error(message);
      }
    },
    [nodes, edges, refetch],
  );

  const deletePerson = useCallback(
    async (id: string) => {
      try {
        const { childCount } = reconnectChildrenToParent(id, nodes, edges);

        await api.delete(`/org-intelligence/persons/${id}`);

        if (childCount > 0) {
          toast.success(
            `Persona eliminada. ${childCount} reporte${childCount !== 1 ? "s" : ""} reasignado${childCount !== 1 ? "s" : ""}.`,
          );
        } else {
          toast.success("Persona eliminada");
        }

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
