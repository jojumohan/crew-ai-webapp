'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase-client';
import {
  collection, query, where, onSnapshot,
  doc, getDoc,
} from 'firebase/firestore';
import styles from './IncomingGroupCall.module.css';

interface GroupCall {
  id: string;
  initiatorName: string;
  type: 'voice' | 'video';
  participants: Array<{ id: string; name: string }>;
  invitedIds: string[];
}

export default function IncomingGroupCall() {
  const { data: session } = useSession();
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<GroupCall | null>(null);
  const ringRef = useRef<HTMLAudioElement | null>(null);

  const myId = (session?.user as any)?.id ?? '';

  // Listen for incoming group calls
  useEffect(() => {
    if (!myId) return;

    const q = query(
      collection(db, 'group_calls'),
      where('invitedIds', 'array-contains', myId),
      where('status', '==', 'ringing')
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Don't show our own calls
          if (data.initiatorId !== myId) {
            setIncomingCall({
              id: change.doc.id,
              initiatorName: data.initiatorName,
              type: data.type,
              participants: data.participants || [],
              invitedIds: data.invitedIds || [],
            });

            // Play ringtone
            if (!ringRef.current) {
              const audio = new Audio('/ring.mp3');
              audio.loop = true;
              audio.play().catch(() => {});
              ringRef.current = audio;
            }
          }
        }
        
        if (change.type === 'modified') {
          const data = change.doc.data();
          // If status changed from ringing, stop ringing
          if (data.status !== 'ringing' && incomingCall?.id === change.doc.id) {
            stopRing();
            setIncomingCall(null);
          }
        }

        if (change.type === 'removed' && incomingCall?.id === change.doc.id) {
          stopRing();
          setIncomingCall(null);
        }
      });
    });

    return () => {
      unsub();
      stopRing();
    };
  }, [myId, incomingCall?.id]);

  function stopRing() {
    ringRef.current?.pause();
    ringRef.current = null;
  }

  function handleAccept() {
    if (!incomingCall) return;
    stopRing();
    router.push(`/dashboard/group-call/${incomingCall.id}`);
  }

  function handleDecline() {
    stopRing();
    setIncomingCall(null);
  }

  if (!incomingCall) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.avatarRing}>
          <div className={styles.groupAvatar}>
            {incomingCall.initiatorName[0]?.toUpperCase()}
          </div>
          {incomingCall.participants.length > 0 && (
            <div className={styles.participantCount}>
              +{incomingCall.participants.length}
            </div>
          )}
        </div>

        <h2 className={styles.callerName}>{incomingCall.initiatorName}</h2>
        <p className={styles.callType}>
          {incomingCall.type === 'video' ? '📹 Group Video Call' : '📞 Group Voice Call'}
        </p>
        
        <div className={styles.dots}>
          <span /><span /><span />
        </div>

        <div className={styles.actions}>
          <button className={styles.btnDecline} onClick={handleDecline}>
            📵 Decline
          </button>
          <button className={styles.btnAccept} onClick={handleAccept}>
            📞 Accept
          </button>
        </div>
      </div>
    </div>
  );
}
