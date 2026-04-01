"use client";

import React, { useEffect, useCallback, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useAudioSync } from "./use-audio-sync";
import { PlayerControls } from "./player-controls";
import { SyncedTranscription } from "./synced-transcription";
import type { SegmentEntity } from "./use-segment-entities";

interface Segment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
}

interface TranscriptionPlayerProps {
  interviewId: string;
  segments: Segment[];
  speakerNameMap: Map<string, string>;
  durationMs: number;
  segmentEntityMap?: Map<number, SegmentEntity[]>;
}

export function TranscriptionPlayer({
  interviewId,
  segments,
  speakerNameMap,
  durationMs,
  segmentEntityMap,
}: TranscriptionPlayerProps) {
  const { audioRef, state, toggle, seekTo, setPlaybackRate, play } =
    useAudioSync();
  const audioUrlRef = useRef<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const ensureAudioLoaded = useCallback(async () => {
    if (audioUrlRef.current || loadingAudio) return;
    setLoadingAudio(true);
    try {
      const res = await api.get<{ url: string | null }>(
        `/org-intelligence/interviews/${interviewId}/audio-url`,
      );
      if (res.url && audioRef.current) {
        audioRef.current.src = res.url;
        audioRef.current.load();
        audioUrlRef.current = res.url;
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAudio(false);
    }
  }, [interviewId, audioRef, loadingAudio]);

  const handleToggle = useCallback(async () => {
    if (!audioUrlRef.current) {
      await ensureAudioLoaded();
      play();
    } else {
      toggle();
    }
  }, [ensureAudioLoaded, play, toggle]);

  // Keyboard shortcuts: Space = toggle, ← = -5s, → = +5s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        handleToggle();
      } else if (e.code === "ArrowLeft") {
        seekTo(Math.max(0, state.currentTimeMs - 5000));
      } else if (e.code === "ArrowRight") {
        seekTo(Math.min(durationMs, state.currentTimeMs + 5000));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleToggle, seekTo, state.currentTimeMs, durationMs]);

  const effectiveDuration =
    state.duration > 0 ? state.duration * 1000 : durationMs;

  return (
    <div className="flex flex-col gap-3">
      <audio ref={audioRef} preload="metadata" />
      <div className="sticky top-0 z-10">
        <PlayerControls
          playing={state.playing}
          currentTimeMs={state.currentTimeMs}
          durationMs={effectiveDuration}
          playbackRate={state.playbackRate}
          onTogglePlay={handleToggle}
          onSeek={(ms) => {
            seekTo(ms);
            if (!state.playing && audioUrlRef.current) play();
          }}
          onPlaybackRateChange={setPlaybackRate}
        />
      </div>
      {loadingAudio && (
        <p className="text-xs text-muted-foreground">Cargando audio...</p>
      )}
      <SyncedTranscription
        segments={segments}
        currentTimeMs={state.currentTimeMs}
        speakerNameMap={speakerNameMap}
        segmentEntityMap={segmentEntityMap}
        onSeekTo={(ms) => {
          seekTo(ms);
          if (!audioUrlRef.current) {
            ensureAudioLoaded().then(() => play());
          } else if (!state.playing) {
            play();
          }
        }}
      />
    </div>
  );
}
