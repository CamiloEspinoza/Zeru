"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface AudioRecorderState {
  status: "idle" | "recording" | "paused" | "stopped";
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  error: string | null;
  level: number;
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    status: "idle", duration: 0, audioBlob: null, audioUrl: null,
    devices: [], selectedDeviceId: null, error: null, level: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const urlRef = useRef<string | null>(null);

  const stopLevel = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    setState((p) => ({ ...p, level: 0 }));
  }, []);

  const startLevel = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setState((p) => ({ ...p, level: Math.min(avg / 128, 1) }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    setState((p) => ({ ...p, devices: all.filter((d) => d.kind === "audioinput") }));
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    setState((p) => ({ ...p, selectedDeviceId: deviceId }));
  }, []);

  const start = useCallback(async (deviceId?: string) => {
    try {
      const id = deviceId ?? state.selectedDeviceId ?? undefined;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: id, echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
      startLevel(stream);
      intervalRef.current = setInterval(() => setState((p) => ({ ...p, duration: p.duration + 1 })), 1000);
      setState((p) => ({ ...p, status: "recording", error: null, duration: 0, audioBlob: null, audioUrl: null }));
      await refreshDevices();
    } catch (err) {
      setState((p) => ({ ...p, error: String(err) }));
    }
  }, [state.selectedDeviceId, startLevel, refreshDevices]);

  const pause = useCallback(() => {
    mediaRecorderRef.current?.pause();
    clearInterval(intervalRef.current!);
    stopLevel();
    setState((p) => ({ ...p, status: "paused" }));
  }, [stopLevel]);

  const resume = useCallback(() => {
    mediaRecorderRef.current?.resume();
    if (streamRef.current) startLevel(streamRef.current);
    intervalRef.current = setInterval(() => setState((p) => ({ ...p, duration: p.duration + 1 })), 1000);
    setState((p) => ({ ...p, status: "recording" }));
  }, [startLevel]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setState((p) => ({ ...p, audioBlob: blob, audioUrl: url, status: "stopped" }));
    };
    recorder.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearInterval(intervalRef.current!);
    stopLevel();
  }, [stopLevel]);

  const reset = useCallback(() => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setState({ status: "idle", duration: 0, audioBlob: null, audioUrl: null, devices: state.devices, selectedDeviceId: state.selectedDeviceId, error: null, level: 0 });
  }, [state.devices, state.selectedDeviceId]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(intervalRef.current!);
      stopLevel();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [stopLevel]);

  return { state, start, pause, resume, stop, reset, selectDevice, refreshDevices };
}
