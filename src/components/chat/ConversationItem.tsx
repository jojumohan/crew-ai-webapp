'use client';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import { Conversation } from '@/store/chatStore';

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function ConversationItem({ convo, isActive }: { convo: Conversation; isActive: boolean }) {
  return (
    <Link href={`/chat/${convo.id}`}>
      <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-wa-hover' : 'hover:bg-wa-hover/60'}`}>
        <Avatar name={convo.name ?? '?'} src={convo.avatarUrl} isOnline={convo.isOnline} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium text-wa-text truncate">{convo.name ?? 'Unknown'}</span>
            <span className="text-xs text-wa-muted flex-shrink-0 ml-2">{formatTime(convo.lastMessageAt)}</span>
          </div>
          <p className="text-sm text-wa-muted truncate mt-0.5">{convo.lastMessagePreview ?? 'No messages yet'}</p>
        </div>
      </div>
    </Link>
  );
}
