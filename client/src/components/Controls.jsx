import React, { useState } from 'react';
import styles from './Controls.module.css';

const REACTIONS = ['👍', '❤️', '😂', '😮', '👏', '🎉'];

export default function Controls({ muted, videoOff, screenSharing, onToggleMute, onToggleVideo, onScreenShare, onReaction, onEndMeeting }) {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <ControlBtn
          onClick={onToggleMute}
          active={!muted}
          off={muted}
          icon={muted ? '🔇' : '🎤'}
          label={muted ? 'Unmute' : 'Mute'}
        />
        <ControlBtn
          onClick={onToggleVideo}
          active={!videoOff}
          off={videoOff}
          icon={videoOff ? '📵' : '📹'}
          label={videoOff ? 'Start video' : 'Stop video'}
        />
        <ControlBtn
          onClick={onScreenShare}
          active={screenSharing}
          icon="🖥️"
          label={screenSharing ? 'Stop share' : 'Share screen'}
        />
      </div>

      <div className={styles.center}>
        <div className={styles.reactionWrap}>
          <ControlBtn icon="😊" label="React" onClick={() => setShowReactions(r => !r)} />
          {showReactions && (
            <div className={styles.reactionPicker}>
              {REACTIONS.map(e => (
                <button
                  key={e}
                  className={styles.emojiBtn}
                  onClick={() => { onReaction(e); setShowReactions(false); }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.right}>
        <button className={styles.endBtn} onClick={onEndMeeting}>
          📞 End Call
        </button>
      </div>
    </div>
  );
}

function ControlBtn({ icon, label, onClick, active, off }) {
  return (
    <button
      className={`${styles.btn} ${off ? styles.offBtn : ''} ${active ? styles.activeBtn : ''}`}
      onClick={onClick}
      title={label}
    >
      <span className={styles.btnIcon}>{icon}</span>
      <span className={styles.btnLabel}>{label}</span>
    </button>
  );
}
