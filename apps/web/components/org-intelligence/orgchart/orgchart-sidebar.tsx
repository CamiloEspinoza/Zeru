"use client";

import { useState, useRef, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/org-intelligence/person-avatar";
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
  const draggingPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const { screenToFlowPosition } = useReactFlow();

  const findNearestNode = useCallback(
    (flowX: number, flowY: number): OrgNode | null => {
      if (nodes.length === 0) return null;

      let nearest: OrgNode | null = null;
      let minDist = Infinity;

      for (const node of nodes) {
        const nx = node.position.x;
        const ny = node.position.y;
        const dist = Math.sqrt((flowX - nx) ** 2 + (flowY - ny) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearest = node;
        }
      }

      // Only snap if within 300px in flow units
      return minDist <= 300 ? nearest : null;
    },
    [nodes],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, personId: string) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingId(personId);
      draggingPos.current = { x: e.clientX, y: e.clientY };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingId) return;
      draggingPos.current = { x: e.clientX, y: e.clientY };
    },
    [draggingId],
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>, personId: string) => {
      if (!draggingId) return;
      setDraggingId(null);

      const { x, y } = draggingPos.current;

      // Check if we're dropping over the react-flow canvas
      const elementBelow = document.elementFromPoint(x, y);
      const reactFlowEl = elementBelow?.closest(".react-flow");
      if (!reactFlowEl) return;

      const flowPos = screenToFlowPosition({ x, y });
      const nearest = findNearestNode(flowPos.x, flowPos.y);

      if (!nearest) {
        toast.error("Acerca más la persona a un nodo del organigrama");
        return;
      }

      try {
        await api.patch(`/org-intelligence/persons/${personId}/reports-to`, {
          reportsToId: nearest.id,
        });
        toast.success("Persona asignada correctamente");
        await onAssigned();
      } catch {
        toast.error("Error al asignar la persona");
      }
    },
    [draggingId, screenToFlowPosition, findNearestNode, onAssigned],
  );

  if (unassigned.length === 0) return null;

  if (collapsed) {
    return (
      <div className="absolute right-3 top-3 z-10">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs shadow-sm"
          onClick={() => setCollapsed(false)}
        >
          Sin asignar ({unassigned.length})
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-0 z-10 flex h-full w-[280px] flex-col border-l border-border bg-card shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Sin asignar</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {unassigned.length}
          </span>
        </div>
        <button
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setCollapsed(true)}
          title="Ocultar panel"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
        </button>
      </div>

      {/* Person list */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {unassigned.map((person) => (
            <div
              key={person.id}
              className={`flex cursor-grab items-center gap-2 rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent active:cursor-grabbing ${
                draggingId === person.id ? "opacity-50" : ""
              }`}
              onPointerDown={(e) => handlePointerDown(e, person.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => void handlePointerUp(e, person.id)}
            >
              <PersonAvatar
                name={person.name}
                avatarUrl={person.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{person.name}</p>
                {(person.role ?? person.position) && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {person.role ?? person.position}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2">
        <p className="text-center text-[11px] text-muted-foreground">
          Arrastra una persona al organigrama para asignarla
        </p>
      </div>
    </div>
  );
}
