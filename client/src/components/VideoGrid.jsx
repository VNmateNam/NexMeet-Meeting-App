import React, { useEffect, useRef } from 'react';
import styles from './VideoGrid.module.css';

const COLORS = ['#4f7cff', '#7c5cff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6'];

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function VideoTile({ participant, index }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const color = participant.color || COLORS[index % COLORS.length];
  const showVideo = participant.stream && !participant.videoOff;

  return (
    <div
      className={`${styles.tile} ${participant.isLocal ? styles.local : ''}`}
      style={{ '--accent-color': color }}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={participant.isLocal}
          playsInline
          className={styles.video}
        />
      ) : (
        <div className={styles.avatar} style={{ background: color + '22', color }}>
          {getInitials(participant.name)}
        </div>
      )}

      <div className={styles.label}>
        {participant.muted && <span className={styles.muteIcon}>🔇</span>}
        <span>{participant.isLocal ? 'You' : participant.name}</span>
        {participant.isLocal && <span className={styles.hostTag}>Host</span>}
      </div>

      {participant.screenSharing && (
        <div className={styles.screenShareBadge}>🖥️ Sharing</div>
      )}
    </div>
  );
}

export default function VideoGrid({ participants }) {
  const count = participants.length;

  const gridClass = count <= 1
    ? styles.grid1
    : count === 2
    ? styles.grid2
    : count <= 4
    ? styles.grid4
    : count <= 6
    ? styles.grid6
    : styles.grid9;

  return (
    <div className={`${styles.grid} ${gridClass}`}>
      {participants.map((p, i) => (
        <VideoTile key={p.socketId || i} participant={p} index={i} />
      ))}
    </div>
  );
}
