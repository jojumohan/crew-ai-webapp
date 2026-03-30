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

  // Agent / Notes States
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('Listening to conversation...');
  const recognitionRef = useRef<any>(null);

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
          },
          showLeaveButton: true
        });

        // 3. Join the call
        await callFrameRef.current.join({
          url: data.url,
          userName: userName
        });
        
        callFrameRef.current.on('left-meeting', () => {
          stopAgent();
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
      stopAgent();
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [active, roomName, userName]);

  // START STANDUP & AGENT LISTENING
  const startStandUp = async () => {
    setActive(true);
    setLoading(true);

    // Ring all connected phones
    try {
      await fetch('/api/push/ring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '📢 Standup Starting Now!',
          body: 'Tap to join the team video standup.'
        })
      });
    } catch (e) {
      console.error("Failed to push ring notification", e);
    }

    // Start listening on client side
    startAgentListen();
  };

  const startAgentListen = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech API not supported in this browser.");
      setNotes('Speech recognition not supported in this browser. Please use Chrome/Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let finalStr = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript + ' ';
        }
      }
      if (finalStr) {
         setTranscript(prev => prev + ' ' + finalStr);
      }
    };
    recognition.onerror = (e: any) => console.error("Speech Recog Error:", e.error);
    recognition.onend = () => setIsRecording(false);
    
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopAgent = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const extractTasks = async () => {
    if (!transcript) return;
    setNotes('Analyzing transcript...');
    
    try {
      const res = await fetch('/api/agent/transcribe', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ transcript })
      });
      const data = await res.json();
      if (data.notes) {
        setNotes(data.notes);
      }
    } catch (e) {
       console.error(e);
       setNotes('Failed to extract notes.');
    }
  };

  if (!active) {
    return (
      <div className={`${styles.joinPanelWrapper} glass`}>
        <div className={styles.joinPanel}>
          <div className={styles.info}>
            <span className={styles.icon}>🤖</span>
            <h3>Daily Standup Hub</h3>
            <p>Start the meeting. The AI Agent will listen, ring the <br/>team, and pull tasks automatically into your column.</p>
          </div>
          <button 
            className={styles.btnStandUp} 
            onClick={startStandUp}
            disabled={loading}
          >
            {loading ? 'Booting Agent...' : '🚀 Start Stand Up'}
          </button>
          {error && <p style={{ color: '#ff6b6b', marginTop: '10px' }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.meetContainer}>
      <div className={styles.mainPanel}>
        <div ref={containerRef} className={styles.meetFrame} />
      </div>
      
      {/* Agent Notes Column */}
      <div className={styles.notesPanel}>
         <div className={styles.notesHeader}>
            {isRecording && <div className={styles.recordingPulse}></div>}
            <h3>Agent Notes</h3>
         </div>
         <div className={styles.notesBody}>
            {notes}
            
            {transcript && (
               <div className={styles.transcriptRaw}>
                 {transcript}
               </div>
            )}
         </div>
         <button className={styles.btnAction} onClick={extractTasks}>
            ✨ Extract Tasks
         </button>
      </div>
    </div>
  );
}
