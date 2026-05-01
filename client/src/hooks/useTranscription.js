import { useState, useRef, useCallback, useEffect } from 'react';

export function useTranscription({ onLine, enabled = true }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const recognitionRef = useRef(null);
  const restartTimerRef = useRef(null);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const supported = Boolean(SpeechRecognition);

  const addLine = useCallback((speaker, text) => {
    const line = { speaker, text, timestamp: Date.now() };
    setTranscript(prev => [...prev, line]);
    onLine?.(line);
  }, [onLine]);

  const start = useCallback((speakerName = 'You') => {
    if (!SpeechRecognition || isListening) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text.length > 3) addLine(speakerName, text);
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        console.error('[Transcription] Microphone permission denied');
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current === recognition) {
        restartTimerRef.current = setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (e) { console.error(e); }
  }, [SpeechRecognition, isListening, addLine]);

  const stop = useCallback(() => {
    clearTimeout(restartTimerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { transcript, isListening, supported, start, stop, addLine };
}
