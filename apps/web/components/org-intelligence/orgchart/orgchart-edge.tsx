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
