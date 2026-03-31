'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase-client';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import styles from './IncomingCall.module.css';

interface ActiveCall {
  callId: string;
  callerName: string;
}

export default function IncomingCall() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const ringRef = useRef<HTMLAudioElement | null>(null);
  const myId = (session?.user as any)?.id ?? '';

  // Listen for incoming calls addressed to me
  useEffect(() => {
    if (!myId) return;

    const q = query(collection(db, 'calls'), where('calleeId', '==', myId));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((ch) => {
        const data = ch.doc.data();
        if (ch.type === 'added' && data.status === 'ringing') {
          setActiveCall({ callId: ch.doc.id, callerName: data.callerName });
          if (!ringRef.current) {
            const a = new Audio('/ring.mp3');
            a.loop = true;
            a.play().catch(() => {});
            ringRef.current = a;
          }
        }
        if (ch.type === 'modified' && data.status !== 'ringing') {
          // Caller hung up or call ended before we responded
          setActiveCall((cur) => cur?.callId === ch.doc.id ? null : cur);
          ringRef.current?.pause();
          ringRef.current = null;
        }
        if (ch.type === 'removed') {
          setActiveCall((cur) => cur?.callId === ch.doc.id ? null : cur);
          ringRef.current?.pause();
          ringRef.current = null;
        }
      });
    });

    return () => unsub();
  }, [myId]);

  function stopRing() {
    ringRef.current?.pause();
    ringRef.current = null;
  }

  async function accept() {
    if (!activeCall) return;
    stopRing();
    await updateDoc(doc(db, 'calls', activeCall.callId), {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    });
    setActiveCall(null);
    router.push(`/dashboard/call/${activeCall.callId}`);
  }

  async function decline() {
    if (!activeCall) return;
    stopRing();
    await updateDoc(doc(db, 'calls', activeCall.callId), { status: 'declined' });
    setActiveCall(null);
  }

  if (!activeCall) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.avatar}>{activeCall.callerName[0]?.toUpperCase()}</div>
        <div className={styles.callerName}>{activeCall.callerName}</div>
        <div className={styles.label}>Incoming call…</div>
        <div className={styles.actions}>
          <button className={styles.btnDecline} onClick={decline}>
            📵<span>Decline</span>
          </button>
          <button className={styles.btnAccept} onClick={accept}>
            📞<span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
