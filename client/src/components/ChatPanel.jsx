import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ messages, onSend }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <span>💬</span>
            <p>No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((m, i) => {
          if (m.type === 'system') {
            return (
              <div key={m.id || i} className={styles.system}>{m.text}</div>
            );
          }
          const isMe = m.socketId === 'local' || m.from === 'You';
          return (
            <div key={m.id || i} className={`${styles.msg} ${isMe ? styles.me : ''}`}>
              {!isMe && <div className={styles.msgAuthor}>{m.from}</div>}
              <div className={styles.bubble}>{m.text}</div>
              <div className={styles.msgTime}>{m.time}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Message everyone…"
          maxLength={500}
        />
        <button className={styles.sendBtn} onClick={send} disabled={!input.trim()}>➤</button>
      </div>
    </div>
  );
}
