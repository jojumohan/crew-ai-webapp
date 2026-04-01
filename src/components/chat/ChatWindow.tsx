'use client';
import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { usePresenceStore } from '@/store/presenceStore';
import { getSocket } from '@/lib/socket';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import Spinner from '@/components/ui/Spinner';

function DateDivider({ label }: { label: string }) {
  return <div className="flex items-center gap-3 my-4 px-4"><div className="flex-1 h-px bg-wa-hover" /><span className="text-xs text-wa-muted bg-wa-dark px-2 rounded-full">{label}</span><div className="flex-1 h-px bg-wa-hover" /></div>;
}
function formatDateLabel(iso: string): string {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ChatWindow({ conversationId }: { conversationId: string }) {
  const bottomRef = useRef<HTMLDivElement>(null); const userId = useAuthStore((s) => s.user?.id);
  const messages = useChatStore((s) => s.messages[conversationId] ?? []); const someoneTyping = usePresenceStore((s) => (s.typingUsers[conversationId]?.size ?? 0) > 0);
  useEffect(() => { const socket = getSocket(); if (!socket || !conversationId) return; socket.emit('conversation:join', conversationId); return () => { socket.emit('conversation:leave', conversationId); }; }, [conversationId]);
  useEffect(() => { const socket = getSocket(); if (!socket || messages.length === 0) return; const last = messages[messages.length - 1]; if (last.senderId !== userId) socket.emit('message:read', { messageId: last.id, conversationId }); }, [messages, userId, conversationId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, someoneTyping]);
  let lastDate = '';
  return (
    <div className="flex flex-col h-full bg-wa-dark">
      <ChatHeader conversationId={conversationId} />
      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 && <div className="flex justify-center py-10"><Spinner /></div>}
        {messages.map((msg) => { const label = formatDateLabel(msg.createdAt); const show = label !== lastDate; lastDate = label; return <div key={msg.id}>{show && <DateDivider label={label} />}<MessageBubble message={msg} isMine={msg.senderId === userId} /></div>; })}
        {someoneTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
      <MessageInput conversationId={conversationId} />
    </div>
  );
}
