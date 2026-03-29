'use client';

import { useEffect, useState } from 'react';
import styles from './calendar.module.css';

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  desc: string | null;
  link: string | null;
};

function formatDate(iso: string, allDay: boolean) {
  const d = new Date(iso);
  if (allDay) return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isSoon(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 86400000 * 3; // within 3 days
}

export default function CalendarView() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/calendar/events')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setEvents(data.events || []);
      })
      .catch(() => setError('Failed to load calendar'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.state}>Loading events…</div>;
  if (error)   return <div className={styles.stateError}>⚠ {error}<br/><small>Make sure the calendar is set to public in Google Calendar settings.</small></div>;
  if (!events.length) return <div className={styles.state}>No upcoming events.</div>;

  return (
    <div className={styles.list}>
      {events.map(ev => {
        const today = isToday(ev.start);
        const soon  = isSoon(ev.start);
        return (
          <a
            key={ev.id}
            href={ev.link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.eventCard} glass ${today ? styles.today : soon ? styles.soon : ''}`}
          >
            <div className={styles.dateCol}>
              <span className={styles.dateText}>{formatDate(ev.start, ev.allDay)}</span>
              {today && <span className={styles.badge}>Today</span>}
              {!today && soon && <span className={styles.badgeSoon}>Soon</span>}
            </div>
            <div className={styles.info}>
              <div className={styles.title}>{ev.title}</div>
              {ev.location && <div className={styles.meta}>📍 {ev.location}</div>}
              {ev.desc && <div className={styles.desc}>{ev.desc.replace(/<[^>]*>/g, '').slice(0, 100)}</div>}
            </div>
          </a>
        );
      })}
    </div>
  );
}
