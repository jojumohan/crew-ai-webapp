'use client';

import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase-client'; // Need a client-side Firebase instance
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, where, or, and } from 'firebase/firestore';
import styles from './TeamChat.module.css';

interface TeamChatProps {
  currentUserId: string;
}

export default function TeamChat({ currentUserId }: TeamChatProps) {
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpenChat = (e: any) => setTarget(e.detail);
    window.addEventListener('open-chat', handleOpenChat);
    return () => window.removeEventListener('open-chat', handleOpenChat);
  }, []);

  useEffect(() => {
    if (!target) return;

    // Listen for messages between currentUserId and target.id
    const q = query(
      collection(db, 'messages'),
      where('conversationId', 'in', [
        [currentUserId, target.id].sort().join('_'),
      ]),
      orderBy('timestamp', 'asc'),
      limit(50)
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
    if (!text.trim() || !target) return;

    const msgText = text;
    setText('');

    await addDoc(collection(db, 'messages'), {
      conversationId: [currentUserId, target.id].sort().join('_'),
      senderId: currentUserId,
      text: msgText,
      timestamp: serverTimestamp(),
    });
  }

  if (!target) return null;

  return (
    <div className={`${styles.chatOverlay} glass`}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span>💬</span> {target.name}
        </div>
        <button className={styles.btnClose} onClick={() => setTarget(null)}>✕</button>
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
          placeholder="Message..." 
          value={text} 
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button type="submit">SEND</button>
      </form>
    </div>
  );
}
