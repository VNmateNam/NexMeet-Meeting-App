import React, { useState } from 'react';
import styles from './EndScreen.module.css';

export default function EndScreen({ stats, summary, transcript, onNewMeeting, onHome }) {
  const [savedTranscript, setSavedTranscript] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);

  const flashSave = (setter) => {
    setter(true);
    setTimeout(() => setter(false), 2000);
  };
  const exportTranscript = () => {
    if (!transcript?.length) return;
    const text = transcript.map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speaker}: ${t.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexmeet-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportNotes = () => {
    if (!summary) return;
    const lines = [
      '# Meeting Notes\n',
      `## Overview\n${summary.overview}\n`,
      summary.keyPoints?.length ? `## Key Points\n${summary.keyPoints.map(p => `- ${p}`).join('\n')}\n` : '',
      summary.decisions?.length ? `## Decisions\n${summary.decisions.map(d => `- ${d}`).join('\n')}\n` : '',
      summary.actionItems?.length ? `## Action Items\n${summary.actionItems.map(a => `- [ ] ${a.task} (${a.owner}${a.due ? `, due: ${a.due}` : ''})`).join('\n')}\n` : '',
      summary.nextSteps ? `## Next Steps\n${summary.nextSteps}\n` : '',
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexmeet-notes-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.wave}>👋</div>
        <h1 className={styles.title}>Meeting Ended</h1>
        <p className={styles.sub}>Your transcript and AI notes have been saved.</p>

        {stats && (
          <div className={styles.statsGrid}>
            <Stat label="Duration" value={stats.duration} />
            <Stat label="Participants" value={stats.participantCount} />
            <Stat label="Messages" value={stats.messageCount} />
            <Stat label="Transcript lines" value={stats.transcriptLines} />
          </div>
        )}

        {summary && (
          <div className={styles.summaryPreview}>
            <div className={styles.previewLabel}>✨ AI Summary ready</div>
            <p className={styles.previewText}>{summary.overview}</p>
            {summary.actionItems?.length > 0 && (
              <div className={styles.actionCount}>
                {summary.actionItems.length} action item{summary.actionItems.length > 1 ? 's' : ''} identified
              </div>
            )}
          </div>
        )}

        <div className={styles.exportBtns}>
          {transcript?.length > 0 && (
            <button
              className={`${styles.exportBtn} ${savedTranscript ? styles.exportBtnSuccess : ''}`}
              onClick={() => { exportTranscript(); flashSave(setSavedTranscript); }}
            >
              {savedTranscript ? '✓ Saved!' : '📄 Export Transcript'}
            </button>
          )}
          {summary && (
            <button
              className={`${styles.exportBtn} ${savedNotes ? styles.exportBtnSuccess : ''}`}
              onClick={() => { exportNotes(); flashSave(setSavedNotes); }}
            >
              {savedNotes ? '✓ Saved!' : '📝 Export Notes (.md)'}
            </button>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={onNewMeeting}>Start new meeting</button>
          <button className={styles.btnSecondary} onClick={onHome}>View history</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value ?? '—'}</div>
    </div>
  );
}
