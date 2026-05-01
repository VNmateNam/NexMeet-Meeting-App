import React, { useEffect, useRef, useState } from 'react';
import { translateLine, translateBatch, getApiKey, testApiKey } from '../utils/translate';
import { useCopy } from '../hooks/useCopy';
import styles from './TranscriptPanel.module.css';

const LANGUAGES = [
  { code: 'es',    label: 'Spanish',               flag: '🇪🇸' },
  { code: 'fr',    label: 'French',                flag: '🇫🇷' },
  { code: 'de',    label: 'German',                flag: '🇩🇪' },
  { code: 'it',    label: 'Italian',               flag: '🇮🇹' },
  { code: 'pt',    label: 'Portuguese',            flag: '🇵🇹' },
  { code: 'ru',    label: 'Russian',               flag: '🇷🇺' },
  { code: 'zh',    label: 'Chinese (Simplified)',  flag: '🇨🇳' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', flag: '🇹🇼' },
  { code: 'ja',    label: 'Japanese',              flag: '🇯🇵' },
  { code: 'ko',    label: 'Korean',                flag: '🇰🇷' },
  { code: 'ar',    label: 'Arabic',                flag: '🇸🇦' },
  { code: 'hi',    label: 'Hindi',                 flag: '🇮🇳' },
  { code: 'bn',    label: 'Bengali',               flag: '🇧🇩' },
  { code: 'tr',    label: 'Turkish',               flag: '🇹🇷' },
  { code: 'nl',    label: 'Dutch',                 flag: '🇳🇱' },
  { code: 'pl',    label: 'Polish',                flag: '🇵🇱' },
  { code: 'sv',    label: 'Swedish',               flag: '🇸🇪' },
  { code: 'da',    label: 'Danish',                flag: '🇩🇰' },
  { code: 'fi',    label: 'Finnish',               flag: '🇫🇮' },
  { code: 'uk',    label: 'Ukrainian',             flag: '🇺🇦' },
  { code: 'el',    label: 'Greek',                 flag: '🇬🇷' },
  { code: 'he',    label: 'Hebrew',                flag: '🇮🇱' },
  { code: 'th',    label: 'Thai',                  flag: '🇹🇭' },
  { code: 'vi',    label: 'Vietnamese',            flag: '🇻🇳' },
  { code: 'id',    label: 'Indonesian',            flag: '🇮🇩' },
  { code: 'ms',    label: 'Malay',                 flag: '🇲🇾' },
  { code: 'cs',    label: 'Czech',                 flag: '🇨🇿' },
  { code: 'ro',    label: 'Romanian',              flag: '🇷🇴' },
  { code: 'sw',    label: 'Swahili',               flag: '🇰🇪' },
  { code: 'tl',    label: 'Filipino',              flag: '🇵🇭' },
];

export default function TranscriptPanel({ transcript, isLive, supported, onStart, onStop }) {
  const bottomRef = useRef(null);

  const { copied: transcriptCopied, copy: copyTranscript } = useCopy();
  const [translationOn, setTranslationOn] = useState(false);
  const [targetLang, setTargetLang]       = useState('es');
  const [translatedMap, setTranslatedMap] = useState({});
  const [pending, setPending]             = useState(new Set());
  const [showDropdown, setShowDropdown]   = useState(false);
  const [langSearch, setLangSearch]       = useState('');
  const [error, setError]                 = useState('');
  const [testing, setTesting]             = useState(false);
  const [testResult, setTestResult]       = useState('');

  // Use a run-id so switching languages cancels in-flight requests
  const runId   = useRef(0);
  const prevLen = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, translatedMap]);

  // ── Translate all lines (batch) ──────────────────────────────────────────
  const doTranslateAll = async (lines, langCode, rid) => {
    if (!lines.length) return;
    setError('');
    setPending(new Set(lines.map((_, i) => i)));
    setTranslatedMap({});

    try {
      const results = await translateBatch(lines, langCode);
      if (rid !== runId.current) return; // stale — language changed
      const map = {};
      results.forEach((l, i) => { map[i] = l.text; });
      setTranslatedMap(map);
      setPending(new Set());
    } catch (err) {
      if (rid !== runId.current) return;
      setError(err.message);
      setPending(new Set());
      // fallback: translate line by line so partial results still show
      for (let i = 0; i < lines.length; i++) {
        if (rid !== runId.current) return;
        try {
          const result = await translateLine(lines[i].text, langCode);
          setTranslatedMap(prev => ({ ...prev, [i]: result }));
          setPending(prev => { const s = new Set(prev); s.delete(i); return s; });
          setError(''); // cleared once at least one succeeds
        } catch (e) {
          setError(e.message);
          setPending(prev => { const s = new Set(prev); s.delete(i); return s; });
        }
      }
    }
  };

  // ── Live: translate new lines as they arrive ─────────────────────────────
  useEffect(() => {
    if (!translationOn || targetLang === 'en') return;
    if (transcript.length <= prevLen.current) return;

    const newLines  = transcript.slice(prevLen.current);
    const startIdx  = prevLen.current;
    prevLen.current = transcript.length;

    
    

    const rid = runId.current;
    setPending(prev => {
      const s = new Set(prev);
      newLines.forEach((_, o) => s.add(startIdx + o));
      return s;
    });

    newLines.forEach(async (line, offset) => {
      const idx = startIdx + offset;
      try {
        const result = await translateLine(line.text, targetLang);
        if (rid !== runId.current) return;
        setTranslatedMap(prev => ({ ...prev, [idx]: result }));
        setPending(prev => { const s = new Set(prev); s.delete(idx); return s; });
        setError('');
      } catch (err) {
        if (rid !== runId.current) return;
        setError(err.message);
        setPending(prev => { const s = new Set(prev); s.delete(idx); return s; });
      }
    });
  }, [transcript, translationOn, targetLang]);

  // ── Toggle translation on/off ────────────────────────────────────────────
  const handleToggle = () => {
    const next = !translationOn;
    setTranslationOn(next);
    setError('');
    setTestResult('');
    if (!next) {
      runId.current += 1;
      setTranslatedMap({});
      setPending(new Set());
      prevLen.current = 0;
      return;
    }
    if (transcript.length > 0) {
      
      runId.current += 1;
      prevLen.current = transcript.length;
      doTranslateAll(transcript, targetLang, runId.current);
    }
  };

  // ── Change language ──────────────────────────────────────────────────────
  const handleLangSelect = (code) => {
    setTargetLang(code);
    setShowDropdown(false);
    setLangSearch('');
    setError('');
    setTestResult('');

    if (!translationOn || !transcript.length) return;
    
    runId.current += 1;
    prevLen.current = transcript.length;
    doTranslateAll(transcript, code, runId.current);
  };

  // ── Test API key ─────────────────────────────────────────────────────────
  const handleTest = async () => {
    setTesting(true);
    setTestResult('');
    setError('');
    try {
      const { model, result } = await testApiKey();
      setTestResult(`✅ Working! Model: ${model} — Result: "${result}"`);
      setError('');
    } catch (err) {
      setError(err.message);
      setTestResult('');
    }
    setTesting(false);
  };

  const selectedLang  = LANGUAGES.find(l => l.code === targetLang);
  const filteredLangs = LANGUAGES.filter(l =>
    l.label.toLowerCase().includes(langSearch.toLowerCase())
  );
  const hasKey = Boolean(getApiKey());

  return (
    <div className={styles.panel}>

      {/* Top bar */}
      <div className={styles.header}>
        <div className={styles.status}>
          {isLive
            ? <><span className={styles.liveDot} />Live</>
            : <span style={{ color: 'var(--text3)' }}>Paused</span>
          }
        </div>
        {supported
          ? <button className={`${styles.toggleBtn} ${isLive ? styles.stopBtn : styles.startBtn}`} onClick={isLive ? onStop : onStart}>
              {isLive ? 'Pause' : 'Start'}
            </button>
          : <span className={styles.unsupported}>Not supported</span>
        }
      </div>

      {/* Translation bar */}
      <div className={styles.translateBar}>
        <button
          className={`${styles.translateToggle} ${translationOn ? styles.translateActive : ''}`}
          onClick={handleToggle}
        >
          🌐 {translationOn ? 'Translation on' : 'Translate'}
        </button>

        {translationOn && (
          <div className={styles.langPickerWrap}>
            <button className={styles.langBtn} onClick={() => setShowDropdown(p => !p)}>
              <span>{selectedLang?.flag}</span>
              <span className={styles.langName}>{selectedLang?.label}</span>
              <span className={styles.chevron}>{showDropdown ? '▲' : '▼'}</span>
            </button>

            {showDropdown && (
              <div className={styles.langDropdown}>
                <input
                  className={styles.langSearch}
                  value={langSearch}
                  onChange={e => setLangSearch(e.target.value)}
                  placeholder="Search language…"
                  autoFocus
                />
                <div className={styles.langList}>
                  {filteredLangs.map(l => (
                    <button
                      key={l.code}
                      className={`${styles.langOption} ${l.code === targetLang ? styles.langSelected : ''}`}
                      onClick={() => handleLangSelect(l.code)}
                    >
                      <span>{l.flag}</span>
                      <span>{l.label}</span>
                      {l.code === targetLang && <span className={styles.check}>✓</span>}
                    </button>
                  ))}
                  {!filteredLangs.length && <div className={styles.noResults}>No languages found</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test button — always visible when key exists */}
        {hasKey && (
          <button className={styles.testBtn} onClick={handleTest} disabled={testing}>
            {testing ? '…' : '🧪'}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className={styles.errorBox}>
          <strong>Translation error:</strong> {error}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={styles.successBox}>{testResult}</div>
      )}

      {/* Transcript lines */}
      <div className={styles.lines}>
        {transcript.length === 0 && (
          <div className={styles.empty}>
            <span>🎙️</span>
            <p>Start transcription to see live captions here.</p>
          </div>
        )}

        {transcript.map((t, i) => {
          const isPending      = pending.has(i);
          const hasTranslation = translationOn && translatedMap[i] !== undefined;
          const showTranslation = translationOn;

          return (
            <div key={i} className={styles.line}>
              <div className={styles.speaker}>{t.speaker}</div>

              {showTranslation && (
                <div className={`${styles.translated} ${isPending ? styles.pending : ''}`}>
                  {isPending
                    ? <span className={styles.dots}><span /><span /><span /></span>
                    : hasTranslation
                      ? <>{translatedMap[i]} <span className={styles.langTag}>{selectedLang?.flag} {selectedLang?.label}</span></>
                      : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>translation failed</span>
                  }
                </div>
              )}

              <div className={`${styles.original} ${showTranslation && hasTranslation ? styles.dim : ''}`}>
                {showTranslation && hasTranslation && <span className={styles.origLabel}>original: </span>}
                {t.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {transcript.length > 0 && (
        <div className={styles.footer}>
          <span>{transcript.length} lines</span>
          <button
            className={`${styles.copyBtn} ${transcriptCopied ? styles.copyBtnSuccess : ''}`}
            onClick={() => {
              const text = transcript.map((t, i) => {
                const tr = translationOn && translatedMap[i];
                return tr ? `${t.speaker}: ${tr}\n  (original: ${t.text})` : `${t.speaker}: ${t.text}`;
              }).join('\n');
              copyTranscript(text);
            }}
          >
            {transcriptCopied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
