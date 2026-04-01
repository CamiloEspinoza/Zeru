"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { SocketContext } from "@/hooks/use-socket";

const WS_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ?? "http://localhost:3017";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const newSocket = io(WS_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("[WS] Connected:", newSocket.id);
      setSocket(newSocket);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
    });

    newSocket.on("connect_error", (err) => {
      console.error("[WS] Connection error:", err.message);
    });

    // If socket connects before the "connect" event fires (already connected),
    // expose it immediately via a microtask to avoid synchronous setState in effect.
    if (newSocket.connected) {
      Promise.resolve().then(() => setSocket(newSocket));
    }

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
