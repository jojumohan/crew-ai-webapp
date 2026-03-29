'use client';

import { useEffect, useState } from 'react';
import styles from './RingButton.module.css';

const VAPID_PUBLIC_KEY = 'BCpva0FExgUDVR3Nz-2a6jV40EZ35ELZcqoPAGb6F0L3ezBo6jU36fqIj8CqxmqoIF3OJsUdess7UWj_iEHcFrE';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

export default function RingButton() {
  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');
  const [subscribed, setSubscribed] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifStatus('unsupported');
      return;
    }
    setNotifStatus(Notification.permission as any);
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {}
  }

  async function enableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      setNotifStatus(permission as any);
      if (permission !== 'granted') return;

      // Register push service worker
      const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });

      setSubscribed(true);
      setMsg('Notifications enabled!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      setMsg('Failed: ' + err.message);
    }
  }

  async function ringTeam() {
    setRinging(true);
    setMsg('Ringing team...');

    // Play ring sound locally too
    try {
      const audio = new Audio('/ring.mp3');
      audio.play().catch(() => {});
    } catch {}

    try {
      const res = await fetch('/api/push/ring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setMsg(data.ok ? `Rang ${data.sent} device(s)!` : data.error || 'Failed');
    } catch {
      setMsg('Error sending ring');
    }

    setRinging(false);
    setTimeout(() => setMsg(''), 5000);
  }

  if (notifStatus === 'unsupported') return null;

  return (
    <div className={styles.wrap}>
      {!subscribed || notifStatus !== 'granted' ? (
        <button className={styles.btnEnable} onClick={enableNotifications}>
          🔔 Enable Notifications
        </button>
      ) : (
        <button className={`${styles.btnRing} ${ringing ? styles.ringing : ''}`} onClick={ringTeam} disabled={ringing}>
          📞 {ringing ? 'Ringing…' : 'Ring Team'}
        </button>
      )}
      {msg && <span className={styles.msg}>{msg}</span>}
    </div>
  );
}
