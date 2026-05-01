import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useMedia } from '../hooks/useMedia';
import { useSocket } from '../hooks/useSocket';
import { useCopy } from '../hooks/useCopy';
import { useWebRTC } from '../hooks/useWebRTC';
import { useTranscription } from '../hooks/useTranscription';
import { api } from '../utils/api';
import VideoGrid from '../components/VideoGrid';
import Controls from '../components/Controls';
import ChatPanel from '../components/ChatPanel';
import TranscriptPanel from '../components/TranscriptPanel';
import NotesPanel from '../components/NotesPanel';
import ParticipantsPanel from '../components/ParticipantsPanel';
import EndScreen from '../components/EndScreen';
import styles from './MeetingPage.module.css';

const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'transcript', label: 'Live', icon: '🎙️' },
  { id: 'notes', label: 'Notes', icon: '✨' },
  { id: 'people', label: 'People', icon: '👥' },
];

export default function MeetingPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, addToHistory, updateHistoryItem } = useUserStore();

  const { copied: linkCopied, copy: copyLink } = useCopy();
  const [tab, setTab] = useState('chat');
  const [participants, setParticipants] = useState([]);
  const [chat, setChat] = useState([]);
  const [unread, setUnread] = useState(0);
  const [reactions, setReactions] = useState([]);
  const [ended, setEnded] = useState(false);
  const [meetingStats, setMeetingStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [meetingId, setMeetingId] = useState(null);
  const timerRef = useRef(null);
  const meetingRef = useRef({ id: null, transcript: [] });

  // Media
  const {
    localStream, cameraStream, muted, videoOff, screenSharing,
    startMedia, toggleMute, toggleVideo, startScreenShare, stopScreenShare, stopMedia,
  } = useMedia();

  // Socket
  const { socket, connected } = useSocket();

  // WebRTC
  const { remoteStreams } = useWebRTC({ socket, roomId, localStream });

  // Transcription
  const { transcript, isListening, supported: transcriptSupported, start: startTranscription, stop: stopTranscription, addLine } = useTranscription({
    onLine: useCallback((line) => {
      meetingRef.current.transcript.push(line);
      socket?.emit('transcript-line', { roomId, text: line.text });
    }, [socket, roomId]),
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate('/'); return; }

    (async () => {
      await startMedia();

      // Create meeting record
      try {
        const { meeting } = await api.createMeeting({ hostName: user.name, title: 'Meeting' });
        setMeetingId(meeting.id);
        meetingRef.current.id = meeting.id;
        addToHistory({ id: meeting.id, roomCode: roomId, title: 'Meeting', date: new Date().toLocaleDateString(), participants: 1 });
      } catch {
        // Offline mode — generate local ID
        const localId = `local-${Date.now()}`;
        setMeetingId(localId);
        meetingRef.current.id = localId;
      }

      // Start timer
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    })();

    return () => {
      clearInterval(timerRef.current);
      stopMedia();
      stopTranscription();
    };
  }, []);

  // ── Socket: join room ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected || !user) return;

    socket.emit('join-room', { roomId, userId: user.userId, name: user.name });

    socket.on('room-joined', ({ participants: existing }) => {
      setParticipants(existing);
    });

    socket.on('participant-joined', (p) => {
      setParticipants(prev => [...prev.filter(x => x.socketId !== p.socketId), p]);
    });

    socket.on('participant-left', ({ socketId, name }) => {
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
      addChatMessage({ type: 'system', text: `${name} left the meeting` });
    });

    socket.on('chat-message', (msg) => {
      setChat(prev => [...prev, msg]);
      if (tab !== 'chat') setUnread(u => u + 1);
    });

    socket.on('transcript-line', (line) => {
      // Remote participant's transcription
      if (line.speaker !== user.name) {
        addLine(line.speaker, line.text);
        meetingRef.current.transcript.push(line);
      }
    });

    socket.on('reaction', ({ from, emoji }) => {
      const id = Date.now();
      setReactions(prev => [...prev, { id, from, emoji }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
    });

    return () => {
      socket.emit('leave-room', { roomId });
      socket.off('room-joined');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('chat-message');
      socket.off('transcript-line');
      socket.off('reaction');
    };
  }, [socket, connected, user, roomId]);

  // ── Sync media state to peers ─────────────────────────────────────────────
  useEffect(() => {
    socket?.emit('media-state', { roomId, muted, videoOff, screenSharing });
  }, [muted, videoOff, screenSharing, socket, roomId]);

  const addChatMessage = (msg) => setChat(prev => [...prev, { id: Date.now(), ...msg }]);

  const sendMessage = (text) => {
    socket?.emit('chat-message', { roomId, message: text });
  };

  const sendReaction = (emoji) => {
    socket?.emit('reaction', { roomId, emoji });
  };

  const handleToggleMute = () => {
    toggleMute();
    if (!muted && isListening) stopTranscription();
    else if (muted && !isListening && transcriptSupported) startTranscription(user.name);
  };

  const handleToggleVideo = () => toggleVideo();

  const handleScreenShare = async () => {
    if (screenSharing) stopScreenShare();
    else await startScreenShare();
  };

  const handleEndMeeting = async () => {
    clearInterval(timerRef.current);
    stopTranscription();
    stopMedia();
    socket?.emit('leave-room', { roomId });

    const stats = {
      duration: fmt(seconds),
      participantCount: participants.length + 1,
      messageCount: chat.filter(m => !m.type).length,
      transcriptLines: meetingRef.current.transcript.length,
    };
    setMeetingStats(stats);

    // Save transcript
    if (meetingRef.current.transcript.length > 0) {
      api.saveTranscript(meetingId, meetingRef.current.transcript).catch(() => {});
    }

    // Generate AI summary
    if (meetingRef.current.transcript.length >= 3) {
      try {
        const { summary: s } = await api.summarize(meetingRef.current.transcript);
        setSummary(s);
        api.saveSummary(meetingId, s).catch(() => {});
        updateHistoryItem(meetingId, { summary: s, duration: fmt(seconds), participants: stats.participantCount });
      } catch {
        setSummary(null);
      }
    }

    setEnded(true);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const switchTab = (t) => {
    setTab(t);
    if (t === 'chat') setUnread(0);
  };

  // Build participant list for grid
  const allParticipants = [
    { socketId: 'local', name: user?.name || 'You', color: '#4f7cff', stream: cameraStream, isLocal: true, muted, videoOff },
    ...participants.map(p => ({
      ...p,
      stream: remoteStreams[p.socketId] || null,
      isLocal: false,
    })),
  ];

  if (ended) {
    return (
      <EndScreen
        stats={meetingStats}
        summary={summary}
        transcript={meetingRef.current.transcript}
        onNewMeeting={() => navigate('/')}
        onHome={() => navigate('/history')}
      />
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>NexMeet</div>
        <div className={styles.headerCenter}>
          <div className={styles.recDot} />
          <span className={styles.timer}>{fmt(seconds)}</span>
          <span className={styles.roomCode}>{roomId}</span>
          <button
            className={`${styles.copyBtn} ${linkCopied ? styles.copyBtnSuccess : ''}`}
            onClick={() => copyLink(window.location.href)}
            title="Copy meeting link"
          >{linkCopied ? '✓' : '📋'}</button>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.connStatus} style={{ color: connected ? 'var(--green)' : 'var(--amber)' }}>
            {connected ? '● Connected' : '○ Reconnecting…'}
          </span>
        </div>
      </header>

      <div className={styles.body}>
        {/* Video area */}
        <div className={styles.videoArea}>
          {screenSharing && (
            <div className={styles.shareBar}>
              🖥️ You are sharing your screen —{' '}
              <button onClick={stopScreenShare} className={styles.stopShareBtn}>Stop sharing</button>
            </div>
          )}

          <VideoGrid participants={allParticipants} />

          {/* Floating reactions */}
          <div className={styles.reactions}>
            {reactions.map(r => (
              <div key={r.id} className={styles.reaction}>
                <span>{r.emoji}</span>
                <span className={styles.reactionFrom}>{r.from}</span>
              </div>
            ))}
          </div>

          <Controls
            muted={muted}
            videoOff={videoOff}
            screenSharing={screenSharing}
            onToggleMute={handleToggleMute}
            onToggleVideo={handleToggleVideo}
            onScreenShare={handleScreenShare}
            onReaction={sendReaction}
            onEndMeeting={handleEndMeeting}
          />
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.tabs}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`${styles.tabBtn} ${tab === t.id ? styles.activeTab : ''}`}
                onClick={() => switchTab(t.id)}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {t.id === 'chat' && unread > 0 && <span className={styles.badge}>{unread}</span>}
                {t.id === 'people' && <span className={styles.countBadge}>{allParticipants.length}</span>}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {tab === 'chat' && <ChatPanel messages={chat} onSend={sendMessage} />}
            {tab === 'transcript' && (
              <TranscriptPanel
                transcript={transcript}
                isLive={isListening}
                supported={transcriptSupported}
                onStart={() => startTranscription(user.name)}
                onStop={stopTranscription}
              />
            )}
            {tab === 'notes' && (
              <NotesPanel
                transcript={meetingRef.current.transcript.length > 0 ? meetingRef.current.transcript : transcript}
                onSummaryGenerated={setSummary}
              />
            )}
            {tab === 'people' && (
              <ParticipantsPanel participants={allParticipants} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
