import { create } from 'zustand';

interface PresenceState {
  onlineUsers: Set<string>; typingUsers: Record<string, Set<string>>;
  setOnline: (userId: string) => void; setOffline: (userId: string) => void;
  setTyping: (convId: string, userId: string) => void; clearTyping: (convId: string, userId: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: new Set(), typingUsers: {},
  setOnline: (userId) => set((s) => ({ onlineUsers: new Set([...s.onlineUsers, userId]) })),
  setOffline: (userId) => set((s) => { const n = new Set(s.onlineUsers); n.delete(userId); return { onlineUsers: n }; }),
  setTyping: (convId, userId) => set((s) => ({ typingUsers: { ...s.typingUsers, [convId]: new Set([...(s.typingUsers[convId] ?? []), userId]) } })),
  clearTyping: (convId, userId) => set((s) => { const n = new Set(s.typingUsers[convId] ?? []); n.delete(userId); return { typingUsers: { ...s.typingUsers, [convId]: n } }; }),
}));
