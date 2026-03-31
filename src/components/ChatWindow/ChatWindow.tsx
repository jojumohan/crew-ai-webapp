'use client';

import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase-client';
import { useSession } from 'next-auth/react';
import { collection, query, limit, onSnapshot, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import styles from './ChatWindow.module.css';
import { ChatTarget } from '@/lib/types/chat';
import { 
  PhoneIcon, 
  VideoIcon, 
  DotsIcon, 
  SmileyIcon, 
  ClipIcon, 
  SendIcon,
  SeenIcon
} from '@/features/messaging/InterfaceIcons';

interface ChatWindowProps {
  target: ChatTarget | null;
}

export default function ChatWindow({ target }: ChatWindowProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const currentUserId = session?.user?.id ?? '';
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target || !currentUserId) return;

    const q = target.isChannel 
      ? query(collection(db, 'messages'), where('target_id', '==', target.id), limit(100))
      : query(collection(db, 'messages'), where('conversationId', '==', [currentUserId, target.id].sort().join('_')), limit(100));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        time: doc.data().timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '...',
        _ts: doc.data().timestamp?.toMillis() ?? Date.now(),
      }));
      msgs.sort((a, b) => a._ts - b._ts);
      setMessages(msgs);
      setTimeout(scrollToBottom, 50);
    });

    return unsub;
  }, [target, currentUserId]);

  const scrollToBottom = () => scrollRef.current?.scrollIntoView({ behavior: 'smooth' });

  async function startCall(type: 'voice' | 'video' = 'voice') {
    if (!target || !currentUserId || calling) return;
    setCalling(true);
    try {
       const callerName = session?.user?.name ?? 'Someone';
       const callDoc = await addDoc(collection(db, 'calls'), {
         callerId: currentUserId,
         callerName,
         calleeId: target.id,
         calleeName: target.isChannel ? target.name : target.display_name,
         status: 'ringing',
         type,
         createdAt: serverTimestamp(),
       });

       fetch('/api/push/ring', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ targetUserId: target.id }),
       }).catch(() => {});

       router.push(`/dashboard/call/${callDoc.id}`);
    } catch (err) {
       console.error("Call Error:", err);
       setCalling(false);
    }
  }

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
           <div className={styles.emptyIcon}>
             <svg viewBox="0 0 24 24" width="200" height="200" fill="currentColor" style={{ opacity: 0.1 }}>
               <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm1-13h-2v6h6v-2h-4V7z"/>
             </svg>
           </div>
           <h3>Unified Communications Hub</h3>
           <p>Send and receive messages without keeping your phone online.<br/>Use Aronlabz Teams on up to 4 linked devices and 1 phone at the same time.</p>
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
        <div className={styles.headerActions}>
          {!target.isChannel && (
            <>
              <div className={styles.actionIcon} onClick={() => startCall('video')} title="Video Call">
                <VideoIcon className="w-6 h-6" />
              </div>
              <div className={styles.actionIcon} onClick={() => startCall('voice')} title="Voice Call">
                <PhoneIcon className="w-6 h-6" />
              </div>
            </>
          )}
          <div className={styles.actionIcon} title="Menu">
            <DotsIcon className="w-6 h-6" />
          </div>
        </div>
      </header>

      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div 
            key={m.id || i} 
            className={`${styles.msg} ${m.senderId === currentUserId ? styles.own : styles.received}`}
          >
             <div className={styles.bubble}>
               {m.text}
               <div className={styles.bubbleMeta}>
                 <span className={styles.time}>{m.time}</span>
                 {m.senderId === currentUserId && (
                   <span className={styles.seen}>
                     <SeenIcon />
                   </span>
                 )}
               </div>
             </div>
          </div>
        ))}
        <div ref={scrollRef} style={{ height: 1 }} />
      </div>

      <form className={styles.inputArea} onSubmit={sendMessage}>
        <div className={styles.actionIcon} title="Emoji">
          <SmileyIcon className="w-6 h-6" />
        </div>
        <div className={styles.actionIcon} title="Attach">
          <ClipIcon className="w-6 h-6" />
        </div>
        <div className={styles.inputWrapper}>
          <input 
            placeholder="Type a message"
            value={text} 
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </div>
        <button type="submit" className={styles.sendBtn} disabled={sending || !text.trim()}>
          {sending ? '...' : <SendIcon className="w-6 h-6" />}
        </button>
      </form>
    </div>
  );
}
