'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import styles from './StandupRoom.module.css';

interface Attendee { name: string; join_time: string; leave_time: string | null; }
interface Note     { speaker: string; content: string; time: string; }
interface Status   { active: boolean; date: string; attendees: Attendee[]; notes: Note[]; }

export default function StandupRoom() {
  const { data: session } = useSession();
  const userName = (session?.user as any)?.display_name || session?.user?.name || 'User';
  const isAdmin  = (session?.user as any)?.role === 'admin';

  const [status,  setStatus]  = useState<Status | null>(null);
  const [agenda,  setAgenda]  = useState<Record<string, string[]>>({});
  const [joined,  setJoined]  = useState(false);
  const [update,  setUpdate]  = useState('');
  const [sending, setSending] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const notesEndRef = useRef<HTMLDivElement>(null);

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

  async function endMeeting() {
    await fetch('/api/agent/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end' }),
    });
    fetchStatus();
  }

  const isActive    = status?.active ?? false;
  const myAttendee  = status?.attendees.find(a => a.name === userName);
  const hasAgenda   = Object.keys(agenda).length > 0;

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
        <div className={`${styles.statusPill} ${isActive ? styles.active : styles.idle}`}>
          {isActive ? '● Meeting Active' : '○ No Active Meeting'}
        </div>
      </div>

      <div className={styles.body}>

        {/* Left column: Attendance + Agenda */}
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
                    {tasks.map((t, i) => (
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

        {/* Right column: Notes + Input */}
        <div className={styles.rightCol}>

          {/* Meeting notes feed */}
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
                  {isActive ? 'Meeting started — submit your update below.' : 'Notes will appear here during standup.'}
                </div>
              )}
              <div ref={notesEndRef} />
            </div>
          </div>

          {/* AI instant reply */}
          {aiReply && (
            <div className={`${styles.aiReplyBanner} glass`}>
              <span className={styles.aiReplyIcon}>🤖</span>
              <span>{aiReply}</span>
            </div>
          )}

          {/* Join / Submit / End controls */}
          <div className={`${styles.controls} glass`}>
            {!joined ? (
              <button className={styles.btnJoin} onClick={joinMeeting}>
                ▶ Join Standup
              </button>
            ) : (
              <>
                <form className={styles.updateForm} onSubmit={submitUpdate}>
                  <textarea
                    className={styles.updateInput}
                    placeholder={`Your standup update:\n✅ Done: ...\n🔄 Today: ...\n🚫 Blocked: ...`}
                    value={update}
                    onChange={e => setUpdate(e.target.value)}
                    rows={3}
                  />
                  <button type="submit" className={styles.btnSubmit} disabled={sending || !update.trim()}>
                    {sending ? 'Sending…' : '📤 Submit Update'}
                  </button>
                </form>
                <button className={styles.btnLeave} onClick={leaveMeeting}>Leave</button>
              </>
            )}
            {isAdmin && isActive && (
              <button className={styles.btnEnd} onClick={endMeeting}>■ End Meeting</button>
            )}
            {isAdmin && !isActive && (
              <button className={styles.btnTrigger} onClick={async () => {
                await fetch('/api/agent/trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'standup' }) });
                fetchStatus();
              }}>▶ Start Standup Now</button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
