'use client';
import { useEffect } from 'react';
import { initSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useChatStore, Message } from '@/store/chatStore';
import { usePresenceStore } from '@/store/presenceStore';

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessageStatus = useChatStore((s) => s.updateMessageStatus);
  const setOnline = usePresenceStore((s) => s.setOnline);
  const setOffline = usePresenceStore((s) => s.setOffline);
  const setTyping = usePresenceStore((s) => s.setTyping);
  const clearTyping = usePresenceStore((s) => s.clearTyping);

  useEffect(() => {
    if (!token) return;
    const socket = initSocket(token);
    const onMessage = (msg: Message) => {
      addMessage(msg);
      if (msg.senderId !== userId) socket.emit('message:delivered', { messageId: msg.id, conversationId: msg.conversationId });
    };
    socket.on('message:new', onMessage);
    socket.on('message:delivered', ({ messageId, conversationId }: { messageId: string; conversationId: string }) => updateMessageStatus(messageId, conversationId, 'DELIVERED'));
    socket.on('message:read',      ({ messageId, conversationId }: { messageId: string; conversationId: string }) => updateMessageStatus(messageId, conversationId, 'READ'));
    socket.on('user:online',       ({ userId: uid }: { userId: string }) => setOnline(uid));
    socket.on('user:offline',      ({ userId: uid }: { userId: string }) => setOffline(uid));
    socket.on('user:typing',       ({ userId: uid, conversationId }: { userId: string; conversationId: string }) => setTyping(conversationId, uid));
    socket.on('user:stop-typing',  ({ userId: uid, conversationId }: { userId: string; conversationId: string }) => clearTyping(conversationId, uid));
    const heartbeat = setInterval(() => socket.emit('heartbeat'), 20_000);
    return () => {
      socket.off('message:new', onMessage); socket.off('message:delivered'); socket.off('message:read');
      socket.off('user:online'); socket.off('user:offline'); socket.off('user:typing'); socket.off('user:stop-typing');
      clearInterval(heartbeat);
    };
  }, [token, userId, addMessage, updateMessageStatus, setOnline, setOffline, setTyping, clearTyping]);
}
