import React, { useState } from 'react';
import { api } from '../utils/api';
import { useCopy } from '../hooks/useCopy';
import styles from './NotesPanel.module.css';

export default function NotesPanel({ transcript, onSummaryGenerated }) {
  const [summary, setSummary] = useState(null);
  const { copied: notesCopied, copy: copyNotes } = useCopy();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const generate = async () => {
    if (!transcript || transcript.length === 0) {
      setError('No transcript yet — start speaking first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { summary: s } = await api.summarize(transcript);
      setSummary(s);
      onSummaryGenerated?.(s);
    } catch (e) {
      setError('Could not reach AI. Check your API key.');
    }
    setLoading(false);
  };

  const askQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim() || !transcript?.length) return;
    setAsking(true);
    const q = question.trim();
    setQuestion('');
    try {
      const { answer: a } = await api.askAboutMeeting(q, transcript, chatHistory);
      const newHistory = [...chatHistory, { role: 'user', content: q }, { role: 'assistant', content: a }];
      setChatHistory(newHistory.slice(-10));
      setAnswer(a);
    } catch {
      setAnswer('Failed to get answer. Please try again.');
    }
    setAsking(false);
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.content}>
        {!summary && !loading && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✨</div>
            <p>Generate AI-powered meeting notes from your transcript.</p>
            {error && <span className={styles.error}>{error}</span>}
          </div>
        )}

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Analyzing transcript with Claude…</p>
          </div>
        )}

        {summary && (
          <div className={styles.summary}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryLabel}>AI Meeting Notes</span>
              <div className={styles.summaryActions}>
                {saved
                  ? <span className={styles.savedBadge}>✓ Saved</span>
                  : <button className={styles.saveBtn} onClick={save}>Save</button>
                }
                <button className={`${styles.copyBtn} ${notesCopied ? styles.copyBtnSuccess : ''}`} onClick={() => {
                  const text = [
                    `Overview:\n${summary.overview}`,
                    `\nKey Points:\n${summary.keyPoints?.map(p => `• ${p}`).join('\n')}`,
                    `\nDecisions:\n${summary.decisions?.map(d => `• ${d}`).join('\n')}`,
                    `\nAction Items:\n${summary.actionItems?.map(a => `• ${a.task} (${a.owner})`).join('\n')}`,
                  ].join('');
                  copyNotes(text);
                }}>{notesCopied ? '✓ Copied!' : '📋 Copy'}</button>
              </div>
            </div>

            <Section title="Overview" content={summary.overview} />

            {summary.keyPoints?.length > 0 && (
              <Section title="Key Points">
                <ul className={styles.list}>
                  {summary.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </Section>
            )}

            {summary.decisions?.length > 0 && (
              <Section title="Decisions Made">
                <ul className={styles.list}>
                  {summary.decisions.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </Section>
            )}

            {summary.actionItems?.length > 0 && (
              <Section title="Action Items">
                {summary.actionItems.map((a, i) => (
                  <div key={i} className={styles.actionItem}>
                    <span className={styles.aiTask}>{a.task}</span>
                    <div className={styles.aiMeta}>
                      <span className={styles.aiOwner}>👤 {a.owner}</span>
                      {a.due && <span className={styles.aiDue}>📅 {a.due}</span>}
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {summary.nextSteps && <Section title="Next Steps" content={summary.nextSteps} />}

            {summary.topics?.length > 0 && (
              <div className={styles.topics}>
                {summary.topics.map(t => <span key={t} className={styles.topic}>{t}</span>)}
              </div>
            )}

            {/* Ask AI about the meeting */}
            <div className={styles.askSection}>
              <div className={styles.askLabel}>Ask about this meeting</div>
              {answer && <div className={styles.answer}>{answer}</div>}
              <form className={styles.askForm} onSubmit={askQuestion}>
                <input
                  className={styles.askInput}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="e.g. What were the main decisions?"
                />
                <button type="submit" className={styles.askBtn} disabled={asking || !question.trim()}>
                  {asking ? '…' : '→'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {!summary && (
        <button className={styles.generateBtn} onClick={generate} disabled={loading}>
          {loading
            ? <><span className={styles.spinner} /> Generating…</>
            : '✨ Generate AI Summary'
          }
        </button>
      )}

      {summary && (
        <button className={styles.regenBtn} onClick={generate} disabled={loading}>
          ↻ Regenerate
        </button>
      )}
    </div>
  );
}

function Section({ title, content, children }) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {content && <p className={styles.sectionText}>{content}</p>}
      {children}
    </div>
  );
}
