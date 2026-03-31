'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { db } from '@/lib/firebase-client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from './MemberActions.module.css';

interface MemberActionsProps {
  userId: string;
  userName: string;
}

export default function MemberActions({ userId, userName }: MemberActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  async function callUser() {
    if (!session?.user?.id || loading) return;
    setLoading(true);
    try {
      const callerName = session.user.name ?? 'Someone';
      // Create call document in Firestore — callee's IncomingCall listener will pick this up
      const callDoc = await addDoc(collection(db, 'calls'), {
        callerId:   session.user.id,
        callerName,
        calleeId:   userId,
        calleeName: userName,
        status:     'ringing',
        createdAt:  serverTimestamp(),
      });

      // Also send a push notification so the ring plays on their device
      fetch('/api/push/ring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      }).catch(() => {});

      // Navigate to the call room
      router.push(`/dashboard/call/${callDoc.id}`);
    } catch {
      setLoading(false);
    }
  }

  function openChat() {
    router.push(`/dashboard/chat?u=${userId}`);
  }

  return (
    <div className={styles.container}>
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
