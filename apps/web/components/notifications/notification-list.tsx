"use client";

import { useRouter } from "next/navigation";
import { useRealtimeStore } from "@/stores/realtime-store";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserAdd01Icon,
  CheckmarkCircle02Icon,
  Comment01Icon,
  AtIcon,
  Clock02Icon,
  AlertCircleIcon,
  UserGroupIcon,
  UserMinus01Icon,
  Chat01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

// ─── Notification type → icon + color mapping ─────────────
const NOTIF_META: Record<string, { icon: IconSvgElement; color: string }> = {
  "task.assigned": { icon: UserAdd01Icon, color: "text-blue-500" },
  "task.unassigned": { icon: UserMinus01Icon, color: "text-orange-500" },
  "task.status_changed": { icon: CheckmarkCircle02Icon, color: "text-yellow-500" },
  "task.completed": { icon: CheckmarkCircle02Icon, color: "text-green-500" },
  "task.comment.created": { icon: Comment01Icon, color: "text-gray-500" },
  "task.mentioned": { icon: AtIcon, color: "text-blue-500" },
  "task.due_soon": { icon: Clock02Icon, color: "text-orange-500" },
  "task.overdue": { icon: AlertCircleIcon, color: "text-red-500" },
  "project.member_added": { icon: UserGroupIcon, color: "text-green-500" },
  "project.member_removed": { icon: UserGroupIcon, color: "text-red-500" },
  "chat.mentioned": { icon: Chat01Icon, color: "text-purple-500" },
};

const DEFAULT_META = { icon: CheckmarkCircle02Icon, color: "text-muted-foreground" };

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

interface NotificationListProps {
  onClose?: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const router = useRouter();
  const { notifications, markNotificationRead, setNotifications, setUnreadCount } =
    useRealtimeStore();

  const handleClick = async (n: (typeof notifications)[number]) => {
    // Mark as read if unread
    if (!n.isRead) {
      try {
        await api.patch(`/notifications/${n.id}/read`, {});
        markNotificationRead(n.id);
      } catch {
        // silently ignore
      }
    }

    // B3/F3: Navigate if the notification has a link
    const link = (n.data as Record<string, unknown>)?.link;
    if (typeof link === "string") {
      onClose?.();
      router.push(link);
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
            {notifications.map((n) => {
              const meta = NOTIF_META[n.type] ?? DEFAULT_META;
              return (
                <li
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "flex cursor-pointer gap-3 px-4 py-3 hover:bg-accent transition-colors",
                    !n.isRead && "bg-accent/40",
                  )}
                >
                  <div className="mt-0.5 shrink-0 flex items-center gap-2">
                    {!n.isRead && (
                      <span className="block h-2 w-2 rounded-full bg-blue-500" />
                    )}
                    <HugeiconsIcon
                      icon={meta.icon}
                      className={cn("h-4 w-4", meta.color)}
                    />
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
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
