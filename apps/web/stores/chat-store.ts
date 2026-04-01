import { create } from "zustand";
import type { Channel, ChatMessage } from "@zeru/shared";

interface ChatState {
  channels: Channel[];
  activeChannelId: string | null;
  messages: Map<string, ChatMessage[]>;
  typingUsers: Map<string, Map<string, string>>;
  unreadCounts: Map<string, number>;

  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string | null) => void;
  addMessage: (channelId: string, message: ChatMessage) => void;
  setMessages: (channelId: string, messages: ChatMessage[]) => void;
  prependMessages: (channelId: string, messages: ChatMessage[]) => void;
  updateMessage: (channelId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setTyping: (channelId: string, userId: string, userName: string) => void;
  clearTyping: (channelId: string, userId: string) => void;
  setUnread: (channelId: string, count: number) => void;
  decrementUnread: (channelId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  channels: [],
  activeChannelId: null,
  messages: new Map(),
  typingUsers: new Map(),
  unreadCounts: new Map(),

  setChannels: (channels) => set({ channels }),

  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  addMessage: (channelId, message) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(channelId) ?? [];
      next.set(channelId, [...existing, message]);
      return { messages: next };
    }),

  setMessages: (channelId, messages) =>
    set((state) => {
      const next = new Map(state.messages);
      next.set(channelId, messages);
      return { messages: next };
    }),

  prependMessages: (channelId, messages) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(channelId) ?? [];
      next.set(channelId, [...messages, ...existing]);
      return { messages: next };
    }),

  updateMessage: (channelId, messageId, patch) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(channelId);
      if (!existing) return {};
      next.set(
        channelId,
        existing.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      );
      return { messages: next };
    }),

  removeMessage: (channelId, messageId) =>
    set((state) => {
      const next = new Map(state.messages);
      const existing = next.get(channelId);
      if (!existing) return {};
      next.set(
        channelId,
        existing.filter((m) => m.id !== messageId),
      );
      return { messages: next };
    }),

  setTyping: (channelId, userId, userName) =>
    set((state) => {
      const nextTyping = new Map(state.typingUsers);
      const channelMap = new Map(nextTyping.get(channelId) ?? []);
      channelMap.set(userId, userName);
      nextTyping.set(channelId, channelMap);
      return { typingUsers: nextTyping };
    }),

  clearTyping: (channelId, userId) =>
    set((state) => {
      const nextTyping = new Map(state.typingUsers);
      const channelMap = new Map(nextTyping.get(channelId) ?? []);
      channelMap.delete(userId);
      nextTyping.set(channelId, channelMap);
      return { typingUsers: nextTyping };
    }),

  setUnread: (channelId, count) =>
    set((state) => {
      const next = new Map(state.unreadCounts);
      next.set(channelId, count);
      return { unreadCounts: next };
    }),

  decrementUnread: (channelId) =>
    set((state) => {
      const next = new Map(state.unreadCounts);
      const current = next.get(channelId) ?? 0;
      next.set(channelId, Math.max(0, current - 1));
      return { unreadCounts: next };
    }),
}));
