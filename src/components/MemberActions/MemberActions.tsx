'use client';

import { useState } from 'react';
import styles from './MemberActions.module.css';

interface MemberActionsProps {
  userId: string;
  userName: string;
}

export default function MemberActions({ userId, userName }: MemberActionsProps) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function callUser() {
    setLoading(true);
    setMsg('Calling...');
    try {
      const res = await fetch('/api/push/ring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetUserId: userId,
          body: `Direct contact request from teammate.`
        }),
      });
      const data = await res.json();
      setMsg(data.ok ? 'Sent!' : 'Failed');
    } catch {
      setMsg('Error');
    }
    setLoading(false);
    setTimeout(() => setMsg(''), 3000);
  }

  function openChat() {
    // For now, toggle a global chat event or just alert
    window.dispatchEvent(new CustomEvent('open-chat', { detail: { userId, userName } }));
  }

  return (
    <div className={styles.container}>
      {msg && <span className={styles.toast}>{msg}</span>}
      <button 
        className={styles.btn} 
        onClick={callUser} 
        disabled={loading} 
        title={`Call ${userName}`}
      >
        📞
      </button>
      <button 
        className={styles.btn} 
        onClick={openChat} 
        title={`Chat with ${userName}`}
      >
        💬
      </button>
    </div>
  );
}
