"use client";

import { useEffect, useRef, useState } from "react";

// Each phrase is an array of segments — white=true means highlighted (bright white)
interface Segment {
  text: string;
  white?: boolean;
}

const PHRASES: Segment[][] = [
  [
    { text: "Contabilidad " },
    { text: "automatizada", white: true },
    { text: " con inteligencia artificial" },
  ],
  [
    { text: "Asientos contables " },
    { text: "creados en conversación", white: true },
  ],
  [
    { text: "Documentos que " },
    { text: "se contabilizan solos", white: true },
  ],
  [
    { text: "Tu contador " },
    { text: "siempre disponible", white: true },
    { text: ", siempre razonando" },
  ],
  [
    { text: "Gestión empresarial " },
    { text: "construida sobre agentes de IA", white: true },
  ],
  [
    { text: "De un PDF a " },
    { text: "un asiento contable", white: true },
    { text: " en segundos" },
  ],
  [
    { text: "Remuneraciones, facturas y más — " },
    { text: "sin formularios", white: true },
  ],
];

const TYPE_SPEED = 38;
const DELETE_SPEED = 18;
const PAUSE_AFTER = 2600;

// Flatten a phrase to a single string (for character counting)
function phraseLength(phrase: Segment[]) {
  return phrase.reduce((acc, s) => acc + s.text.length, 0);
}

// Render visible characters of a phrase respecting segment colors
function renderVisible(phrase: Segment[], charIdx: number) {
  let remaining = charIdx;
  return phrase.map((seg, i) => {
    if (remaining <= 0) return null;
    const visible = seg.text.slice(0, remaining);
    remaining -= seg.text.length;
    return (
      <span key={i} className={seg.white ? "text-white" : "text-teal-400/70"}>
        {visible}
      </span>
    );
  });
}

export function HeroTypewriter() {
  const [renderState, setRenderState] = useState({ phraseIdx: 0, charIdx: 0 });

  const animation = useRef({
    phraseIdx: 0,
    charIdx: 0,
    phase: "typing" as "typing" | "deleting",
    pauseUntil: 0,
    lastTick: 0,
  });

  useEffect(() => {
    let rafId: number;

    function loop(now: number) {
      const s = animation.current;

      // Handle pause between typing and deleting
      if (s.pauseUntil > 0) {
        if (now < s.pauseUntil) {
          rafId = requestAnimationFrame(loop);
          return;
        }
        s.pauseUntil = 0;
      }

      const speed = s.phase === "typing" ? TYPE_SPEED : DELETE_SPEED;

      if (now - s.lastTick < speed) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      s.lastTick = now;
      const total = phraseLength(PHRASES[s.phraseIdx]);

      if (s.phase === "typing") {
        s.charIdx++;
        setRenderState({ phraseIdx: s.phraseIdx, charIdx: s.charIdx });

        if (s.charIdx >= total) {
          s.phase = "deleting";
          s.pauseUntil = now + PAUSE_AFTER;
        }
      } else {
        s.charIdx--;
        setRenderState({ phraseIdx: s.phraseIdx, charIdx: s.charIdx });

        if (s.charIdx <= 0) {
          s.phraseIdx = (s.phraseIdx + 1) % PHRASES.length;
          s.phase = "typing";
        }
      }

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <span className="grid">
      {/* Invisible sizers – every phrase occupies the same grid cell so the
          tallest one determines the container height, preventing layout shift
          when phrases of different lengths rotate. */}
      {PHRASES.map((phrase, idx) => (
        <span
          key={idx}
          className="col-start-1 row-start-1 invisible pointer-events-none"
          aria-hidden="true"
        >
          {phrase.map((seg, j) => (
            <span key={j}>{seg.text}</span>
          ))}
          {/* Account for cursor width in sizing */}
          <span className="ml-0.5 inline-block w-0.5" />
        </span>
      ))}
      {/* Visible animated text */}
      <span className="col-start-1 row-start-1">
        {renderVisible(PHRASES[renderState.phraseIdx], renderState.charIdx)}
        <span className="ml-0.5 inline-block w-0.5 h-[0.85em] bg-teal-400 align-middle animate-pulse rounded-sm" />
      </span>
    </span>
  );
}
