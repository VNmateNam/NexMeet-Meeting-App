import React from 'react';
import styles from './ParticipantsPanel.module.css';

const COLORS = ['#4f7cff', '#7c5cff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function ParticipantsPanel({ participants }) {
  return (
    <div className={styles.panel}>
      <div className={styles.count}>{participants.length} participant{participants.length !== 1 ? 's' : ''}</div>
      {participants.map((p, i) => (
        <div key={p.socketId || i} className={styles.row}>
          <div
            className={styles.avatar}
            style={{
              background: (p.color || COLORS[i % COLORS.length]) + '22',
              color: p.color || COLORS[i % COLORS.length],
            }}
          >
            {getInitials(p.name)}
          </div>
          <div className={styles.info}>
            <div className={styles.name}>{p.isLocal ? `${p.name} (You)` : p.name}</div>
            <div className={styles.role}>{p.isLocal ? 'Host' : 'Participant'}</div>
          </div>
          <div className={styles.icons}>
            <span className={p.muted ? styles.off : styles.on} title={p.muted ? 'Muted' : 'Unmuted'}>
              {p.muted ? '🔇' : '🎤'}
            </span>
            <span className={p.videoOff ? styles.off : styles.on} title={p.videoOff ? 'Camera off' : 'Camera on'}>
              {p.videoOff ? '📵' : '📹'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
