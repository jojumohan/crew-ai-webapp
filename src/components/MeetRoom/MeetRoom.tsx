'use client';

import { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';
import styles from './MeetRoom.module.css';

interface MeetRoomProps {
  roomName: string;
  userName: string;
}

export default function MeetRoom({ roomName, userName }: MeetRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const callFrameRef = useRef<any>(null);

  useEffect(() => {
    if (!active) return;
    
    async function startCall() {
      setLoading(true);
      setError('');

      try {
        // 1. Fetch or create a secure, ad-free room from our backend
        const res = await fetch('/api/meet/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
           throw new Error(data.error || "Failed to get room URL.");
        }

        // 2. Initialize Daily.co SDK in the container
        if (!containerRef.current) return;
        
        callFrameRef.current = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px',
          },
          showLeaveButton: true,
          theme: {
            colors: {
              accent: '#005c4b',
              accentText: '#ffffff',
              background: '#0b141a',
              backgroundAccent: '#202c33',
              baseText: '#e9edef',
              border: 'rgba(255, 255, 255, 0.1)',
              mainAreaBg: '#111b21',
              mainAreaBgAccent: '#202c33',
              mainAreaText: '#e9edef',
              supportiveText: '#8696a0',
            }
          }
        });

        // 3. Join the call
        await callFrameRef.current.join({
          url: data.url,
          userName: userName
        });
        
        callFrameRef.current.on('left-meeting', () => {
          setActive(false);
        });

      } catch (err: any) {
        console.error("Daily Error:", err);
        setError(err.message);
        setActive(false);
      } finally {
        setLoading(false);
      }
    }

    startCall();

    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [active, roomName, userName]);

  if (!active) {
    return (
      <div className={`${styles.joinPanel} glass`}>
        <div className={styles.info}>
          <span className={styles.icon}>📞</span>
          <h3>Premium Video Call</h3>
          <p>Join the secure, ad-free team room.</p>
        </div>
        <button 
          className={styles.btnJoin} 
          onClick={() => setActive(true)}
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Join Call'}
        </button>
        {error && <p style={{ color: '#ff6b6b', marginTop: '10px' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={styles.meetContainer}>
      <div ref={containerRef} className={styles.meetFrame} />
      {/* Daily.co SDK injects its own leave button safely inside the iframe */}
    </div>
  );
}
