import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useMedia } from '../hooks/useMedia';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useTranscription } from '../hooks/useTranscription';
import { useCopy } from '../hooks/useCopy';
import { api } from '../utils/api';
import VideoGrid from '../components/VideoGrid';
import Controls from '../components/Controls';
import ChatPanel from '../components/ChatPanel';
import TranscriptPanel from '../components/TranscriptPanel';
import NotesPanel from '../components/NotesPanel';
import ParticipantsPanel from '../components/ParticipantsPanel';
import CollabCanvas from '../components/CollabCanvas';
import EndScreen from '../components/EndScreen';
import styles from './MeetingPage.module.css';

const TABS = [
  { id: 'chat',       label: 'Chat',      icon: '💬' },
  { id: 'transcript', label: 'Live',       icon: '🎙️' },
  { id: 'notes',      label: 'Notes',      icon: '✨' },
  { id: 'canvas',     label: 'Whiteboard', icon: '🎨' },
  { id: 'people',     label: 'People',     icon: '👥' },
];

export default function MeetingPage() {
  const { roomId }  = useParams();
  const navigate    = useNavigate();
  const location    = useLocation();
  const { user, addToHistory, updateHistoryItem } = useUserStore();

  // Password passed from join flow
  const roomPassword = location.state?.password || '';
  // Meeting title passed from create flow
  const meetingTitle = location.state?.title || '';

  const [tab, setTab]               = useState('chat');
  const [participants, setParticipants] = useState([]);
  const [mySocketId, setMySocketId] = useState('');
  const [hostSocketId, setHostSocketId] = useState('');
  const [chat, setChat]             = useState([]);
  const [unread, setUnread]         = useState(0);
  const [reactions, setReactions]   = useState([]);
  const [ended, setEnded]           = useState(false);
  const [endedByHost, setEndedByHost] = useState(false);
  const [meetingStats, setMeetingStats] = useState(null);
  const [summary, setSummary]       = useState(null);
  const [seconds, setSeconds]       = useState(0);
  const [meetingId, setMeetingId]   = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [canvasRef, setCanvasRef]   = useState(null); // ref from CollabCanvas
  const [initialCanvas, setInitialCanvas] = useState([]);

  const timerRef  = useRef(null);
  const meetingRef = useRef({ id: null, transcript: [], title: meetingTitle });

  const { copied: linkCopied, copy: copyLink } = useCopy();

  // ── Media ────────────────────────────────────────────────────────────────
  const { localStream, cameraStream, muted, videoOff, screenSharing,
    startMedia, toggleMute, toggleVideo, startScreenShare, stopScreenShare, stopMedia } = useMedia();

  // ── Socket ───────────────────────────────────────────────────────────────
  const { socket, connected } = useSocket();

  // ── WebRTC ───────────────────────────────────────────────────────────────
  const { remoteStreams } = useWebRTC({ socket, roomId, localStream });

  // ── Transcription ────────────────────────────────────────────────────────
  const { transcript, isListening, supported: transcriptSupported, start: startTranscription,
    stop: stopTranscription, addLine } = useTranscription({
    onLine: useCallback((line) => {
      meetingRef.current.transcript.push(line);
      socket?.emit('transcript-line', { roomId, text: line.text });
    }, [socket, roomId]),
  });

  const isHost = mySocketId && hostSocketId && mySocketId === hostSocketId;

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate('/'); return; }
    (async () => {
      await startMedia();
      try {
        const { meeting } = await api.createMeeting({ hostName: user.name, title: meetingRef.current.title || 'Meeting', password: roomPassword });
        setMeetingId(meeting.id);
        meetingRef.current.id = meeting.id;
        addToHistory({ id: meeting.id, roomCode: roomId, title: meeting.title || 'Meeting', date: new Date().toLocaleDateString(), participants: 1 });
      } catch {
        const localId = `local-${Date.now()}`;
        setMeetingId(localId);
        meetingRef.current.id = localId;
      }
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    })();
    return () => { clearInterval(timerRef.current); stopMedia(); stopTranscription(); };
  }, []);

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected || !user) return;

    socket.emit('join-room', { roomId, userId: user.userId, name: user.name });

    socket.on('room-joined', ({ participants: existing, you, hostSocketId: hid, canvas }) => {
      setParticipants(existing);
      setMySocketId(you.socketId);
      setHostSocketId(hid);
      setInitialCanvas(canvas || []);
    });

    socket.on('participant-joined', (p) => {
      setParticipants(prev => [...prev.filter(x => x.socketId !== p.socketId), p]);
    });

    socket.on('participant-left', ({ socketId, name, time }) => {
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
      addMsg({ type: 'system', text: `${name} left the meeting`, time });
    });

    socket.on('host-changed', ({ newHostSocketId, newHostName }) => {
      setHostSocketId(newHostSocketId);
      addMsg({ type: 'system', text: `${newHostName} is now the host` });
    });

    // Host ended meeting for everyone
    socket.on('meeting-ended-by-host', ({ hostName }) => {
      setEndedByHost(true);
      finishMeeting(false); // not the host, don't re-emit
    });

    socket.on('chat-message', (msg) => {
      setChat(prev => [...prev, msg]);
      if (tab !== 'chat') setUnread(u => u + 1);
    });

    socket.on('transcript-line', (line) => {
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
      ['room-joined','participant-joined','participant-left','host-changed',
       'meeting-ended-by-host','chat-message','transcript-line','reaction']
        .forEach(e => socket.off(e));
    };
  }, [socket, connected, user, roomId]);

  useEffect(() => {
    socket?.emit('media-state', { roomId, muted, videoOff, screenSharing });
  }, [muted, videoOff, screenSharing, socket, roomId]);

  const addMsg = (msg) => setChat(prev => [...prev, { id: Date.now(), ...msg }]);

  const sendMessage = (text) => socket?.emit('chat-message', { roomId, message: text });
  const sendReaction = (emoji) => socket?.emit('reaction', { roomId, emoji });

  const handleToggleMute = () => {
    toggleMute();
    if (!muted && isListening) stopTranscription();
    else if (muted && !isListening && transcriptSupported) startTranscription(user.name);
  };

  const finishMeeting = async (emitEnd = true) => {
    clearInterval(timerRef.current);
    stopTranscription();
    stopMedia();

    if (emitEnd && isHost) {
      socket?.emit('host-end-meeting', { roomId });
    }

    const stats = {
      duration: fmt(seconds),
      participantCount: participants.length + 1,
      messageCount: chat.filter(m => !m.type).length,
      transcriptLines: meetingRef.current.transcript.length,
    };
    setMeetingStats(stats);

    if (meetingRef.current.transcript.length > 0) {
      api.saveTranscript(meetingId, meetingRef.current.transcript).catch(() => {});
    }

    if (meetingRef.current.transcript.length >= 3) {
      try {
        const { summary: s } = await api.summarize(meetingRef.current.transcript);
        setSummary(s);
        api.saveSummary(meetingId, s).catch(() => {});
        updateHistoryItem(meetingId, { summary: s, duration: fmt(seconds), participants: stats.participantCount });
      } catch { setSummary(null); }
    }

    setEnded(true);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const switchTab = (t) => { setTab(t); if (t === 'chat') setUnread(0); };

  const allParticipants = [
    { socketId: mySocketId || 'local', name: user?.name || 'You', color: '#4f7cff',
      stream: cameraStream, isLocal: true, isHost, muted, videoOff },
    ...participants.map(p => ({
      ...p, stream: remoteStreams[p.socketId] || null, isLocal: false,
      isHost: p.socketId === hostSocketId,
    })),
  ];

  if (ended) {
    return <EndScreen stats={meetingStats} summary={summary} transcript={meetingRef.current.transcript}
      endedByHost={endedByHost} onNewMeeting={() => navigate('/')} onHome={() => navigate('/history')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>NexMeet</div>
        <div className={styles.headerCenter}>
          <div className={styles.recDot} />
          <span className={styles.timer}>{fmt(seconds)}</span>
          {meetingTitle && <span className={styles.meetingTitle}>{meetingTitle}</span>}
          <span className={styles.roomCode}>{roomId}</span>
          <button className={`${styles.copyBtn} ${linkCopied ? styles.copyBtnSuccess : ''}`}
            onClick={() => copyLink(window.location.href)} title="Copy meeting link">
            {linkCopied ? '✓' : '📋'}
          </button>
          {/* Host-only: show password */}
          {isHost && roomPassword && (
            <div className={styles.passwordBadge}>
              <span className={styles.lockIcon}>🔒</span>
              <span className={styles.passwordVal}>
                {showPassword ? roomPassword : '••••••'}
              </span>
              <button className={styles.eyeBtn} onClick={() => setShowPassword(p => !p)}
                title={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          )}
        </div>
        <div className={styles.headerRight}>
          <span className={styles.connStatus} style={{ color: connected ? 'var(--green)' : 'var(--amber)' }}>
            {connected ? '● Connected' : '○ Reconnecting…'}
          </span>
          {isHost && <span className={styles.hostBadge}>Host</span>}
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.videoArea}>
          {screenSharing && (
            <div className={styles.shareBar}>
              🖥️ You are sharing your screen —{' '}
              <button onClick={stopScreenShare} className={styles.stopShareBtn}>Stop sharing</button>
            </div>
          )}

          <VideoGrid participants={allParticipants} />

          <div className={styles.reactions}>
            {reactions.map(r => (
              <div key={r.id} className={styles.reaction}>
                <span>{r.emoji}</span>
                <span className={styles.reactionFrom}>{r.from}</span>
              </div>
            ))}
          </div>

          <Controls muted={muted} videoOff={videoOff} screenSharing={screenSharing}
            onToggleMute={handleToggleMute} onToggleVideo={toggleVideo}
            onScreenShare={async () => { if (screenSharing) stopScreenShare(); else await startScreenShare(); }}
            onReaction={sendReaction} onEndMeeting={() => finishMeeting(true)} isHost={isHost} />
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.tabs}>
            {TABS.map(t => (
              <button key={t.id} className={`${styles.tabBtn} ${tab === t.id ? styles.activeTab : ''}`}
                onClick={() => switchTab(t.id)}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {t.id === 'chat' && unread > 0 && <span className={styles.badge}>{unread}</span>}
                {t.id === 'people' && <span className={styles.countBadge}>{allParticipants.length}</span>}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {tab === 'chat'       && <ChatPanel messages={chat} onSend={sendMessage} />}
            {tab === 'transcript' && <TranscriptPanel transcript={transcript} isLive={isListening}
                supported={transcriptSupported} onStart={() => startTranscription(user.name)} onStop={stopTranscription} />}
            {tab === 'notes'      && <NotesPanel transcript={meetingRef.current.transcript.length > 0
                ? meetingRef.current.transcript : transcript} onSummaryGenerated={setSummary} />}
            {tab === 'canvas'     && <CollabCanvas socket={socket} roomId={roomId}
                initialStrokes={initialCanvas} myName={user?.name} myColor="#4f7cff" />}
            {tab === 'people'     && <ParticipantsPanel participants={allParticipants} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
