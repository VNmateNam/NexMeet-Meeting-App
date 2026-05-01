import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { api } from '../utils/api';
import styles from './HomePage.module.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, setUser, meetingHistory } = useUserStore();

  const [name, setName] = useState(user?.name || '');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState('home'); // home | join
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ensureUser = async () => {
    if (user) return user;
    if (!name.trim()) { setError('Enter your name to continue'); return null; }
    try {
      const { user: u, token } = await api.guestLogin(name.trim());
      setUser(u, token);
      return u;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  const handleNewMeeting = async () => {
    setLoading(true); setError('');
    const u = await ensureUser();
    if (!u) { setLoading(false); return; }
    try {
      const { meeting } = await api.createMeeting({ hostName: u.name, title: 'My Meeting' });
      navigate(`/meeting/${meeting.roomCode}`);
    } catch {
      // Fallback: generate a local room code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      navigate(`/meeting/${code}`);
    }
    setLoading(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) { setError('Enter a meeting code'); return; }
    setLoading(true); setError('');
    const u = await ensureUser();
    if (!u) { setLoading(false); return; }
    navigate(`/meeting/${joinCode.trim().toUpperCase()}`);
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.grid} />
      </div>

      <nav className={styles.nav}>
        <div className={styles.logo}>NexMeet</div>
        <div className={styles.navLinks}>
          <button onClick={() => navigate('/history')} className={styles.navLink}>History</button>
          {user && <span className={styles.userBadge}>{user.name}</span>}
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.badge}>✨ Powered by AI</div>
          <h1 className={styles.title}>
            Meet smarter.<br />
            <span className="gradient-text">Think together.</span>
          </h1>
          <p className={styles.subtitle}>
            Crystal-clear video calls with real-time transcription,<br />
            AI meeting summaries, and collaborative notes.
          </p>

          {!user && (
            <div className={styles.nameRow}>
              <input
                className={styles.nameInput}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                onKeyDown={e => e.key === 'Enter' && handleNewMeeting()}
                maxLength={40}
              />
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          {mode === 'home' && (
            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={handleNewMeeting} disabled={loading}>
                {loading ? <span className="spinner" /> : '🎥'}
                New Meeting
              </button>
              <button className={styles.btnSecondary} onClick={() => setMode('join')}>
                Enter a code
              </button>
            </div>
          )}

          {mode === 'join' && (
            <form className={styles.joinForm} onSubmit={handleJoin}>
              <input
                className={styles.codeInput}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Meeting code (e.g. AB12CD)"
                maxLength={8}
                autoFocus
              />
              <div className={styles.joinBtns}>
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? <span className="spinner" /> : null} Join
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => setMode('home')}>Cancel</button>
              </div>
            </form>
          )}
        </div>

        <div className={styles.features}>
          {[
            { icon: '🎥', title: 'HD Video', desc: 'WebRTC peer-to-peer video — no servers relay your video.' },
            { icon: '🎙️', title: 'Live Transcription', desc: 'Voice-to-text via Web Speech API & OpenAI Whisper.' },
            { icon: '✨', title: 'AI Notes', desc: 'Claude generates summaries, decisions & action items.' },
            { icon: '💬', title: 'In-Meeting Chat', desc: 'Real-time messaging via Socket.IO.' },
            { icon: '🖥️', title: 'Screen Share', desc: 'Share your entire screen or a single window.' },
            { icon: '📋', title: 'Meeting History', desc: 'All past meetings, transcripts & notes saved locally.' },
          ].map(f => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>

        {meetingHistory.length > 0 && (
          <div className={styles.recentSection}>
            <div className={styles.sectionHeader}>
              <h2>Recent Meetings</h2>
              <button className={styles.viewAll} onClick={() => navigate('/history')}>View all →</button>
            </div>
            <div className={styles.recentGrid}>
              {meetingHistory.slice(0, 3).map(m => (
                <div key={m.id} className={styles.recentCard}>
                  <div className={styles.recentTitle}>{m.title || 'Untitled Meeting'}</div>
                  <div className={styles.recentMeta}>
                    <span>{m.date}</span>
                    <span>{m.duration}</span>
                    <span>{m.participants} participants</span>
                  </div>
                  {m.summary && <div className={styles.summaryBadge}>✨ Notes saved</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
