import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import styles from './HistoryPage.module.css';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { meetingHistory, user } = useUserStore();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [savedExport, setSavedExport] = useState(false);

  const flashExport = () => { setSavedExport(true); setTimeout(() => setSavedExport(false), 2000); };

  const filtered = meetingHistory.filter(m =>
    (m.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.date || '').includes(search)
  );

  const meeting = selected ? meetingHistory.find(m => m.id === selected) : null;

  const exportNotes = (m) => {
    if (!m.summary) return;
    const s = m.summary;
    const lines = [
      `# ${m.title || 'Meeting Notes'}\n`,
      `Date: ${m.date}\nDuration: ${m.duration}\n`,
      `## Overview\n${s.overview}\n`,
      s.keyPoints?.length ? `## Key Points\n${s.keyPoints.map(p => `- ${p}`).join('\n')}\n` : '',
      s.decisions?.length ? `## Decisions\n${s.decisions.map(d => `- ${d}`).join('\n')}\n` : '',
      s.actionItems?.length
        ? `## Action Items\n${s.actionItems.map(a => `- [ ] ${a.task} (${a.owner}${a.due ? `, due: ${a.due}` : ''})`).join('\n')}\n`
        : '',
      s.nextSteps ? `## Next Steps\n${s.nextSteps}\n` : '',
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexmeet-${(m.title || 'notes').replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← Back</button>
        <div className={styles.logo}>NexMeet</div>
        <button className={styles.newBtn} onClick={() => navigate('/')}>+ New Meeting</button>
      </header>

      <div className={styles.body}>
        {/* List */}
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <h2>Meeting History</h2>
            <span className={styles.count}>{meetingHistory.length} meetings</span>
          </div>
          <input
            className={styles.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meetings…"
          />
          {filtered.length === 0 && (
            <div className={styles.emptyList}>
              {search ? 'No meetings match your search.' : 'No meetings yet. Start your first one!'}
            </div>
          )}
          {filtered.map(m => (
            <div
              key={m.id}
              className={`${styles.item} ${selected === m.id ? styles.activeItem : ''}`}
              onClick={() => setSelected(m.id)}
            >
              <div className={styles.itemIcon}>{m.summary ? '✨' : '🎥'}</div>
              <div className={styles.itemBody}>
                <div className={styles.itemTitle}>{m.title || 'Untitled Meeting'}</div>
                <div className={styles.itemMeta}>
                  <span>{m.date}</span>
                  {m.duration && <span>{m.duration}</span>}
                  {m.participants && <span>{m.participants} people</span>}
                </div>
              </div>
              {m.summary && <span className={styles.notesBadge}>Notes</span>}
            </div>
          ))}
        </div>

        {/* Detail */}
        <div className={styles.detail}>
          {!meeting && (
            <div className={styles.noSelection}>
              <span className={styles.noSelIcon}>📋</span>
              <p>Select a meeting to view its notes and transcript.</p>
            </div>
          )}

          {meeting && (
            <div className={styles.detailContent} key={meeting.id}>
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>{meeting.title || 'Untitled Meeting'}</h2>
                  <div className={styles.detailMeta}>
                    {meeting.date && <span>📅 {meeting.date}</span>}
                    {meeting.duration && <span>⏱ {meeting.duration}</span>}
                    {meeting.participants && <span>👥 {meeting.participants} participants</span>}
                    {meeting.roomCode && <span>🔑 {meeting.roomCode}</span>}
                  </div>
                </div>
                <div className={styles.detailActions}>
                  {meeting.summary && (
                    <button
                      className={`${styles.exportBtn} ${savedExport ? styles.exportBtnSuccess : ''}`}
                      onClick={() => { exportNotes(meeting); flashExport(); }}
                    >
                      {savedExport ? '✓ Saved!' : '📝 Export .md'}
                    </button>
                  )}
                </div>
              </div>

              {meeting.summary ? (
                <div className={styles.summaryView}>
                  <SummarySection title="Overview" text={meeting.summary.overview} />

                  {meeting.summary.keyPoints?.length > 0 && (
                    <SummarySection title="Key Points">
                      <ul className={styles.ul}>
                        {meeting.summary.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </SummarySection>
                  )}

                  {meeting.summary.decisions?.length > 0 && (
                    <SummarySection title="Decisions Made">
                      <ul className={styles.ul}>
                        {meeting.summary.decisions.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </SummarySection>
                  )}

                  {meeting.summary.actionItems?.length > 0 && (
                    <SummarySection title="Action Items">
                      {meeting.summary.actionItems.map((a, i) => (
                        <div key={i} className={styles.actionItem}>
                          <span className={styles.actionTask}>{a.task}</span>
                          <span className={styles.actionOwner}>👤 {a.owner}</span>
                          {a.due && <span className={styles.actionDue}>📅 {a.due}</span>}
                        </div>
                      ))}
                    </SummarySection>
                  )}

                  {meeting.summary.nextSteps && (
                    <SummarySection title="Next Steps" text={meeting.summary.nextSteps} />
                  )}

                  {meeting.summary.topics?.length > 0 && (
                    <div className={styles.topics}>
                      {meeting.summary.topics.map(t => (
                        <span key={t} className={styles.topic}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.noNotes}>
                  <span>📭</span>
                  <p>No AI notes were generated for this meeting.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummarySection({ title, text, children }) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {text && <p className={styles.sectionText}>{text}</p>}
      {children}
    </div>
  );
}
