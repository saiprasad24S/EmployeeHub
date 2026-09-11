import { create } from 'zustand';

interface ChatState {
  activeConversationId: number | null;
  unreadCount: number;
  isWebSocketConnected: boolean;

  setActiveConversation: (id: number | null) => void;
  setUnreadCount: (count: number) => void;
  setWebSocketConnected: (isConnected: boolean) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  activeConversationId: null,
  unreadCount: 0,
  isWebSocketConnected: false,

  setActiveConversation: (id) => set({ activeConversationId: id }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setWebSocketConnected: (isConnected) => set({ isWebSocketConnected: isConnected }),
}));
