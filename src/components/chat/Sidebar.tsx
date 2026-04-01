'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useChatStore, Conversation } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { disconnectSocket } from '@/lib/socket';
import Avatar from '@/components/ui/Avatar';
import ConversationItem from './ConversationItem';
import NewChatModal from './NewChatModal';

export default function Sidebar() {
  const pathname = usePathname(); const logout = useAuthStore((s) => s.logout); const user = useAuthStore((s) => s.user);
  const conversations = useChatStore((s) => s.conversations); const setConversations = useChatStore((s) => s.setConversations);
  const [search, setSearch] = useState(''); const [showNew, setShowNew] = useState(false);
  useEffect(() => { api.get<Conversation[]>('/api/conversations').then(setConversations).catch(console.error); }, [setConversations]);
  const activeId = pathname.split('/chat/')[1] ?? '';
  const filtered = conversations.filter((c) => !search || c.name?.toLowerCase().includes(search.toLowerCase()));
  function handleLogout() { disconnectSocket(); logout(); }
  return (
    <>
      <aside className="w-[360px] min-w-[280px] flex flex-col bg-wa-panel border-r border-wa-hover">
        <div className="flex items-center justify-between px-4 py-3 bg-wa-teal">
          <Avatar name={user?.displayName} src={user?.avatarUrl} size="sm" />
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNew(true)} title="New chat" className="text-white/80 hover:text-white"><svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg></button>
            <button onClick={handleLogout} title="Log out" className="text-white/80 hover:text-white"><svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg></button>
          </div>
        </div>
        <div className="px-3 py-2"><div className="flex items-center bg-wa-hover rounded-full px-3 gap-2"><svg viewBox="0 0 24 24" className="w-4 h-4 fill-wa-muted flex-shrink-0"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or start new chat" className="flex-1 bg-transparent text-sm text-wa-text placeholder-wa-muted py-2 outline-none" /></div></div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="text-center text-wa-muted text-sm py-10 px-4">{search ? 'No results' : 'No conversations yet.\nClick the chat icon to start one.'}</div>}
          {filtered.map((c) => <ConversationItem key={c.id} convo={c} isActive={c.id === activeId} />)}
        </div>
      </aside>
      {showNew && <NewChatModal onClose={() => setShowNew(false)} />}
    </>
  );
}
