import { create } from "zustand";
import type { PresenceUser } from "@zeru/shared";

interface PresenceState {
  onlineUsers: string[];
  viewUsers: Map<string, PresenceUser[]>;

  setOnlineUsers: (users: string[]) => void;
  setViewUsers: (viewPath: string, users: PresenceUser[]) => void;
  clearViewUsers: (viewPath: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: [],
  viewUsers: new Map(),

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  setViewUsers: (viewPath, users) =>
    set((state) => {
      const next = new Map(state.viewUsers);
      next.set(viewPath, users);
      return { viewUsers: next };
    }),

  clearViewUsers: (viewPath) =>
    set((state) => {
      const next = new Map(state.viewUsers);
      next.delete(viewPath);
      return { viewUsers: next };
    }),
}));
