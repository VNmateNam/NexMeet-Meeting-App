import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { api } from '../utils/api';
import styles from './HomePage.module.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, setUser, meetingHistory } = useUserStore();

  const [name, setName] = useState(user?.name || '');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');

  const [mode, setMode] = useState('home'); // home | join | create
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [showRoomPass, setShowRoomPass] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Room-not-found state
  const [unknownCode, setUnknownCode] = useState('');
  const [showRoomOptions, setShowRoomOptions] = useState(false);

  // Room info when joining a password-protected room
  const [roomInfo, setRoomInfo] = useState(null);

  const ensureUser = async (nameOverride) => {
    const n = nameOverride || name;
    if (user && !nameOverride) return user;
    if (!n.trim()) { setError('Enter your name to continue'); return null; }
    try {
      const { user: u, token } = await api.guestLogin(n.trim());
      setUser(u, token);
      return u;
    } catch {
      // Offline fallback
      const u = { userId: `local-${Date.now()}`, name: n.trim(), role: 'guest' };
      setUser(u, 'local-token');
      return u;
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim() === user?.name) {
      setEditingName(false);
      return;
    }
    const u = await ensureUser(newName.trim());
    if (u) {
      setName(newName.trim());
      setEditingName(false);
    }
  };

  // ── Create new meeting ────────────────────────────────────────────────
  const handleNewMeeting = async () => {
    setLoading(true); setError('');
    const u = await ensureUser();
    if (!u) { setLoading(false); return; }
    try {
      const { meeting } = await api.createMeeting({
        hostName: u.name,
        title: meetingTitle.trim() || 'My Meeting',
        password: roomPassword.trim() || null,
      });
      navigate(`/meeting/${meeting.roomCode}`, { state: { title: meetingTitle.trim(), password: roomPassword.trim() } });
    } catch {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      navigate(`/meeting/${code}`);
    }
    setLoading(false);
  };

  // ── Join by code ──────────────────────────────────────────────────────
  const handleCheckCode = async (e) => {
    e?.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError('Enter a meeting code'); return; }

    setLoading(true); setError('');

    try {
      const info = await api.checkRoom(code);

      if (!info.exists) {
        // Room not found — ask user what to do
        setUnknownCode(code);
        setShowRoomOptions(true);
        setLoading(false);
        return;
      }

      setRoomInfo(info);

      // If password protected, show password input
      if (info.hasPassword) {
        setLoading(false);
        return; // UI will show password field
      }

      // No password — join directly
      await doJoin(code, '');
    } catch {
      // Server offline — just navigate
      const u = await ensureUser();
      if (u) navigate(`/meeting/${code}`);
    }
    setLoading(false);
  };

  const handleJoinWithPassword = async (e) => {
    e?.preventDefault();
    const code = joinCode.trim().toUpperCase();
    setLoading(true); setError('');
    try {
      await api.joinRoom(code, joinPassword);
      await doJoin(code, joinPassword);
    } catch (err) {
      setError(err.message === 'Incorrect password' ? '🔒 Incorrect password' : err.message);
    }
    setLoading(false);
  };

  const doJoin = async (code, password) => {
    const u = await ensureUser();
    if (!u) return;
    navigate(`/meeting/${code}`, { state: { password } });
  };

  // ── Create room with unknown code ─────────────────────────────────────
  const handleCreateWithCode = async () => {
    setLoading(true); setError('');
    const u = await ensureUser();
    if (!u) { setLoading(false); return; }
    navigate(`/meeting/${unknownCode}`);
    setLoading(false);
  };

  const resetJoin = () => {
    setRoomInfo(null);
    setShowRoomOptions(false);
    setUnknownCode('');
    setJoinPassword('');
    setError('');
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
          {user && (
            editingName ? (
              <div className={styles.nameEdit}>
                <input
                  className={styles.nameEditInput}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  autoFocus
                  maxLength={40}
                />
                <button className={styles.saveNameBtn} onClick={handleSaveName}>Save</button>
                <button className={styles.cancelNameBtn} onClick={() => setEditingName(false)}>✕</button>
              </div>
            ) : (
              <button className={styles.userBadge} onClick={() => { setEditingName(true); setNewName(user.name); }} title="Click to change name">
                {user.name} ✏️
              </button>
            )
          )}
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

          {/* ── Home buttons ── */}
          {mode === 'home' && !showRoomOptions && (
            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={() => setMode('create')}>
                🎥 New Meeting
              </button>
              <button className={styles.btnSecondary} onClick={() => setMode('join')}>
                Enter a code
              </button>
            </div>
          )}

          {/* ── Create meeting form ── */}
          {mode === 'create' && (
            <div className={styles.createForm}>
              <input
                className={styles.titleInput}
                value={meetingTitle}
                onChange={e => setMeetingTitle(e.target.value)}
                placeholder="Meeting title (optional)"
                maxLength={60}
              />
              <div className={styles.passwordRow}>
                <span className={styles.lockIcon}>🔒</span>
                <input
                  className={styles.passwordInput}
                  value={roomPassword}
                  onChange={e => setRoomPassword(e.target.value)}
                  placeholder="Room password (optional)"
                  type={showRoomPass ? 'text' : 'password'}
                  maxLength={30}
                />
                {roomPassword && (
                  <button type="button" className={styles.eyeToggle} onClick={() => setShowRoomPass(p => !p)}>
                    {showRoomPass ? '🙈' : '👁️'}
                  </button>
                )}
              </div>
              {roomPassword && (
                <p className={styles.passwordHint}>
                  Participants will need this password to join
                </p>
              )}
              <div className={styles.joinBtns}>
                <button className={styles.btnPrimary} onClick={handleNewMeeting} disabled={loading}>
                  {loading ? <span className="spinner" /> : '🎥'} Create Room
                </button>
                <button className={styles.btnGhost} onClick={() => { setMode('home'); setRoomPassword(''); setMeetingTitle(''); }}>Cancel</button>
              </div>
            </div>
          )}

          {/* ── Join by code ── */}
          {mode === 'join' && !showRoomOptions && !roomInfo && (
            <form className={styles.joinForm} onSubmit={handleCheckCode}>
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
                  {loading ? <span className="spinner" /> : null} Check Code
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => { setMode('home'); resetJoin(); }}>Cancel</button>
              </div>
            </form>
          )}

          {/* ── Password entry for protected room ── */}
          {mode === 'join' && roomInfo && roomInfo.hasPassword && (
            <form className={styles.joinForm} onSubmit={handleJoinWithPassword}>
              <div className={styles.roomInfoBox}>
                <div className={styles.roomInfoTitle}>{roomInfo.title}</div>
                <div className={styles.roomInfoMeta}>Hosted by {roomInfo.hostName} · 🔒 Password required</div>
              </div>
              <input
                className={styles.codeInput}
                value={joinPassword}
                onChange={e => setJoinPassword(e.target.value)}
                placeholder="Enter room password"
                type="password"
                autoFocus
              />
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.joinBtns}>
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? <span className="spinner" /> : '🔓'} Join Room
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => { resetJoin(); setMode('join'); }}>Back</button>
              </div>
            </form>
          )}

          {/* ── Room not found options ── */}
          {showRoomOptions && (
            <div className={styles.notFoundBox}>
              <div className={styles.notFoundIcon}>🔍</div>
              <h3 className={styles.notFoundTitle}>Room <span className={styles.codeHighlight}>{unknownCode}</span> not found</h3>
              <p className={styles.notFoundText}>This room doesn't exist yet. What would you like to do?</p>
              <div className={styles.notFoundBtns}>
                <button className={styles.btnPrimary} onClick={handleCreateWithCode} disabled={loading}>
                  {loading ? <span className="spinner" /> : '🎥'} Create room with this code
                </button>
                <button className={styles.btnSecondary} onClick={() => { setShowRoomOptions(false); setJoinCode(''); }}>
                  Try a different code
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.features}>
          {[
            { icon: '🎥', title: 'HD Video', desc: 'WebRTC peer-to-peer video — no servers relay your video.' },
            { icon: '🎙️', title: 'Live Transcription', desc: 'Voice-to-text via Web Speech API.' },
            { icon: '✨', title: 'AI Notes', desc: 'Gemini generates summaries, decisions & action items.' },
            { icon: '💬', title: 'In-Meeting Chat', desc: 'Real-time messaging via Socket.IO.' },
            { icon: '🖥️', title: 'Screen Share', desc: 'Share your entire screen or a single window.' },
            { icon: '🔒', title: 'Password Rooms', desc: 'Protect meetings with an optional password.' },
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
