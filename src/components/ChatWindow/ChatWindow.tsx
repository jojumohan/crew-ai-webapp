'use client';

import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase-client';
import { useSession } from 'next-auth/react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import styles from './ChatWindow.module.css';

interface ChatWindowProps {
  target: any;
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

    // Real-time listener between currentUserId and target.id
    const conversationId = [currentUserId, target.id].sort().join('_');
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => doc.data()));
      setTimeout(scrollToBottom, 100);
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

    // Call the API which saves and handles bot replies
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          targetId: target.id,
          text: msgText,
        }),
      });
    } catch {
      setText(msgText); // Restore if error
    }
    setSending(false);
  }

  if (!target) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyContent}>
           <span>🏢</span>
           <h3>Aronlabz Workspace Chat</h3>
           <p>Select a team member or AI Agent to start messaging.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.window}>
      <div className={styles.header}>
        <div className={styles.avatar}>{target.display_name[0]}</div>
        <h3>{target.display_name}</h3>
        {target.role === 'agent' && <span className={styles.aiBadge}>AI Agent</span>}
      </div>

      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.msg} ${m.senderId === currentUserId ? styles.own : ''}`}>
             <div className={styles.bubble}>{m.text}</div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form className={styles.inputArea} onSubmit={sendMessage}>
        <input 
          placeholder={`Message ${target.display_name.split(' ')[0]}...`}
          value={text} 
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={sending}>
          {sending ? '...' : 'SEND'}
        </button>
      </form>
    </div>
  );
}
