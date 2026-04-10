"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api-client";

interface AudioClipPlayerProps {
  interviewId: string;
  startMs: number;
  endMs: number;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function AudioClipPlayer({
  interviewId,
  startMs,
  endMs,
}: AudioClipPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(startMs / 1000);

  const startSec = startMs / 1000;
  const endSec = endMs / 1000;

  const handlePlay = async () => {
    if (!audioUrl) {
      setLoading(true);
      try {
        const res = await api.get<{ url: string | null }>(
          `/org-intelligence/interviews/${interviewId}/audio-url`,
        );
        if (!res.url) return;
        setAudioUrl(res.url);
        // give the state a tick to update before playing
        setTimeout(() => playFromStart(res.url!), 50);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
      return;
    }
    playFromStart(audioUrl);
  };

  const playFromStart = (url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    // Use media fragment to hint the browser about the time range.
    // This helps with MP3s that have incorrect duration headers (e.g.
    // streaming-generated files missing the Xing/LAME header).
    const fragUrl = `${url}#t=${startSec},${endSec}`;
    const needsLoad = !audio.src || !audio.src.startsWith(url);
    if (needsLoad) {
      audio.src = fragUrl;
      audio.onloadedmetadata = () => {
        audio.currentTime = startSec;
        audio.play().then(() => setPlaying(true)).catch(() => {});
        audio.onloadedmetadata = null;
      };
      audio.load();
    } else {
      audio.currentTime = startSec;
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const handlePause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (audio.currentTime >= endSec) {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={playing ? handlePause : handlePlay}
        disabled={loading}
        className="flex h-7 w-7 items-center justify-center rounded-full border bg-background text-xs transition-colors hover:bg-muted disabled:opacity-50"
        aria-label={playing ? "Pausar" : "Reproducir fragmento"}
      >
        {loading ? "..." : playing ? "||" : "\u25B6"}
      </button>
      <span className="font-mono text-xs text-muted-foreground">
        {formatSeconds(currentTime)} / {formatSeconds(endSec)}
      </span>
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={() => setPlaying(false)} />
    </div>
  );
}
