'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './MeetRoom.module.css';

interface MeetRoomProps {
  roomName: string;
  userName: string;
}

export default function MeetRoom({ roomName, userName }: MeetRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    // Load Jitsi script if not already present
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => initJitsi();
      document.body.appendChild(script);
    } else {
      initJitsi();
    }

    function initJitsi() {
      const domain = 'meet.jit.si';
      const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: containerRef.current,
        userInfo: { displayName: userName },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'e2ee'
          ],
        },
        configOverwrite: {
          disableDeepLinking: true,
          prejoinPageEnabled: false,
        },
      };
      
      const api = new window.JitsiMeetExternalAPI(domain, options);
      
      return () => api.dispose();
    }
  }, [active, roomName, userName]);

  if (!active) {
    return (
      <div className={`${styles.joinPanel} glass`}>
        <div className={styles.info}>
          <span className={styles.icon}>📞</span>
          <h3>Active Meeting</h3>
          <p>Join the team for a group call.</p>
        </div>
        <button className={styles.btnJoin} onClick={() => setActive(true)}>
          Join Call
        </button>
      </div>
    );
  }

  return (
    <div className={styles.meetContainer}>
      <div ref={containerRef} className={styles.meetFrame} />
      <button className={styles.btnExit} onClick={() => setActive(false)}>
        Leave Room
      </button>
    </div>
  );
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}
