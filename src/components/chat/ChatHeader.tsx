'use client';
import { useRouter } from 'next/navigation';
import { useChatStore, Conversation } from '@/store/chatStore';
import { usePresenceStore } from '@/store/presenceStore';
import Avatar from '@/components/ui/Avatar';

export default function ChatHeader({ conversationId }: { conversationId: string }) {
  const router = useRouter(); const onlineUsers = usePresenceStore((s) => s.onlineUsers); const typingUsers = usePresenceStore((s) => s.typingUsers);
  const convo = useChatStore((s) => s.conversations.find((c) => c.id === conversationId)) as Conversation | undefined;
  if (!convo) return <div className="h-14 bg-wa-teal" />;
  const isOnline = convo.otherUserId ? onlineUsers.has(convo.otherUserId) : false;
  const someoneTyping = typingUsers[conversationId]?.size > 0;
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-wa-teal shadow-sm">
      <button onClick={() => router.push('/chat')} className="md:hidden text-white/80 hover:text-white mr-1"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M20 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg></button>
      <Avatar name={convo.name ?? '?'} src={convo.avatarUrl} size="sm" isOnline={isOnline} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{convo.name ?? 'Unknown'}</p>
        <p className="text-xs text-white/70">{someoneTyping ? 'typing…' : isOnline ? 'online' : 'offline'}</p>
      </div>
    </header>
  );
}
