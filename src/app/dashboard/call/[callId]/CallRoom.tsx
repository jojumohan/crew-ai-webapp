'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase-client';
import {
  doc, onSnapshot, updateDoc, addDoc,
  collection, query, where, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import styles from './CallRoom.module.css';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface CallDoc {
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  status: string;
}

export default function CallRoom({ callId }: { callId: string }) {
  const { data: session } = useSession();
  const router = useRouter();

  const [callDoc, setCallDoc] = useState<CallDoc | null>(null);
  const [status, setStatus] = useState<string>('loading');
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const myId   = (session?.user as any)?.id ?? '';
  const myName = session?.user?.name ?? 'User';

  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringRef        = useRef<HTMLAudioElement | null>(null);
  const unsubs         = useRef<(() => void)[]>([]);
  const durationTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const webrtcStarted  = useRef(false);
  const callDocRef     = useRef<CallDoc | null>(null);

  // Keep callDocRef in sync so async functions see the latest value
  useEffect(() => { callDocRef.current = callDoc; }, [callDoc]);

  function stopRing() {
    ringRef.current?.pause();
    ringRef.current = null;
  }

  const cleanup = useCallback(() => {
    stopRing();
    if (durationTimer.current) clearInterval(durationTimer.current);
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current = null;
    }
    unsubs.current.forEach((fn) => fn());
    unsubs.current = [];
    webrtcStarted.current = false;
  }, []);

  // WebRTC signal handler — needs pc passed in to avoid stale closure
  async function handleSignal(signal: Record<string, unknown>, pc: RTCPeerConnection) {
    const { type, data, from } = signal as { type: string; data: RTCSessionDescriptionInit | RTCIceCandidateInit; from: string };
    const cd = callDocRef.current;
    if (!cd) return;

    if (type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      addDoc(collection(db, 'call_signals'), {
        callId, to: from, from: myId, type: 'answer', data: answer, ts: serverTimestamp(),
      }).catch(() => {});
    } else if (type === 'answer') {
      if (pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit)).catch(() => {});
      }
    } else if (type === 'ice') {
      await pc.addIceCandidate(new RTCIceCandidate(data as RTCIceCandidateInit)).catch(() => {});
    }
  }

  async function startWebRTC(isCaller: boolean, cd: CallDoc) {
    if (webrtcStarted.current) return;
    webrtcStarted.current = true;

    // Unlock AudioContext on user gesture context (call page load counts)
    try { const ctx = new AudioContext(); await ctx.resume(); ctx.close(); } catch {}

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      alert('Microphone permission required to continue the call.');
      webrtcStarted.current = false;
      return;
    }
    localStreamRef.current = stream;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      const audio = new Audio();
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
      remoteAudioRef.current = audio;
      setConnected(true);
      durationTimer.current = setInterval(() => setDuration((d) => d + 1), 1000);
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const otherId = isCaller ? cd.calleeId : cd.callerId;
      addDoc(collection(db, 'call_signals'), {
        callId, to: otherId, from: myId, type: 'ice',
        data: e.candidate.toJSON(), ts: serverTimestamp(),
      }).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        hangUp();
      }
    };

    // Listen for signals addressed to me
    const sigUnsub = onSnapshot(
      query(collection(db, 'call_signals'), where('callId', '==', callId), where('to', '==', myId)),
      (snap) => {
        snap.docChanges().forEach((ch) => {
          if (ch.type === 'added') {
            handleSignal(ch.doc.data() as Record<string, unknown>, pc).catch(() => {});
            deleteDoc(ch.doc.ref).catch(() => {});
          }
        });
      },
      (err) => console.error('call_signals listener error:', err),
    );
    unsubs.current.push(sigUnsub);

    // Caller sends offer
    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addDoc(collection(db, 'call_signals'), {
        callId, to: cd.calleeId, from: myId, type: 'offer', data: offer, ts: serverTimestamp(),
      }).catch(() => {});
    }
  }

  // Watch call document
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'calls', callId),
      (snap) => {
        if (!snap.exists()) { setStatus('ended'); return; }
        const data = snap.data() as CallDoc;
        setCallDoc(data);
        setStatus(data.status);
      },
      (err) => console.error('call doc listener error:', err),
    );
    return () => unsub();
  }, [callId]);

  // React to call status changes
  useEffect(() => {
    if (!callDoc || !myId) return;
    const isCaller = callDoc.callerId === myId;

    if (callDoc.status === 'ringing' && isCaller) {
      // Play ringback tone for caller
      if (!ringRef.current) {
        const a = new Audio('/ring.mp3');
        a.loop = true;
        a.play().catch(() => {});
        ringRef.current = a;
      }
    } else if (callDoc.status === 'accepted') {
      stopRing();
      startWebRTC(isCaller, callDoc);
    } else if (callDoc.status === 'ended' || callDoc.status === 'declined') {
      cleanup();
      setConnected(false);
    }
  }, [callDoc?.status, myId]);

  useEffect(() => () => cleanup(), [cleanup]);

  async function hangUp() {
    cleanup();
    await updateDoc(doc(db, 'calls', callId), { status: 'ended' }).catch(() => {});
    router.push('/dashboard');
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted((m) => !m);
  }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!session || status === 'loading') {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
        <p className={styles.hint}>Connecting…</p>
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className={styles.center}>
        <div className={styles.endIcon}>📵</div>
        <div className={styles.endTitle}>Call Declined</div>
        <div className={styles.endSub}>The other person declined the call.</div>
        <button className={styles.btnBack} onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className={styles.center}>
        <div className={styles.endIcon}>📵</div>
        <div className={styles.endTitle}>Call Ended</div>
        {connected && <div className={styles.endSub}>Duration: {formatDuration(duration)}</div>}
        <button className={styles.btnBack} onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!callDoc) return null;
  const isCaller  = callDoc.callerId === myId;
  const otherName = isCaller ? callDoc.calleeName : callDoc.callerName;

  return (
    <div className={styles.room}>
      <div className={styles.card}>

        {/* Avatar with pulse while ringing */}
        <div className={`${styles.avatarWrap} ${status === 'ringing' ? styles.pulsing : ''}`}>
          <div className={styles.avatar}>{otherName[0]?.toUpperCase()}</div>
        </div>

        <div className={styles.otherName}>{otherName}</div>

        <div className={styles.statusLine}>
          {status === 'ringing' && isCaller  && 'Calling…'}
          {status === 'ringing' && !isCaller && 'Connecting…'}
          {status === 'accepted' && !connected && 'Connecting audio…'}
          {status === 'accepted' && connected  && formatDuration(duration)}
        </div>

        {/* Animated dots while ringing */}
        {status === 'ringing' && (
          <div className={styles.dots}>
            <span /><span /><span />
          </div>
        )}

        {/* Call controls */}
        <div className={styles.controls}>
          {status === 'accepted' && (
            <button
              className={`${styles.ctrlBtn} ${muted ? styles.mutedBtn : ''}`}
              onClick={toggleMute}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? '🔇' : '🎤'}
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>
          )}
          <button className={styles.hangupBtn} onClick={hangUp} title="End call">
            📵
            <span>End</span>
          </button>
        </div>

      </div>
    </div>
  );
}
