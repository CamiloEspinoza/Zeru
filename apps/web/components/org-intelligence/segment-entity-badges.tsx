"use client";

import React, { useState } from "react";
import { ENTITY_TYPE_CONFIG } from "./entity-type-badge";
import type { SegmentEntity } from "./use-segment-entities";

interface SegmentEntityBadgesProps {
  entities: SegmentEntity[];
}

const MAX_VISIBLE = 3;

export function SegmentEntityBadges({ entities }: SegmentEntityBadgesProps) {
  const [expanded, setExpanded] = useState(false);

  if (!entities || entities.length === 0) return null;

  const sorted = [...entities].sort((a, b) => b.confidence - a.confidence);
  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;

  return (
    <div
      className="mt-1.5 flex flex-wrap gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((entity) => {
        const config = ENTITY_TYPE_CONFIG[entity.type] ?? {
          color: "text-gray-700 dark:text-gray-300",
          bgColor: "bg-gray-100 dark:bg-gray-900",
        };
        return (
          <span
            key={entity.id}
            title={`${entity.type}: ${entity.name} (${Math.round(entity.confidence * 100)}%)`}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bgColor} ${config.color} ${entity.matchType === "text_match" ? "opacity-75" : ""}`}
          >
            {entity.name}
          </span>
        );
      })}
      {!expanded && overflow > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          +{overflow} más
        </button>
      )}
    </div>
  );
}
