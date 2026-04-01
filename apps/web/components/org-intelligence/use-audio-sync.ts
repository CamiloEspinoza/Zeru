"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export interface AudioSyncState {
  playing: boolean;
  currentTimeMs: number;
  duration: number;
  playbackRate: number;
}

interface UseAudioSyncResult {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  state: AudioSyncState;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (ms: number) => void;
  setPlaybackRate: (rate: number) => void;
}

export function useAudioSync(): UseAudioSyncResult {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const tickRef = useRef<() => void>(() => {});

  const [state, setState] = useState<AudioSyncState>({
    playing: false,
    currentTimeMs: 0,
    duration: 0,
    playbackRate: 1,
  });

  // Keep tickRef stable and avoid self-referencing useCallback
  useEffect(() => {
    tickRef.current = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const now = performance.now();
      if (now - lastUpdateRef.current >= 66) {
        lastUpdateRef.current = now;
        setState((prev) => ({
          ...prev,
          currentTimeMs: Math.round(audio.currentTime * 1000),
          duration: audio.duration || 0,
        }));
      }
      rafRef.current = requestAnimationFrame(tickRef.current);
    };
  });

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
    setState((prev) => ({ ...prev, playing: true }));
    startLoop();
  }, [startLoop]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((prev) => ({ ...prev, playing: false }));
    stopLoop();
  }, [stopLoop]);

  const toggle = useCallback(() => {
    if (audioRef.current?.paused) {
      play();
    } else {
      pause();
    }
  }, [play, pause]);

  const seekTo = useCallback((ms: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = ms / 1000;
    setState((prev) => ({ ...prev, currentTimeMs: ms }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
    setState((prev) => ({ ...prev, playbackRate: rate }));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setState((prev) => ({ ...prev, playing: false }));
      stopLoop();
    };
    const onLoadedMetadata = () => {
      setState((prev) => ({ ...prev, duration: audio.duration || 0 }));
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      stopLoop();
    };
  }, [stopLoop]);

  return { audioRef, state, play, pause, toggle, seekTo, setPlaybackRate };
}
