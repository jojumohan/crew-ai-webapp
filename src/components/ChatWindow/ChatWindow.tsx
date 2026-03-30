'use client';

import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase-client';
import { useSession } from 'next-auth/react';
import { collection, query, limit, onSnapshot, where } from 'firebase/firestore';
import styles from './ChatWindow.module.css';
import { ChatTarget } from '@/lib/types/chat';

interface ChatWindowProps {
  target: ChatTarget | null;
}

export default function ChatWindow({ target }: ChatWindowProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target || !currentUserId) return;

    // Temporary logic: Phase 3 will revamp query rules entirely.
    const q = target.isChannel 
      ? query(collection(db, 'messages'), where('target_id', '==', target.id), limit(100))
      : query(collection(db, 'messages'), where('conversationId', '==', [currentUserId, target.id].sort().join('_')), limit(100));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({
        ...doc.data(),
        time: doc.data().timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '...',
        _ts: doc.data().timestamp?.toMillis() ?? 0,
      }));
      msgs.sort((a, b) => a._ts - b._ts);
      setMessages(msgs);
      setTimeout(scrollToBottom, 50);
    });

    return unsub;
  }, [target, currentUserId]);

  const scrollToBottom = () => scrollRef.current?.scrollIntoView({ behavior: 'smooth' });

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !target || sending) return;

    const msgText = text;
    setText('');
    setSending(true);

    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          targetId: target.id,
          text: msgText,
          senderName: session?.user?.name || 'User',
          isChannel: target.isChannel
        }),
      });
    } catch (err) {
      console.error("Msg Error:", err);
      setText(msgText); 
    }
    setSending(false);
  }

  if (!target) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyContent}>
           <div className={styles.emptyIcon}>💬</div>
           <h3>Unified Communications Hub</h3>
           <p>Select a channel or team member from the sidebar.<br/>Keep everything synced in one place.</p>
        </div>
      </div>
    );
  }

  const displayName = target.isChannel ? target.name : target.display_name;
  const initial = target.isChannel ? '#' : (displayName?.[0] || '?');
  const status = target.isChannel 
    ? `${target.members?.length || 0} members` 
    : (target.role === 'agent' ? '🤖 AI Agent (Online)' : 'Online');

  return (
    <div className={styles.window}>
      <header className={styles.header}>
        <div className={`${styles.avatar} ${target.isChannel ? styles.channelAvatar : ''}`}>{initial}</div>
        <div className={styles.headerInfo}>
          <div className={styles.headerName}>{displayName}</div>
          <div className={styles.headerStatus}>{status}</div>
        </div>
      </header>

      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div 
            key={i} 
            className={`${styles.msg} ${m.senderId === currentUserId ? styles.own : styles.received}`}
          >
             <div className={styles.bubble}>
               {m.text}
               <div className={styles.time}>{m.time}</div>
             </div>
          </div>
        ))}
        <div ref={scrollRef} style={{ height: 1 }} />
      </div>

      <form className={styles.inputArea} onSubmit={sendMessage}>
        <input 
          placeholder={`Message ${target.isChannel ? '#' : ''}${displayName}`}
          value={text} 
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button type="submit" className={styles.sendBtn} disabled={sending || !text.trim()}>
          {sending ? '...' : (
            <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor">
              <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
