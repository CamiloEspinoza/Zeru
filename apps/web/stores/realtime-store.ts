import { create } from "zustand";
import type { Notification, PresenceUser } from "@zeru/shared";

export interface LockInfo {
  user: PresenceUser;
}

interface RealtimeState {
  locks: Map<string, LockInfo>;
  notifications: Notification[];
  unreadNotifications: number;

  setLock: (key: string, info: LockInfo) => void;
  removeLock: (key: string) => void;
  addNotification: (notification: Notification) => void;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  markNotificationRead: (id: string) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  locks: new Map(),
  notifications: [],
  unreadNotifications: 0,

  setLock: (key, info) =>
    set((state) => {
      const next = new Map(state.locks);
      next.set(key, info);
      return { locks: next };
    }),

  removeLock: (key) =>
    set((state) => {
      const next = new Map(state.locks);
      next.delete(key);
      return { locks: next };
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadNotifications: state.unreadNotifications + 1,
    })),

  setNotifications: (notifications) => set({ notifications }),

  setUnreadCount: (count) => set({ unreadNotifications: count }),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id
          ? { ...n, isRead: true, readAt: new Date().toISOString() }
          : n,
      ),
      unreadNotifications: Math.max(0, state.unreadNotifications - 1),
    })),
}));
