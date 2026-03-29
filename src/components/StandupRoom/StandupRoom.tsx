'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import styles from './StandupRoom.module.css';

interface Attendee { name: string; join_time: string; leave_time: string | null; }
interface Note     { speaker: string; content: string; time: string; }
interface Status   { active: boolean; date: string; attendees: Attendee[]; notes: Note[]; }

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function StandupRoom() {
  const { data: session } = useSession();
  const userName = (session?.user as any)?.display_name || session?.user?.name || 'User';
  const isAdmin  = (session?.user as any)?.role === 'admin';

  const [status,   setStatus]   = useState<Status | null>(null);
  const [agenda,   setAgenda]   = useState<Record<string, string[]>>({});
  const [joined,   setJoined]   = useState(false);
  const [update,   setUpdate]   = useState('');
  const [sending,  setSending]  = useState(false);
  const [starting, setStarting] = useState(false);
  const [aiReply,  setAiReply]  = useState('');
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const notesEndRef  = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check voice support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      setVoiceSupported(true);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/meeting/status');
      setStatus(await res.json());
    } catch {}
  }, []);

  const fetchAgenda = useCallback(async () => {
    try {
      const res = await fetch('/api/meeting/agenda');
      const data = await res.json();
      setAgenda(data.agenda || {});
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchAgenda();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchAgenda]);

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [status?.notes]);

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = update;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + t;
        } else {
          interim = t;
        }
      }
      setUpdate(finalTranscript + (interim ? ' ' + interim : ''));
    };

    recognition.onend = () => {
      setListening(false);
      setUpdate(finalTranscript);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.start();
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function joinMeeting() {
    await fetch('/api/meeting/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName }),
    });
    setJoined(true);
    fetchStatus();
  }

  async function leaveMeeting() {
    stopVoice();
    await fetch('/api/meeting/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName }),
    });
    setJoined(false);
    fetchStatus();
  }

  async function submitUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!update.trim() || sending) return;
    stopVoice();
    setSending(true);
    setAiReply('');
    try {
      const res = await fetch('/api/meeting/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speaker: userName, content: update.trim() }),
      });
      const data = await res.json();
      if (data.reply) setAiReply(data.reply);
      setUpdate('');
      fetchStatus();
    } catch {}
    setSending(false);
  }

  async function startStandup() {
    setStarting(true);
    try {
      await fetch('/api/agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'standup' }),
      });
      // Poll until active
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const res = await fetch('/api/meeting/status');
        const data = await res.json();
        setStatus(data);
        if (data.active) break;
      }
    } catch {}
    setStarting(false);
  }

  async function endMeeting() {
    await fetch('/api/agent/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end' }),
    });
    fetchStatus();
  }

  const isActive  = status?.active ?? false;
  const hasAgenda = Object.keys(agenda).length > 0;

  return (
    <div className={styles.room}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.botIcon}>🤖</span>
          <div>
            <div className={styles.title}>AI Chief of Staff</div>
            <div className={styles.subtitle}>Daily Standup · Mon–Sat 10:00 AM IST</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={`${styles.statusPill} ${isActive ? styles.active : styles.idle}`}>
            {isActive ? '● Meeting Active' : '○ No Active Meeting'}
          </div>
          {isAdmin && !isActive && (
            <button className={styles.btnTrigger} onClick={startStandup} disabled={starting}>
              {starting ? '⏳ Starting…' : '▶ Start Standup Now'}
            </button>
          )}
          {isAdmin && isActive && (
            <button className={styles.btnEnd} onClick={endMeeting}>■ End Meeting</button>
          )}
        </div>
      </div>

      <div className={styles.body}>

        {/* Left column */}
        <div className={styles.leftCol}>

          {/* Attendance */}
          <div className={`${styles.panel} glass`}>
            <div className={styles.panelTitle}>👥 Attendance</div>
            {status?.attendees.length ? (
              <div className={styles.attendeeList}>
                {status.attendees.map((a, i) => (
                  <div key={i} className={styles.attendee}>
                    <div className={styles.attendeeAvatar}>{a.name[0]}</div>
                    <div className={styles.attendeeInfo}>
                      <span className={styles.attendeeName}>{a.name}</span>
                      <span className={styles.attendeeTime}>
                        Joined {a.join_time}{a.leave_time ? ` · Left ${a.leave_time}` : ''}
                      </span>
                    </div>
                    {!a.leave_time && <span className={styles.onlineDot} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>No one has joined yet</div>
            )}
          </div>

          {/* Agenda */}
          <div className={`${styles.panel} glass`}>
            <div className={styles.panelTitle}>📋 Today's Agenda</div>
            {hasAgenda ? (
              <div className={styles.agendaList}>
                {Object.entries(agenda).map(([member, tasks]) => (
                  <div key={member} className={styles.agendaMember}>
                    <div className={styles.agendaMemberName}>{member}</div>
                    {(tasks as string[]).map((t, i) => (
                      <div key={i} className={styles.agendaTask}>🔴 {t}</div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>No pending tasks — all clear!</div>
            )}
          </div>

        </div>

        {/* Right column */}
        <div className={styles.rightCol}>

          {/* Notes feed */}
          <div className={`${styles.panel} ${styles.notesPanel} glass`}>
            <div className={styles.panelTitle}>📝 Meeting Notes</div>
            <div className={styles.notesFeed}>
              {status?.notes.length ? status.notes.map((n, i) => (
                <div key={i} className={`${styles.note} ${n.speaker === 'AI Chief of Staff' ? styles.aiNote : styles.memberNote}`}>
                  <div className={styles.noteMeta}>
                    <span className={styles.noteSpeaker}>
                      {n.speaker === 'AI Chief of Staff' ? '🤖 AI Chief' : `👤 ${n.speaker}`}
                    </span>
                    <span className={styles.noteTime}>{n.time}</span>
                  </div>
                  <div className={styles.noteContent}>{n.content}</div>
                </div>
              )) : (
                <div className={styles.emptyState}>
                  {isActive ? 'Meeting started — join and submit your update below.' : 'Notes will appear here during standup.'}
                </div>
              )}
              <div ref={notesEndRef} />
            </div>
          </div>

          {/* AI reply */}
          {aiReply && (
            <div className={`${styles.aiReplyBanner} glass`}>
              <span className={styles.aiReplyIcon}>🤖</span>
              <span>{aiReply}</span>
            </div>
          )}

          {/* Controls */}
          <div className={`${styles.controls} glass`}>
            {!joined ? (
              <button className={styles.btnJoin} onClick={joinMeeting}>
                ▶ Join Standup
              </button>
            ) : (
              <form className={styles.updateForm} onSubmit={submitUpdate}>
                <div className={styles.inputRow}>
                  <textarea
                    className={`${styles.updateInput} ${listening ? styles.inputListening : ''}`}
                    placeholder={`Your standup update:\n✅ Done: ...\n🔄 Today: ...\n🚫 Blocked: ...`}
                    value={update}
                    onChange={e => setUpdate(e.target.value)}
                    rows={3}
                  />
                  {voiceSupported && (
                    <button
                      type="button"
                      className={`${styles.btnMic} ${listening ? styles.btnMicActive : ''}`}
                      onClick={listening ? stopVoice : startVoice}
                      title={listening ? 'Stop listening' : 'Speak your update'}
                    >
                      {listening ? '⏹' : '🎤'}
                    </button>
                  )}
                </div>
                {listening && (
                  <div className={styles.listeningBadge}>🎤 Listening… speak your update in English</div>
                )}
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnSubmit} disabled={sending || !update.trim()}>
                    {sending ? 'Sending…' : '📤 Submit Update'}
                  </button>
                  <button type="button" className={styles.btnLeave} onClick={leaveMeeting}>Leave</button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
