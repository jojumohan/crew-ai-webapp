'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './MemberActions.module.css';

interface MemberActionsProps {
  userId: string;
  userName: string;
}

export default function MemberActions({ userId, userName }: MemberActionsProps) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();

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
     router.push(`/dashboard/chat?u=${userId}`);
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
