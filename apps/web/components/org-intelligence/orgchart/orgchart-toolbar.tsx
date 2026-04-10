"use client";

import { useCallback } from "react";
import { useReactFlow, getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toPng } from "html-to-image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Maximize01Icon,
  Image02Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
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

const IMAGE_WIDTH = 2048;
const IMAGE_HEIGHT = 1536;

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
    const viewport = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;
    if (!viewport) return;

    const bounds = getNodesBounds(nodes);
    const { x, y, zoom } = getViewportForBounds(
      bounds,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
      0.1,
      2,
      0.1,
    );

    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: "#ffffff",
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: `${IMAGE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        },
      });

      const link = document.createElement("a");
      link.download = "organigrama.png";
      link.href = dataUrl;
      link.click();
    } catch {
      // Export failed silently
    }
  }, [nodes]);

  const handleFitView = useCallback(() => {
    void fitView({ duration: 500, padding: 0.1 });
  }, [fitView]);

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      {/* Left: title + stats */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Organigrama</h1>
        <HelpTooltip
          text="Visualiza la jerarquía de tu organización. Haz clic derecho en un nodo para más opciones."
          side="right"
        />
        {stats && (
          <span className="ml-2 text-xs text-muted-foreground">
            {stats.totalPersons} personas · {stats.departments.length} áreas ·{" "}
            {stats.maxDepth} niveles
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="h-8 w-48 pl-7 text-xs"
            placeholder="Buscar persona..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Expand / collapse toggle */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={hasCollapsed ? onExpandAll : onCollapseAll}
          title={hasCollapsed ? "Expandir todo" : "Colapsar todo"}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          {hasCollapsed ? "Expandir" : "Colapsar"}
        </Button>

        {/* Export PNG */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => void handleExportPng()}
          title="Exportar como PNG"
        >
          <HugeiconsIcon icon={Image02Icon} size={14} />
          Exportar
        </Button>

        {/* Fit view */}
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={handleFitView}
          title="Ajustar vista"
        >
          <HugeiconsIcon icon={Maximize01Icon} size={14} />
        </Button>
      </div>
    </div>
  );
}
