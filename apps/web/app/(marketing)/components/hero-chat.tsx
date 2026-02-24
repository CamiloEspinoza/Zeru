"use client";

import { useEffect, useRef, useState } from "react";

const THINKING_TEXT =
  "Analizando el documento. Identifico capital social de $10.000.000, dos socios al 50%...";

// Total duration of one cycle in ms (enough for all blocks + pause)
const TYPEWRITER_DURATION = THINKING_TEXT.length * 28;
const CYCLE_PAUSE = 3500; // pause at the end before resetting

const STEPS = [
  "user-message",
  "thinking",
  "tool",
  "assistant-response",
  "approval-card",
] as const;

type Step = (typeof STEPS)[number];

function useChatCycle() {
  const [visible, setVisible] = useState<Set<Step>>(new Set());
  const [thinkingText, setThinkingText] = useState("");
  const [thinkingDone, setThinkingDone] = useState(false);
  const [toolDone, setToolDone] = useState(false);
  const cycleRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    function runCycle() {
      if (cancelled) return;
      const id = ++cycleRef.current;

      // Reset state
      setVisible(new Set());
      setThinkingText("");
      setThinkingDone(false);
      setToolDone(false);

      const t = (ms: number, fn: () => void) => {
        const h = setTimeout(() => { if (!cancelled && cycleRef.current === id) fn(); }, ms);
        timers.push(h);
      };

      // 1. User message at 400ms
      t(400, () => setVisible((s) => new Set([...s, "user-message"])));

      // 2. Thinking block + typewriter at 900ms
      t(900, () => {
        setVisible((s) => new Set([...s, "thinking"]));
        let i = 0;
        const iv = setInterval(() => {
          if (cancelled || cycleRef.current !== id) { clearInterval(iv); return; }
          i++;
          setThinkingText(THINKING_TEXT.slice(0, i));
          if (i >= THINKING_TEXT.length) {
            clearInterval(iv);
            if (!cancelled && cycleRef.current === id) setThinkingDone(true);
          }
        }, 28);
        intervals.push(iv);
      });

      // 3. Tool call + spinner → checkmark
      t(TYPEWRITER_DURATION + 1100, () => {
        setVisible((s) => new Set([...s, "tool"]));
        t(1400, () => setToolDone(true));
      });

      // 4. Assistant response
      t(TYPEWRITER_DURATION + 2700, () =>
        setVisible((s) => new Set([...s, "assistant-response"]))
      );

      // 5. Approval card
      t(TYPEWRITER_DURATION + 3500, () =>
        setVisible((s) => new Set([...s, "approval-card"]))
      );

      // 6. Loop: after everything is shown, wait then restart
      t(TYPEWRITER_DURATION + 3500 + CYCLE_PAUSE, runCycle);
    }

    runCycle();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, []);

  return { visible, thinkingText, thinkingDone, toolDone };
}

export function HeroChat() {
  const { visible, thinkingText, thinkingDone, toolDone } = useChatCycle();
  const show = (step: Step) => visible.has(step);

  return (
    <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm p-5 shadow-2xl">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <span className="ml-3 text-xs text-white/20 font-mono">
          Asistente Contable — Zeru
        </span>
      </div>

      {/* Messages */}
      <div className="space-y-3 text-sm min-h-[320px]">

        {/* User message */}
        <div
          className={`flex justify-end transition-all duration-500 ${
            show("user-message") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-teal-500 px-3.5 py-2.5 text-white text-xs leading-relaxed">
            Sube los estatutos de la sociedad que acabo de constituir
          </div>
        </div>

        {/* Thinking block */}
        <div
          className={`rounded-xl border border-white/6 bg-white/[0.02] px-3.5 py-2.5 transition-all duration-500 ${
            show("thinking") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-white/30 mb-1.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Razonando...
          </div>
          <p className="text-xs text-white/25 leading-relaxed min-h-[2rem]">
            {thinkingText}
            {show("thinking") && !thinkingDone && (
              <span className="inline-block w-0.5 h-3 bg-white/25 ml-0.5 animate-pulse rounded-sm" />
            )}
          </p>
        </div>

        {/* Tool call */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-500/5 border border-teal-500/15 text-xs text-teal-400/70 transition-all duration-500 ${
            show("tool") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Creando asiento de constitución...
          <div className="ml-auto">
            {toolDone ? (
              <svg className="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-teal-400/50 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
        </div>

        {/* Assistant response */}
        <div
          className={`rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/6 px-3.5 py-2.5 transition-all duration-500 ${
            show("assistant-response") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <p className="text-xs text-white/60 leading-relaxed">
            Creé el asiento de constitución por{" "}
            <span className="text-teal-400 font-semibold">$10.000.000</span>.
            Capital dividido en partes iguales entre los dos socios.{" "}
            <span className="text-white/40">¿Lo contabilizo?</span>
          </p>
        </div>

        {/* Approval card */}
        <div
          className={`rounded-xl border border-white/8 bg-white/[0.02] p-3 transition-all duration-500 ${
            show("approval-card") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white/60">Asiento #1</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
              Borrador
            </span>
          </div>
          <div className="space-y-1 mb-2.5">
            {[
              { account: "1.1.05 Accionistas x cobrar", debit: "10.000.000", credit: "—" },
              { account: "3.1.01 Capital Social", debit: "—", credit: "10.000.000" },
            ].map((row) => (
              <div key={row.account} className="flex items-center justify-between text-[10px] text-white/40">
                <span className="font-mono truncate max-w-[55%]">{row.account}</span>
                <div className="flex gap-4 shrink-0">
                  <span className={row.debit !== "—" ? "text-teal-400" : ""}>{row.debit}</span>
                  <span className={row.credit !== "—" ? "text-white/60" : ""}>{row.credit}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-1.5 text-[10px] font-semibold bg-teal-500/90 text-white rounded-lg">
            Aprobar y contabilizar
          </button>
        </div>
      </div>
    </div>
  );
}
