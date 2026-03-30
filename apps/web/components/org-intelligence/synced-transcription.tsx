"use client";

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { SyncedSegment } from "./synced-segment";

interface Segment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
}

interface SyncedTranscriptionProps {
  segments: Segment[];
  currentTimeMs: number;
  speakerNameMap: Map<string, string>;
  onSeekTo: (ms: number) => void;
}

function findActiveIndex(segments: Segment[], currentTimeMs: number): number {
  if (segments.length === 0) return -1;
  let lo = 0;
  let hi = segments.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].startMs <= currentTimeMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

export function SyncedTranscription({
  segments,
  currentTimeMs,
  speakerNameMap,
  onSeekTo,
}: SyncedTranscriptionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastScrolledIndexRef = useRef<number>(-1);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeIndex = useMemo(
    () => findActiveIndex(segments, currentTimeMs),
    [segments, currentTimeMs],
  );

  const scheduleScroll = useCallback(
    (index: number) => {
      if (index === lastScrolledIndexRef.current) return;
      if (scrollThrottleRef.current) return;
      scrollThrottleRef.current = setTimeout(() => {
        scrollThrottleRef.current = null;
        const el = segmentRefs.current[index];
        if (!el || !containerRef.current) return;
        lastScrolledIndexRef.current = index;
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 300);
    },
    [],
  );

  useEffect(() => {
    if (activeIndex >= 0) scheduleScroll(activeIndex);
  }, [activeIndex, scheduleScroll]);

  return (
    <div ref={containerRef} className="max-h-[560px] space-y-1 overflow-y-auto pr-1">
      {segments.map((seg, i) => (
        <div key={i} ref={(el) => { segmentRefs.current[i] = el; }}>
          <SyncedSegment
            speaker={seg.speaker}
            speakerName={speakerNameMap.get(seg.speaker)}
            text={seg.text}
            startMs={seg.startMs}
            endMs={seg.endMs}
            isActive={i === activeIndex}
            onClick={() => onSeekTo(seg.startMs)}
          />
        </div>
      ))}
    </div>
  );
}
