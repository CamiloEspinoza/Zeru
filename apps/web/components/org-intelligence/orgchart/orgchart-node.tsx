"use client";

import { Handle, Position, useStore } from "@xyflow/react";
import { PersonAvatar } from "@/components/org-intelligence/person-avatar";
import type { OrgChartNodeData } from "./types";

interface OrgChartNodeProps {
  id: string;
  data: OrgChartNodeData & {
    isCollapsed?: boolean;
    hiddenCount?: number;
    onToggleExpand?: (nodeId: string) => void;
  };
}

export function OrgChartNode({ id, data }: OrgChartNodeProps) {
  const zoom = useStore((s) => s.transform[2]);
  const isZoomedOut = zoom < 0.5;

  return (
    <div
      className={
        isZoomedOut
          ? "group/node relative rounded-lg border bg-card p-2 shadow-sm min-w-[140px] max-w-[180px]"
          : "group/node relative rounded-lg border bg-card p-3 shadow-sm min-w-[200px] max-w-[240px]"
      }
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/40 !opacity-0 group-hover/node:!opacity-100 !transition-opacity"
      />

      {isZoomedOut ? (
        /* Compact layout */
        <div className="flex items-center gap-2">
          <PersonAvatar
            name={data.name}
            avatarUrl={data.avatarUrl ?? undefined}
            size="sm"
            className="shrink-0"
          />
          <p className="truncate text-xs font-semibold leading-tight">
            {data.name}
          </p>
        </div>
      ) : (
        /* Full layout */
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
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/40 !opacity-0 group-hover/node:!opacity-100 !transition-opacity"
      />

      {data.hasChildren && (
        <button
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleExpand?.(id);
          }}
        >
          {data.isCollapsed ? `▶ ${data.hiddenCount ?? ""}` : "▼"}
        </button>
      )}
    </div>
  );
}
