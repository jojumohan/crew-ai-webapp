'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useChatStore, Conversation } from '@/store/chatStore';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';

interface SearchUser { id: string; displayName: string; email: string; avatarUrl?: string; isOnline: boolean; }

export default function NewChatModal({ onClose }: { onClose: () => void }) {
  const router = useRouter(); const prependConversation = useChatStore((s) => s.prependConversation);
  const [query, setQuery] = useState(''); const [users, setUsers] = useState<SearchUser[]>([]); const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (query.length < 1) { setUsers([]); return; }
    const tid = setTimeout(async () => { setLoading(true); try { setUsers(await api.get<SearchUser[]>(`/api/users/search?q=${encodeURIComponent(query)}`)); } catch { /* ignore */ } finally { setLoading(false); } }, 300);
    return () => clearTimeout(tid);
  }, [query]);
  async function startChat(userId: string) {
    try { const convo = await api.post<Conversation>('/api/conversations/dm', { otherUserId: userId }); prependConversation({ ...convo, isOnline: false }); router.push(`/chat/${convo.id}`); onClose(); } catch { /* ignore */ }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-wa-panel rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 p-4 border-b border-wa-hover">
          <button onClick={onClose} className="text-wa-muted hover:text-wa-text"><svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M20 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg></button>
          <h2 className="font-semibold text-wa-text">New Chat</h2>
        </div>
        <div className="p-4"><input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email…" className="w-full bg-wa-hover rounded-full px-4 py-2.5 text-wa-text placeholder-wa-muted outline-none text-sm" /></div>
        <div className="max-h-72 overflow-y-auto pb-2">
          {loading && <div className="flex justify-center py-6"><Spinner size="sm" /></div>}
          {!loading && users.length === 0 && query.length > 0 && <p className="text-center text-wa-muted text-sm py-6">No users found</p>}
          {users.map((u) => (
            <button key={u.id} onClick={() => startChat(u.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-wa-hover transition-colors text-left">
              <Avatar name={u.displayName} src={u.avatarUrl} size="sm" isOnline={u.isOnline} />
              <div className="min-w-0"><p className="text-wa-text font-medium truncate">{u.displayName}</p><p className="text-wa-muted text-xs truncate">{u.email}</p></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
