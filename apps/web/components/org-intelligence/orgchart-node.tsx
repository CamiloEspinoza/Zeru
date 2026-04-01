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
    <div className="relative rounded-lg border bg-card p-3 shadow-sm min-w-[200px] max-w-[240px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !w-2 !h-2 !border-0"
      />
      <div className="flex items-center gap-3">
        <PersonAvatar
          name={data.name}
          avatarUrl={data.avatarUrl ?? undefined}
          size="sm"
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
      {data.directReportsCount > 0 && (
        <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary-foreground">
          {data.directReportsCount}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !w-2 !h-2 !border-0"
      />
    </div>
  );
}
