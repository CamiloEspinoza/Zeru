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

  const animation = useRef({ phraseIdx: 0, charIdx: 0, phase: "typing" as "typing" | "deleting" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function tick() {
      const s = animation.current;
      const total = phraseLength(PHRASES[s.phraseIdx]);

      if (s.phase === "typing") {
        s.charIdx++;
        setRenderState({ phraseIdx: s.phraseIdx, charIdx: s.charIdx });

        if (s.charIdx >= total) {
          timerRef.current = setTimeout(() => {
            s.phase = "deleting";
            timerRef.current = setTimeout(tick, DELETE_SPEED);
          }, PAUSE_AFTER);
        } else {
          timerRef.current = setTimeout(tick, TYPE_SPEED);
        }
      } else {
        s.charIdx--;
        setRenderState({ phraseIdx: s.phraseIdx, charIdx: s.charIdx });

        if (s.charIdx <= 0) {
          s.phraseIdx = (s.phraseIdx + 1) % PHRASES.length;
          s.phase = "typing";
          timerRef.current = setTimeout(tick, TYPE_SPEED);
        } else {
          timerRef.current = setTimeout(tick, DELETE_SPEED);
        }
      }
    }

    timerRef.current = setTimeout(tick, TYPE_SPEED);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <span className="inline-block min-h-[1.1em]">
      {renderVisible(PHRASES[renderState.phraseIdx], renderState.charIdx)}
      <span className="ml-0.5 inline-block w-0.5 h-[0.85em] bg-teal-400 align-middle animate-pulse rounded-sm" />
    </span>
  );
}
