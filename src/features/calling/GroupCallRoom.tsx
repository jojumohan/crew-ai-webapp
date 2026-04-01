'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase-client';
import {
  doc, onSnapshot, updateDoc, addDoc,
  collection, query, where, serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import DailyIframe from '@daily-co/daily-js';
import styles from './GroupCallRoom.module.css';

interface Participant {
  id: string;
  name: string;
  joinedAt: string;
  audio: boolean;
  video: boolean;
}

interface GroupCallDoc {
  conversationId: string;
  initiatorId: string;
  initiatorName: string;
  roomName: string;
  roomUrl: string;
  status: 'ringing' | 'active' | 'ended';
  type: 'voice' | 'video';
  participants: Participant[];
  invitedIds: string[];
  startedAt: string;
  endedAt?: string;
}

interface GroupCallRoomProps {
  callId: string;
}

export default function GroupCallRoom({ callId }: GroupCallRoomProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);

  const [callDoc, setCallDoc] = useState<GroupCallDoc | null>(null);
  const [status, setStatus] = useState<string>('loading');
  const [error, setError] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [duration, setDuration] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const myId = (session?.user as any)?.id ?? '';
  const myName = session?.user?.name ?? 'User';

  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubs = useRef<(() => void)[]>([]);

  // Format duration
  const formatDuration = useCallback((s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }, []);

  // Join the Daily.co call
  const joinDailyCall = useCallback(async (roomUrl: string, type: 'voice' | 'video') => {
    if (!containerRef.current || callFrameRef.current) return;

    try {
      callFrameRef.current = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '12px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
        showLocalVideo: type === 'video',
        showParticipantsBar: false,
        startVideoOff: type === 'voice',
        startAudioOff: false,
      });

      await callFrameRef.current.join({
        url: roomUrl,
        userName: myName,
        userId: myId,
      });

      // Listen for participant changes
      callFrameRef.current.on('participant-joined', (evt: any) => {
        setParticipants((prev) => {
          const exists = prev.find((p) => p.id === evt.participant.user_id);
          if (exists) return prev;
          return [...prev, {
            id: evt.participant.user_id,
            name: evt.participant.user_name || 'Unknown',
            joinedAt: new Date().toISOString(),
            audio: !evt.participant.audioMuted,
            video: !evt.participant.videoOff,
          }];
        });
      });

      callFrameRef.current.on('participant-left', (evt: any) => {
        setParticipants((prev) => prev.filter((p) => p.id !== evt.participant.user_id));
      });

      callFrameRef.current.on('left-meeting', () => {
        setIsJoined(false);
        leaveCall();
      });

      setIsJoined(true);

      // Update our status in the call doc
      await updateDoc(doc(db, 'group_calls', callId), {
        participants: [...(callDoc?.participants || []).filter(p => p.id !== myId), {
          id: myId,
          name: myName,
          joinedAt: new Date().toISOString(),
          audio: true,
          video: type === 'video',
        }],
      });

    } catch (err: any) {
      console.error('Daily join error:', err);
      setError(err.message || 'Failed to join call');
    }
  }, [callId, myId, myName, callDoc?.participants]);

  // Watch call document
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'group_calls', callId),
      async (snap) => {
        if (!snap.exists()) {
          setStatus('ended');
          return;
        }
        const data = snap.data() as GroupCallDoc;
        setCallDoc(data);
        setStatus(data.status);
        setParticipants(data.participants || []);

        // Auto-join if call becomes active and we haven't joined
        if (data.status === 'active' && !isJoined && data.roomUrl) {
          // Check if we're invited
          if (data.invitedIds?.includes(myId) || data.initiatorId === myId) {
            joinDailyCall(data.roomUrl, data.type);
          }
        }

        // Start duration timer if active
        if (data.status === 'active' && !durationTimer.current) {
          const startTime = new Date(data.startedAt).getTime();
          durationTimer.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setDuration(elapsed);
          }, 1000);
        }
      },
      (err) => {
        console.error('Group call doc listener error:', err);
        setError('Failed to connect to call');
      },
    );
    unsubs.current.push(unsub);

    return () => {
      unsubs.current.forEach((fn) => fn());
      unsubs.current = [];
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
    };
  }, [callId, myId, isJoined, joinDailyCall]);

  // Accept the call (for invited users)
  const acceptCall = async () => {
    if (!callDoc?.roomUrl) return;
    
    await updateDoc(doc(db, 'group_calls', callId), {
      status: 'active',
      startedAt: new Date().toISOString(),
    });

    joinDailyCall(callDoc.roomUrl, callDoc.type);
  };

  // Leave the call
  const leaveCall = async () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }

    if (callFrameRef.current) {
      callFrameRef.current.destroy();
      callFrameRef.current = null;
    }

    // Remove ourselves from participants
    if (callDoc) {
      const updatedParticipants = callDoc.participants.filter((p) => p.id !== myId);
      await updateDoc(doc(db, 'group_calls', callId), {
        participants: updatedParticipants,
      });
    }

    setIsJoined(false);
    router.push('/dashboard');
  };

  // End the call completely (initiator only)
  const endCall = async () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }

    if (callFrameRef.current) {
      callFrameRef.current.destroy();
      callFrameRef.current = null;
    }

    await updateDoc(doc(db, 'group_calls', callId), {
      status: 'ended',
      endedAt: new Date().toISOString(),
    });

    setIsJoined(false);
    router.push('/dashboard');
  };

  // Toggle mute
  const toggleMute = () => {
    if (callFrameRef.current) {
      const newMuted = !isMuted;
      if (newMuted) {
        callFrameRef.current.setLocalAudio(false);
      } else {
        callFrameRef.current.setLocalAudio(true);
      }
      setIsMuted(newMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (callFrameRef.current) {
      const newVideoOff = !isVideoOff;
      if (newVideoOff) {
        callFrameRef.current.setLocalVideo(false);
      } else {
        callFrameRef.current.setLocalVideo(true);
      }
      setIsVideoOff(newVideoOff);
    }
  };

  // Render states
  if (!session || status === 'loading') {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
        <p className={styles.hint}>Connecting to group call…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.center}>
        <div className={styles.endIcon}>⚠️</div>
        <div className={styles.endTitle}>Call Error</div>
        <div className={styles.endSub}>{error}</div>
        <button className={styles.btnBack} onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className={styles.center}>
        <div className={styles.endIcon}>📵</div>
        <div className={styles.endTitle}>Call Ended</div>
        {duration > 0 && (
          <div className={styles.endSub}>Duration: {formatDuration(duration)}</div>
        )}
        <button className={styles.btnBack} onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!callDoc) return null;

  const isInitiator = callDoc.initiatorId === myId;
  const isInvited = callDoc.invitedIds?.includes(myId);
  const canJoin = isInitiator || isInvited;

  // Waiting to accept screen
  if (status === 'ringing' && !isInitiator && !isJoined) {
    return (
      <div className={styles.center}>
        <div className={styles.avatarRing}>
          <div className={styles.groupAvatar}>
            {callDoc.initiatorName[0]?.toUpperCase()}
          </div>
          {participants.length > 0 && (
            <div className={styles.participantCount}>+{participants.length}</div>
          )}
        </div>
        <div className={styles.endTitle}>{callDoc.initiatorName}</div>
        <div className={styles.endSub}>
          is inviting you to a {callDoc.type} call
          {participants.length > 0 && ` with ${participants.length} others`}
        </div>
        <div className={styles.dots}>
          <span /><span /><span />
        </div>
        <div className={styles.controls}>
          <button className={styles.btnDecline} onClick={() => router.push('/dashboard')}>
            📵 Decline
          </button>
          <button className={styles.btnAccept} onClick={acceptCall}>
            📞 Accept
          </button>
        </div>
      </div>
    );
  }

  // Main call interface
  return (
    <div className={styles.room}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h2>{callDoc.type === 'video' ? 'Video Call' : 'Voice Call'}</h2>
          <span>{formatDuration(duration)} • {participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
        </div>
        <button 
          className={styles.participantsBtn}
          onClick={() => setShowParticipants(!showParticipants)}
        >
          👥 {participants.length}
        </button>
      </div>

      {/* Main content area */}
      <div className={styles.content}>
        {/* Video/Call area */}
        <div className={`${styles.callArea} ${callDoc.type === 'voice' ? styles.voiceOnly : ''}`}>
          {canJoin && !isJoined ? (
            <div className={styles.joinPrompt}>
              <div className={styles.groupAvatarLarge}>
                {callDoc.initiatorName[0]?.toUpperCase()}
              </div>
              <h3>{callDoc.type === 'video' ? 'Join Video Call' : 'Join Voice Call'}</h3>
              <p>{participants.length} participant{participants.length !== 1 ? 's' : ''} in call</p>
              <button 
                className={styles.btnJoin}
                onClick={() => joinDailyCall(callDoc.roomUrl, callDoc.type)}
              >
                {callDoc.type === 'video' ? '📹 Join with Video' : '🎤 Join with Audio'}
              </button>
            </div>
          ) : (
            <div ref={containerRef} className={styles.videoContainer} />
          )}
        </div>

        {/* Participants sidebar */}
        {showParticipants && (
          <div className={styles.participantsPanel}>
            <h3>Participants ({participants.length})</h3>
            <div className={styles.participantsList}>
              {participants.map((p) => (
                <div key={p.id} className={styles.participantRow}>
                  <div className={styles.participantAvatar}>{p.name[0]?.toUpperCase()}</div>
                  <div className={styles.participantInfo}>
                    <span className={styles.participantName}>
                      {p.name} {p.id === myId && '(You)'}
                    </span>
                    <span className={styles.participantStatus}>
                      {p.audio ? '🎤' : '🔇'} {p.video ? '📹' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controlsBar}>
        <button 
          className={`${styles.controlBtn} ${isMuted ? styles.controlActive : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        {callDoc.type === 'video' && (
          <button 
            className={`${styles.controlBtn} ${isVideoOff ? styles.controlActive : ''}`}
            onClick={toggleVideo}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? '📷❌' : '📹'}
          </button>
        )}

        <button 
          className={styles.controlBtn}
          onClick={() => setShowParticipants(!showParticipants)}
          title="Participants"
        >
          👥
        </button>

        {isInitiator ? (
          <button className={styles.hangupBtn} onClick={endCall} title="End call for everyone">
            📵 End
          </button>
        ) : (
          <button className={styles.hangupBtn} onClick={leaveCall} title="Leave call">
            📵 Leave
          </button>
        )}
      </div>
    </div>
  );
}
