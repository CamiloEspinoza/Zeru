"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";

type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export function ReconnectionBanner() {
  const socket = useSocket();
  const [status, setStatus] = useState<ConnectionStatus>("connected");

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("disconnected");
    const onReconnectAttempt = () => setStatus("reconnecting");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
    };
  }, [socket]);

  // Derive current status: if socket is null or disconnected while status is
  // "connected", show nothing (initial/pre-connection state is not a problem).
  const effectiveStatus =
    socket === null ? "connected" : status;

  if (effectiveStatus === "connected") return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 text-center text-sm py-1 font-medium",
        effectiveStatus === "disconnected" && "bg-yellow-500 text-yellow-950",
        effectiveStatus === "reconnecting" && "bg-yellow-500 text-yellow-950",
      )}
    >
      {effectiveStatus === "disconnected" && "Conexión perdida. Reconectando..."}
      {effectiveStatus === "reconnecting" && "Reconectando..."}
    </div>
  );
}
