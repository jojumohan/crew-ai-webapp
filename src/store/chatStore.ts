import { create } from 'zustand';

export interface Attachment { id: string; url: string; filename: string; mimeType: string; size: number; width?: number; height?: number; }
export interface Message { id: string; conversationId: string; senderId: string; content: string | null; type: string; status: 'SENT' | 'DELIVERED' | 'READ'; createdAt: string; replyToId?: string | null; sender: { id: string; displayName: string; avatarUrl?: string }; attachments: Attachment[]; readReceipts: { userId: string; readAt: string }[]; }
export interface Conversation { id: string; name: string | null | undefined; avatarUrl?: string | null; otherUserId?: string; isGroup: boolean; isOnline: boolean; lastMessageAt?: string | null; lastMessagePreview?: string | null; lastReadAt?: string | null; }

interface ChatState {
  conversations: Conversation[]; activeConversationId: string | null; messages: Record<string, Message[]>;
  setConversations: (c: Conversation[]) => void;
  setActiveConversation: (id: string) => void;
  setMessages: (convId: string, msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  updateMessageStatus: (msgId: string, convId: string, status: 'DELIVERED' | 'READ') => void;
  prependConversation: (conv: Conversation) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [], activeConversationId: null, messages: {},
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (convId, msgs) => set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),
  addMessage: (msg) => set((s) => ({
    messages: { ...s.messages, [msg.conversationId]: [...(s.messages[msg.conversationId] ?? []), msg] },
    conversations: s.conversations.map((c) => c.id === msg.conversationId ? { ...c, lastMessagePreview: msg.content ?? '', lastMessageAt: msg.createdAt } : c)
      .sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()),
  })),
  updateMessageStatus: (msgId, convId, status) => set((s) => ({
    messages: { ...s.messages, [convId]: (s.messages[convId] ?? []).map((m) => m.id === msgId ? { ...m, status } : m) },
  })),
  prependConversation: (conv) => set((s) => ({ conversations: [conv, ...s.conversations.filter((c) => c.id !== conv.id)] })),
}));
