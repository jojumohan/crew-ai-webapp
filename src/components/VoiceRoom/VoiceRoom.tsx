'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { db } from '@/lib/firebase-client';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  addDoc, serverTimestamp, query, where,
} from 'firebase/firestore';
import styles from './VoiceRoom.module.css';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// Firestore collections — must have correct segment counts:
// doc() needs EVEN segments, collection() needs ODD segments
const PRESENCE_COL = 'standup_presence';   // 1 segment — collection ✓
const SIGNALS_COL  = 'standup_signals';    // 1 segment — collection ✓

interface Peer { id: string; name: string; }

function playBase64Wav(base64: string): HTMLAudioElement | null {
  if (!base64) return null;
  try {
    // Strip data URI prefix if present
    const b64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const bytes  = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob   = new Blob([bytes], { type: 'audio/wav' });
    const url    = URL.createObjectURL(blob);
    const audio  = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(e => console.warn('Audio play blocked:', e));
    return audio;
  } catch (e) { console.error('playBase64Wav error:', e); return null; }
}

export default function VoiceRoom() {
  const { data: session } = useSession();
  const userName = (session?.user as any)?.display_name || session?.user?.name || 'User';
  const isAdmin  = (session?.user as any)?.role === 'admin';
  const myId     = useRef(`u_${Math.random().toString(36).slice(2, 9)}`);

  const [inCall,        setInCall]        = useState(false);
  const [muted,         setMuted]         = useState(false);
  const [peers,         setPeers]         = useState<Peer[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [agentStatus,   setAgentStatus]   = useState('Waiting…');
  const [recording,     setRecording]     = useState(false);
  const [transcript,    setTranscript]    = useState('');
  const [agentReply,    setAgentReply]    = useState('');
  const [meetingActive, setMeetingActive] = useState(false);
  const [starting,      setStarting]      = useState(false);
  const [notes,         setNotes]         = useState<{ speaker: string; content: string; time: string }[]>([]);
  const [ringing,       setRinging]       = useState(false);

  const localStream   = useRef<MediaStream | null>(null);
  const peerConns     = useRef<Record<string, RTCPeerConnection>>({});
  const remoteAudios  = useRef<Record<string, HTMLAudioElement>>({});
  const unsubs        = useRef<(() => void)[]>([]);
  const mediaRec      = useRef<MediaRecorder | null>(null);
  const audioChunks   = useRef<Blob[]>([]);
  const ringAudio     = useRef<HTMLAudioElement | null>(null);
  const notesEndRef   = useRef<HTMLDivElement>(null);

  // Poll meeting status + notes
  const pollMeeting = useCallback(async () => {
    try {
      const res  = await fetch('/api/meeting/status');
      const data = await res.json();
      setMeetingActive(data.active);
      setNotes(data.notes?.slice(-30) || []);
    } catch {}
  }, []);

  useEffect(() => {
    pollMeeting();
    const t = setInterval(pollMeeting, 8000);
    return () => clearInterval(t);
  }, [pollMeeting]);

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  // ── Ring tone ─────────────────────────────────────────────────────────────
  function startRing() {
    if (ringAudio.current) return;
    const a = new Audio('/ring.mp3');
    a.loop = true;
    a.play().catch(() => {});
    ringAudio.current = a;
    setRinging(true);
  }

  function stopRing() {
    ringAudio.current?.pause();
    ringAudio.current = null;
    setRinging(false);
  }

  // ── Sarvam TTS: agent speaks ──────────────────────────────────────────────
  async function agentSpeak(text: string) {
    setAgentSpeaking(true);
    setAgentStatus('Speaking…');
    try {
      const res  = await fetch('/api/sarvam/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = playBase64Wav(data.audio);
        if (audio) {
          audio.onended = () => { setAgentSpeaking(false); setAgentStatus('Listening…'); };
          return;
        }
      }
      console.warn('TTS returned no audio:', data);
    } catch (e) { console.error('agentSpeak error:', e); }
    setAgentSpeaking(false);
    setAgentStatus('Listening…');
  }

  // ── WebRTC helpers ────────────────────────────────────────────────────────
  function makePeerConn(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    peerConns.current[peerId] = pc;

    localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current!));

    pc.ontrack = (e) => {
      let audio = remoteAudios.current[peerId];
      if (!audio) { audio = new Audio(); remoteAudios.current[peerId] = audio; }
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
      stopRing();
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      addDoc(collection(db, SIGNALS_COL), {
        to: peerId, from: myId.current, type: 'ice',
        data: e.candidate.toJSON(), ts: serverTimestamp(),
      }).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        delete peerConns.current[peerId];
        remoteAudios.current[peerId]?.pause();
        delete remoteAudios.current[peerId];
        setPeers(p => p.filter(x => x.id !== peerId));
      }
    };

    return pc;
  }

  async function handleSignal(signal: any) {
    const { from, fromName, type, data } = signal;
    if (from === myId.current) return;

    if (type === 'offer') {
      const pc = peerConns.current[from] || makePeerConn(from);
      setPeers(p => p.find(x => x.id === from) ? p : [...p, { id: from, name: fromName || 'Teammate' }]);
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      addDoc(collection(db, SIGNALS_COL), {
        to: from, from: myId.current, fromName: userName, type: 'answer',
        data: answer, ts: serverTimestamp(),
      }).catch(() => {});

    } else if (type === 'answer') {
      const pc = peerConns.current[from];
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data)).catch(() => {});
      }

    } else if (type === 'ice') {
      const pc = peerConns.current[from];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
    }
  }

  async function callPeer(peerId: string, peerName: string) {
    const pc = makePeerConn(peerId);
    setPeers(p => p.find(x => x.id === peerId) ? p : [...p, { id: peerId, name: peerName }]);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    addDoc(collection(db, SIGNALS_COL), {
      to: peerId, from: myId.current, fromName: userName, type: 'offer',
      data: offer, ts: serverTimestamp(),
    }).catch(() => {});
    startRing();
  }

  // ── Join ──────────────────────────────────────────────────────────────────
  async function joinCall() {
    // Unlock audio context immediately on user gesture (before any async gaps)
    try { const ctx = new AudioContext(); await ctx.resume(); ctx.close(); } catch {}

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      alert('Microphone permission denied. Please allow mic access in your browser.');
      return;
    }
    localStream.current = stream;
    setInCall(true);

    // Register presence — doc(db, col, docId) = 2 segments ✓
    try {
      await setDoc(doc(db, PRESENCE_COL, myId.current), {
        name: userName, joinedAt: serverTimestamp(),
      });
    } catch (e) { console.error('Presence write failed:', e); }

    // Listen for signals addressed to me — where('to', '==', myId) ✓
    let sigUnsub: () => void = () => {};
    try {
      sigUnsub = onSnapshot(
        query(collection(db, SIGNALS_COL), where('to', '==', myId.current)),
        snap => {
          snap.docChanges().forEach(ch => {
            if (ch.type === 'added') {
              handleSignal(ch.doc.data()).catch(() => {});
              // Clean up processed signals
              deleteDoc(ch.doc.ref).catch(() => {});
            }
          });
        },
        e => console.error('Signal listener error:', e),
      );
    } catch (e) { console.error('Failed to start signal listener:', e); }

    // Listen for presence changes
    let presUnsub: () => void = () => {};
    try {
      presUnsub = onSnapshot(
        collection(db, PRESENCE_COL),
        snap => {
          snap.docChanges().forEach(ch => {
            const pid = ch.doc.id;
            if (pid === myId.current) return;
            const pName = ch.doc.data().name || 'Teammate';
            if (ch.type === 'added') {
              if (myId.current < pid) callPeer(pid, pName).catch(() => {});
            }
            if (ch.type === 'removed') {
              peerConns.current[pid]?.close();
              delete peerConns.current[pid];
              remoteAudios.current[pid]?.pause();
              delete remoteAudios.current[pid];
              setPeers(p => p.filter(x => x.id !== pid));
            }
          });
        },
        e => console.error('Presence listener error:', e),
      );
    } catch (e) { console.error('Failed to start presence listener:', e); }

    unsubs.current = [sigUnsub, presUnsub];

    // Mark attendance on VPS
    fetch('/api/meeting/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName }),
    }).catch(() => {});

    // Agent greets via Sarvam TTS
    agentSpeak(`Good morning ${userName}! I'm your AI Chief of Staff. Welcome to the standup. Please go ahead and share your update. Hold the Talk to Agent button to speak to me directly.`);
  }

  // ── Leave ─────────────────────────────────────────────────────────────────
  async function leaveCall() {
    stopRing();
    try { mediaRec.current?.stop(); } catch {}

    // Firestore cleanup — wrapped in try so setInCall(false) is ALWAYS reached
    try { await deleteDoc(doc(db, PRESENCE_COL, myId.current)); } catch {}

    // Close all peer connections
    Object.values(peerConns.current).forEach(pc => { try { pc.close(); } catch {} });
    peerConns.current = {};
    Object.values(remoteAudios.current).forEach(a => { try { a.pause(); a.srcObject = null; } catch {} });
    remoteAudios.current = {};

    // Stop mic
    localStream.current?.getTracks().forEach(t => { try { t.stop(); } catch {} });
    localStream.current = null;

    // Unsubscribe Firestore listeners
    unsubs.current.forEach(fn => { try { fn(); } catch {} });
    unsubs.current = [];

    // Mark leave on VPS
    fetch('/api/meeting/leave', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName }),
    }).catch(() => {});

    setPeers([]);
    setTranscript('');
    setAgentReply('');
    setAgentStatus('Waiting…');
    setAgentSpeaking(false);
    setInCall(false); // Always reached
  }

  // Cleanup on unmount
  useEffect(() => () => { if (inCall) leaveCall(); }, []);

  // ── Mute ──────────────────────────────────────────────────────────────────
  function toggleMute() {
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  }

  // ── Push-to-talk → Sarvam STT → AI → TTS ─────────────────────────────────
  function startRecording() {
    if (!localStream.current || recording || agentSpeaking) return;
    audioChunks.current = [];
    try {
      const mr = new MediaRecorder(localStream.current, { mimeType: 'audio/webm' });
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mr.start(200);
      mediaRec.current = mr;
      setRecording(true);
      setTranscript('');
      setAgentReply('');
    } catch {}
  }

  async function stopRecording() {
    if (!recording || !mediaRec.current) return;
    setRecording(false);

    await new Promise<void>(res => {
      if (mediaRec.current) { mediaRec.current.onstop = () => res(); mediaRec.current.stop(); }
      else res();
    });

    const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
    if (blob.size < 500) return;

    setAgentSpeaking(true);
    setAgentStatus('Processing…');

    const form = new FormData();
    form.append('audio', blob, 'audio.webm');

    try {
      const res  = await fetch('/api/sarvam/speak', { method: 'POST', body: form });
      const data = await res.json();
      if (data.transcript) setTranscript(data.transcript);
      if (data.reply)      setAgentReply(data.reply);
      if (data.audio) {
        const audio = playBase64Wav(data.audio);
        if (audio) {
          audio.onended = () => { setAgentSpeaking(false); setAgentStatus('Listening…'); pollMeeting(); };
          return;
        }
      }
    } catch (e) { console.error('Speak error:', e); }

    setAgentSpeaking(false);
    setAgentStatus('Listening…');
    pollMeeting();
  }

  // ── Standup controls ──────────────────────────────────────────────────────
  async function startStandup() {
    setStarting(true);
    await fetch('/api/agent/trigger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'standup' }),
    }).catch(() => {});
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res  = await fetch('/api/meeting/status');
        const data = await res.json();
        if (data.active) { setMeetingActive(true); break; }
      } catch {}
    }
    setStarting(false);
  }

  async function endMeeting() {
    await fetch('/api/agent/trigger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end' }),
    }).catch(() => {});
    agentSpeak('Standup is complete. Great work everyone! I will send task summaries shortly.');
    setTimeout(pollMeeting, 3000);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.room}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.roomIcon}>📞</span>
          <div>
            <div className={styles.title}>Aronlabz Standup Room</div>
            <div className={styles.subtitle}>Daily standup · Mon–Sat 10:00 AM IST</div>
          </div>
        </div>
        <span className={`${styles.statusPill} ${meetingActive ? styles.pillActive : styles.pillIdle}`}>
          {meetingActive ? '● Active' : '○ Idle'}
        </span>
      </div>

      <div className={styles.body}>

        {/* Participants column */}
        <div className={styles.leftCol}>

          {/* Agent card */}
          <div className={`${styles.card} ${styles.agentCard}`}>
            <div className={`${styles.avatarRing} ${agentSpeaking ? styles.ringSpeaking : ''}`}>
              <div className={`${styles.avatar} ${styles.agentAvatar}`}>🤖</div>
            </div>
            <div className={styles.cardName}>AI Chief of Staff</div>
            <div className={styles.cardStatus}>{inCall ? agentStatus : '—'}</div>
            {agentSpeaking && (
              <div className={styles.wave}>
                <span/><span/><span/><span/><span/>
              </div>
            )}
          </div>

          {/* Self card */}
          {inCall && (
            <div className={`${styles.card} ${styles.selfCard}`}>
              <div className={`${styles.avatarRing} ${recording ? styles.ringSpeaking : ''}`}>
                <div className={styles.avatar}>{userName[0]?.toUpperCase()}</div>
              </div>
              <div className={styles.cardName}>{userName}</div>
              <div className={styles.cardStatus}>
                {muted ? '🔇 Muted' : recording ? '🔴 Recording' : '🎙 Live'}
              </div>
            </div>
          )}

          {/* Remote peers */}
          {peers.map(p => (
            <div key={p.id} className={styles.card}>
              <div className={styles.avatarRing}>
                <div className={styles.avatar}>{p.name[0]?.toUpperCase()}</div>
              </div>
              <div className={styles.cardName}>{p.name}</div>
              <div className={styles.cardStatus}>🎙 In call</div>
            </div>
          ))}

          {/* Admin standup controls */}
          {isAdmin && (
            <div className={styles.standupCtrl}>
              <div className={styles.ctrlLabel}>Admin Controls</div>
              {!meetingActive ? (
                <button className={styles.btnStartMeeting} onClick={startStandup} disabled={starting}>
                  {starting ? '⏳ Starting…' : '▶ Start Standup'}
                </button>
              ) : (
                <button className={styles.btnEndMeeting} onClick={endMeeting}>■ End Meeting</button>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className={styles.rightCol}>

          {/* Transcript / agent reply */}
          {(transcript || agentReply) && (
            <div className={styles.transcriptBox}>
              {transcript && (
                <div className={styles.tLine}>
                  <span className={styles.tYou}>You said:</span> {transcript}
                </div>
              )}
              {agentReply && (
                <div className={styles.tLine}>
                  <span className={styles.tAgent}>🤖 Agent:</span> {agentReply}
                </div>
              )}
            </div>
          )}

          {/* Notes feed */}
          <div className={styles.notesPanelWrap}>
            <div className={styles.notesTitle}>📝 Meeting Notes</div>
            <div className={styles.notesFeed}>
              {notes.length ? notes.map((n, i) => (
                <div key={i} className={`${styles.note} ${n.speaker === 'AI Chief of Staff' ? styles.noteAgent : styles.noteUser}`}>
                  <div className={styles.noteMeta}>
                    <span>{n.speaker === 'AI Chief of Staff' ? '🤖' : '👤'} {n.speaker}</span>
                    <span className={styles.noteTime}>{n.time}</span>
                  </div>
                  <div className={styles.noteText}>{n.content}</div>
                </div>
              )) : (
                <div className={styles.emptyNotes}>Notes appear here during standup</div>
              )}
              <div ref={notesEndRef} />
            </div>
          </div>

          {/* Controls bar */}
          <div className={styles.controls}>
            {!inCall ? (
              <button className={styles.btnJoin} onClick={joinCall}>
                📞 Join Call
              </button>
            ) : (
              <>
                <button
                  className={`${styles.btnTalk} ${recording ? styles.btnTalkActive : ''}`}
                  onPointerDown={startRecording}
                  onPointerUp={stopRecording}
                  onPointerLeave={stopRecording}
                  disabled={agentSpeaking}
                >
                  {recording ? '🔴 Release to send' : '🎤 Hold — Talk to Agent'}
                </button>
                <button
                  className={`${styles.btnMute} ${muted ? styles.btnMuted : ''}`}
                  onClick={toggleMute}
                >
                  {muted ? '🔇 Unmute' : '🔊 Mute'}
                </button>
                <button className={styles.btnLeave} onClick={leaveCall}>
                  📵 Leave
                </button>
              </>
            )}
            {ringing && <span className={styles.ringingBadge}>📳 Ringing…</span>}
          </div>

        </div>
      </div>
    </div>
  );
}
