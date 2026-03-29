'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header/Header';
import styles from './agents.module.css';

type Status = { online: boolean; meeting_active?: boolean; meeting_open?: boolean };

export default function AgentsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  async function fetchStatus() {
    try {
      const res = await fetch('/api/agent/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ online: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  async function trigger(action: 'standup' | 'end') {
    setActionMsg('Sending...');
    try {
      const res = await fetch('/api/agent/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setActionMsg(data.message || (data.ok ? 'Done!' : 'Failed'));
      await fetchStatus();
    } catch {
      setActionMsg('Error contacting agent');
    }
    setTimeout(() => setActionMsg(''), 4000);
  }

  return (
    <>
      <Header title="AI Agents" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>AI Agents</h1>
          <p>Monitor and control your Aronlabz AI Chief of Staff.</p>
        </div>

        <div className={styles.agentCard + ' glass'}>
          <div className={styles.agentHeader}>
            <div className={styles.agentInfo}>
              <span className={styles.agentIcon}>◉</span>
              <div>
                <div className={styles.agentName}>Aronlabz Chief of Staff</div>
                <div className={styles.agentSub}>Discord bot · Groq Llama-3.3-70b · Standup automation</div>
              </div>
            </div>
            <div className={`${styles.statusBadge} ${loading ? styles.loading : status?.online ? styles.online : styles.offline}`}>
              {loading ? 'Checking…' : status?.online ? 'Online' : 'Offline'}
            </div>
          </div>

          {status?.online && (
            <div className={styles.meetingStatus}>
              {status.meeting_active
                ? <span className={styles.activeMeeting}>● Standup in progress</span>
                : <span className={styles.idleMeeting}>● Idle — no active meeting</span>}
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.btnTrigger}
              onClick={() => trigger('standup')}
              disabled={!status?.online || !!status?.meeting_active}
            >
              ▶ Trigger Standup
            </button>
            <button
              className={styles.btnEnd}
              onClick={() => trigger('end')}
              disabled={!status?.online || !status?.meeting_active}
            >
              ■ End Meeting
            </button>
            <button className={styles.btnRefresh} onClick={fetchStatus}>
              ↻ Refresh
            </button>
          </div>

          {actionMsg && <div className={styles.actionMsg}>{actionMsg}</div>}
        </div>
      </div>
    </>
  );
}
