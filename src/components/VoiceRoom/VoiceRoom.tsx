'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { db } from '@/lib/firebase-client';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  addDoc, serverTimestamp, query, orderBy, limit,
} from 'firebase/firestore';
import styles from './VoiceRoom.module.css';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
const ROOM = 'standup_room';

interface Peer { id: string; name: string; }

function playBase64Wav(base64: string) {
  if (!base64) return;
  try {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(() => {});
    return audio;
  } catch {}
}

export default function VoiceRoom() {
  const { data: session } = useSession();
  const userName  = (session?.user as any)?.display_name || session?.user?.name || 'User';
  const isAdmin   = (session?.user as any)?.role === 'admin';
  const userId    = useRef(`user_${Math.random().toString(36).slice(2, 9)}`);

  const [inCall,        setInCall]        = useState(false);
  const [muted,         setMuted]         = useState(false);
  const [peers,         setPeers]         = useState<Peer[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [recording,     setRecording]     = useState(false);
  const [transcript,    setTranscript]    = useState('');
  const [agentReply,    setAgentReply]    = useState('');
  const [meetingActive, setMeetingActive] = useState(false);
  const [starting,      setStarting]      = useState(false);
  const [notes,         setNotes]         = useState<{speaker:string;content:string;time:string}[]>([]);
  const [agentStatus,   setAgentStatus]   = useState('Waiting for standup…');

  const localStream    = useRef<MediaStream | null>(null);
  const peerConns      = useRef<Record<string, RTCPeerConnection>>({});
  const remoteAudios   = useRef<Record<string, HTMLAudioElement>>({});
  const mediaRecorder  = useRef<MediaRecorder | null>(null);
  const audioChunks    = useRef<Blob[]>([]);
  const unsubscribers  = useRef<(() => void)[]>([]);
  const notesEndRef    = useRef<HTMLDivElement>(null);

  // Poll meeting status + notes from VPS
  const pollMeeting = useCallback(async () => {
    try {
      const [statusRes, notesRes] = await Promise.all([
        fetch('/api/meeting/status'),
        fetch('/api/meeting/status'),
      ]);
      const data = await statusRes.json();
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

  // ── WebRTC helpers ──────────────────────────────────────────────────────────

  function createPeerConn(peerId: string, peerName: string) {
    const pc = new RTCPeerConnection(ICE);
    peerConns.current[peerId] = pc;

    // Add local audio track
    localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current!));

    // Remote audio
    pc.ontrack = (e) => {
      const audio = remoteAudios.current[peerId] || new Audio();
      remoteAudios.current[peerId] = audio;
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    };

    // ICE candidates → Firestore
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      addDoc(collection(db, ROOM, 'signals', peerId, 'incoming'), {
        from: userId.current,
        type: 'ice',
        data: e.candidate.toJSON(),
        ts: serverTimestamp(),
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        delete peerConns.current[peerId];
        delete remoteAudios.current[peerId];
        setPeers(p => p.filter(x => x.id !== peerId));
      }
    };

    return pc;
  }

  async function handleSignal(signal: any) {
    const { from, fromName, type, data } = signal;
    if (from === userId.current) return;

    if (type === 'offer') {
      const pc = peerConns.current[from] || createPeerConn(from, fromName);
      setPeers(p => p.find(x => x.id === from) ? p : [...p, { id: from, name: fromName }]);
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      addDoc(collection(db, ROOM, 'signals', from, 'incoming'), {
        from: userId.current,
        fromName: userName,
        type: 'answer',
        data: answer,
        ts: serverTimestamp(),
      });

    } else if (type === 'answer') {
      const pc = peerConns.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));

    } else if (type === 'ice') {
      const pc = peerConns.current[from];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
    }
  }

  async function callPeer(peerId: string, peerName: string) {
    const pc = createPeerConn(peerId, peerName);
    setPeers(p => p.find(x => x.id === peerId) ? p : [...p, { id: peerId, name: peerName }]);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    addDoc(collection(db, ROOM, 'signals', peerId, 'incoming'), {
      from: userId.current,
      fromName: userName,
      type: 'offer',
      data: offer,
      ts: serverTimestamp(),
    });
  }

  // ── Join / Leave ────────────────────────────────────────────────────────────

  async function joinCall() {
    // Get mic
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      alert('Microphone permission denied. Please allow microphone access.');
      return;
    }
    localStream.current = stream;
    setInCall(true);

    const myId   = userId.current;
    const myDoc  = doc(db, ROOM, 'presence', myId);
    await setDoc(myDoc, { name: userName, joinedAt: serverTimestamp() });

    // Listen for my signals
    const sigUnsub = onSnapshot(
      query(collection(db, ROOM, 'signals', myId, 'incoming'), orderBy('ts', 'asc')),
      snap => snap.docChanges().forEach(ch => { if (ch.type === 'added') handleSignal(ch.doc.data()); })
    );

    // Listen for others joining/leaving
    const presUnsub = onSnapshot(collection(db, ROOM, 'presence'), snap => {
      snap.docChanges().forEach(ch => {
        const pid = ch.doc.id;
        if (pid === myId) return;
        if (ch.type === 'added') {
          const pdata = ch.doc.data();
          // I call the newcomer if I'm older (lexicographic order)
          if (myId < pid) callPeer(pid, pdata.name);
        }
        if (ch.type === 'removed') {
          peerConns.current[pid]?.close();
          delete peerConns.current[pid];
          delete remoteAudios.current[pid];
          setPeers(p => p.filter(x => x.id !== pid));
        }
      });
    });

    // Agent joins: register attendance + speak greeting
    await fetch('/api/meeting/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName }),
    });

    // Agent greeting via Sarvam TTS (only first person to join)
    const presSnap = await import('firebase/firestore').then(({ getDocs }) =>
      getDocs(collection(db, ROOM, 'presence'))
    );
    if (presSnap.size <= 1) {
      agentSpeak(`Good morning ${userName}! I'm your AI Chief of Staff. The standup room is now open. Please share your updates when ready.`);
    }

    unsubscribers.current = [sigUnsub, presUnsub];

    // Cleanup on tab close
    window.addEventListener('beforeunload', leaveCall);
  }

  async function leaveCall() {
    // Firestore cleanup
    await deleteDoc(doc(db, ROOM, 'presence', userId.current)).catch(() => {});

    // Close peer connections
    Object.values(peerConns.current).forEach(pc => pc.close());
    peerConns.current = {};
    Object.values(remoteAudios.current).forEach(a => { a.srcObject = null; });
    remoteAudios.current = {};

    // Stop mic
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;

    // Unsubscribe Firestore
    unsubscribers.current.forEach(fn => fn());
    unsubscribers.current = [];

    await fetch('/api/meeting/leave', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName }),
    });

    setPeers([]);
    setInCall(false);
    window.removeEventListener('beforeunload', leaveCall);
  }

  // ── Mute toggle ────────────────────────────────────────────────────────────

  function toggleMute() {
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  }

  // ── Agent speaks (Sarvam TTS) ───────────────────────────────────────────────

  async function agentSpeak(text: string) {
    setAgentSpeaking(true);
    setAgentStatus('Speaking…');
    try {
      const res  = await fetch('/api/sarvam/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const audio = playBase64Wav(data.audio);
      if (audio) {
        audio.onended = () => { setAgentSpeaking(false); setAgentStatus('Listening…'); };
      } else {
        setAgentSpeaking(false);
        setAgentStatus('Listening…');
      }
    } catch {
      setAgentSpeaking(false);
      setAgentStatus('Listening…');
    }
  }

  // ── Push-to-talk: user speaks to agent ─────────────────────────────────────

  function startRecording() {
    if (!localStream.current || recording) return;
    audioChunks.current = [];
    const mr = new MediaRecorder(localStream.current, { mimeType: 'audio/webm' });
    mediaRecorder.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
    mr.start(200);
    setRecording(true);
    setTranscript('');
    setAgentReply('');
  }

  async function stopRecording() {
    if (!mediaRecorder.current || !recording) return;
    setRecording(false);
    mediaRecorder.current.stop();

    await new Promise<void>(res => { if (mediaRecorder.current) mediaRecorder.current.onstop = () => res(); });

    const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
    if (blob.size < 1000) return; // too short, ignore

    setAgentStatus('Processing…');
    setAgentSpeaking(true);

    const form = new FormData();
    form.append('audio', blob, 'audio.webm');

    try {
      const res  = await fetch('/api/sarvam/speak', { method: 'POST', body: form });
      const data = await res.json();

      if (data.transcript) setTranscript(data.transcript);
      if (data.reply)      setAgentReply(data.reply);
      if (data.audio)      {
        const audio = playBase64Wav(data.audio);
        if (audio) {
          audio.onended = () => { setAgentSpeaking(false); setAgentStatus('Listening…'); };
          return;
        }
      }
    } catch (e) {
      console.error('Speak error:', e);
    }
    setAgentSpeaking(false);
    setAgentStatus('Listening…');
    pollMeeting();
  }

  // ── Start / End standup ────────────────────────────────────────────────────

  async function startStandup() {
    setStarting(true);
    await fetch('/api/agent/trigger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'standup' }),
    });
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 2000));
      await pollMeeting();
      const res = await fetch('/api/meeting/status');
      const d = await res.json();
      if (d.active) break;
    }
    setStarting(false);
  }

  async function endMeeting() {
    await fetch('/api/agent/trigger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end' }),
    });
    agentSpeak("Standup is now complete. Great work team! I'll send everyone their task summaries shortly.");
    pollMeeting();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.room}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.roomIcon}>📞</span>
          <div>
            <div className={styles.title}>Aronlabz Standup Room</div>
            <div className={styles.subtitle}>Daily standup · Mon–Sat 10:00 AM IST · Agent-powered</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.statusPill} ${meetingActive ? styles.active : styles.idle}`}>
            {meetingActive ? '● Meeting Active' : '○ No Active Meeting'}
          </span>
          {isAdmin && !meetingActive && (
            <button className={styles.btnStart} onClick={startStandup} disabled={starting}>
              {starting ? '⏳ Starting…' : '▶ Start Standup'}
            </button>
          )}
          {isAdmin && meetingActive && (
            <button className={styles.btnEndTop} onClick={endMeeting}>■ End Meeting</button>
          )}
        </div>
      </div>

      <div className={styles.body}>

        {/* Participants */}
        <div className={styles.participants}>

          {/* Agent card */}
          <div className={`${styles.participantCard} ${styles.agentCard} glass`}>
            <div className={`${styles.avatarRing} ${agentSpeaking ? styles.speaking : ''}`}>
              <div className={styles.avatar} style={{ background: 'linear-gradient(135deg,#06b6d4,#6366f1)' }}>🤖</div>
            </div>
            <div className={styles.pName}>AI Chief of Staff</div>
            <div className={styles.pStatus}>{inCall ? agentStatus : 'Waiting…'}</div>
            {agentSpeaking && <div className={styles.soundWave}><span/><span/><span/><span/><span/></div>}
          </div>

          {/* Self card */}
          {inCall && (
            <div className={`${styles.participantCard} ${styles.selfCard} glass`}>
              <div className={`${styles.avatarRing} ${recording ? styles.speaking : ''}`}>
                <div className={styles.avatar}>{userName[0]?.toUpperCase()}</div>
              </div>
              <div className={styles.pName}>{userName} (you)</div>
              <div className={styles.pStatus}>{muted ? '🔇 Muted' : recording ? '🔴 Speaking to agent' : '🎙 Live'}</div>
            </div>
          )}

          {/* Remote peers */}
          {peers.map(p => (
            <div key={p.id} className={`${styles.participantCard} glass`}>
              <div className={styles.avatarRing}>
                <div className={styles.avatar}>{p.name[0]?.toUpperCase()}</div>
              </div>
              <div className={styles.pName}>{p.name}</div>
              <div className={styles.pStatus}>🎙 In call</div>
            </div>
          ))}

        </div>

        {/* Right: notes + controls */}
        <div className={styles.rightPanel}>

          {/* Transcript / reply */}
          {(transcript || agentReply) && (
            <div className={`${styles.transcriptBox} glass`}>
              {transcript && <div className={styles.transcriptLine}><span className={styles.tLabel}>You said:</span> {transcript}</div>}
              {agentReply  && <div className={styles.transcriptLine}><span className={styles.aLabel}>🤖 Agent:</span> {agentReply}</div>}
            </div>
          )}

          {/* Meeting notes */}
          <div className={`${styles.notesPanel} glass`}>
            <div className={styles.notesTitle}>📝 Meeting Notes</div>
            <div className={styles.notesFeed}>
              {notes.length ? notes.map((n, i) => (
                <div key={i} className={`${styles.note} ${n.speaker === 'AI Chief of Staff' ? styles.agentNote : styles.userNote}`}>
                  <span className={styles.noteSpeaker}>{n.speaker === 'AI Chief of Staff' ? '🤖' : '👤'} {n.speaker}</span>
                  <span className={styles.noteTime}>{n.time}</span>
                  <div className={styles.noteText}>{n.content}</div>
                </div>
              )) : <div className={styles.empty}>Notes appear here during standup</div>}
              <div ref={notesEndRef} />
            </div>
          </div>

          {/* Controls bar */}
          <div className={`${styles.controls} glass`}>
            {!inCall ? (
              <button className={styles.btnJoin} onClick={joinCall}>
                📞 Join Call
              </button>
            ) : (
              <>
                <button
                  className={`${styles.btnTalk} ${recording ? styles.btnTalkActive : ''}`}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={agentSpeaking}
                >
                  {recording ? '🔴 Release to send' : '🎤 Hold to talk to Agent'}
                </button>
                <button className={`${styles.btnMute} ${muted ? styles.btnMuted : ''}`} onClick={toggleMute}>
                  {muted ? '🔇 Unmute' : '🔊 Mute'}
                </button>
                <button className={styles.btnLeave} onClick={leaveCall}>
                  📵 Leave
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
