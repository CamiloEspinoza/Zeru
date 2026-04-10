"use client";

import { useRealtimeStore } from "@/stores/realtime-store";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationList() {
  const { notifications, markNotificationRead, setNotifications, setUnreadCount } =
    useRealtimeStore();

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      markNotificationRead(id);
    } catch {
      // silently ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read", {});
      setNotifications(
        notifications.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-semibold">Notificaciones</span>
        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Marcar todo leído
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Sin notificaciones
          </div>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => !n.isRead && handleMarkRead(n.id)}
                className={cn(
                  "flex cursor-pointer gap-3 px-4 py-3 hover:bg-accent transition-colors",
                  !n.isRead && "bg-accent/40",
                )}
              >
                <div className="mt-1.5 shrink-0">
                  {!n.isRead ? (
                    <span className="block h-2 w-2 rounded-full bg-blue-500" />
                  ) : (
                    <span className="block h-2 w-2 rounded-full bg-transparent" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="line-clamp-2 text-xs text-muted-foreground mt-0.5">
                      {n.body}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
