"use client";

import { Handle, Position } from "@xyflow/react";
import { PersonAvatar } from "./person-avatar";

export interface OrgChartNodeData {
  name: string;
  role?: string;
  department?: string;
  avatarUrl?: string | null;
  directReportsCount: number;
  status: string;
  [key: string]: unknown;
}

export function OrgChartNode({ data }: { data: OrgChartNodeData }) {
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
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !border-card !bg-muted-foreground/40 !opacity-0 group-hover/node:!opacity-100 !transition-opacity"
      />
    </div>
  );
}
