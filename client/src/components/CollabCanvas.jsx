import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './CollabCanvas.module.css';

const COLORS = ['#4f7cff','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4','#f97316','#ffffff','#000000'];
const BRUSHES = [2, 5, 10, 20];

export default function CollabCanvas({ socket, roomId, initialStrokes = [], myName, myColor }) {
  const canvasRef  = useRef(null);
  const isDrawing  = useRef(false);
  const lastPos    = useRef(null);
  const history    = useRef([]);   // for undo

  const [tool, setTool]     = useState('pen');   // pen | eraser | text
  const [color, setColor]   = useState(myColor || '#4f7cff');
  const [brush, setBrush]   = useState(5);
  const [textInput, setTextInput]   = useState('');
  const [textPos, setTextPos]       = useState(null);
  const [showTextBox, setShowTextBox] = useState(false);

  // ── Draw a stroke on canvas ────────────────────────────────────────────
  const drawStroke = useCallback((ctx, stroke) => {
    if (stroke.type === 'text') {
      ctx.font = `${stroke.size || 16}px DM Sans, sans-serif`;
      ctx.fillStyle = stroke.color;
      ctx.fillText(stroke.text, stroke.x, stroke.y);
      return;
    }
    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#0a0c10' : stroke.color;
    ctx.lineWidth   = stroke.tool === 'eraser' ? stroke.size * 3 : stroke.size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.moveTo(stroke.x0, stroke.y0);
    ctx.lineTo(stroke.x1, stroke.y1);
    ctx.stroke();
  }, []);

  // ── Replay all strokes ────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history.current.forEach(s => drawStroke(ctx, s));
  }, [drawStroke]);

  // ── Load initial strokes from server ──────────────────────────────────
  useEffect(() => {
    if (initialStrokes.length) {
      history.current = [...initialStrokes];
      redraw();
    }
  }, [initialStrokes, redraw]);

  // ── Canvas resize ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const resize = () => {
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
      canvas.getContext('2d').putImageData(imageData, 0, 0);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [redraw]);

  // ── Socket events ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('canvas-draw', (stroke) => {
      history.current.push(stroke);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawStroke(ctx, stroke);
    });

    socket.on('canvas-text', (item) => {
      history.current.push({ type: 'text', ...item });
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawStroke(ctx, { type: 'text', ...item });
    });

    socket.on('canvas-clear', () => {
      history.current = [];
      redraw();
    });

    return () => {
      socket.off('canvas-draw');
      socket.off('canvas-text');
      socket.off('canvas-clear');
    };
  }, [socket, drawStroke, redraw]);

  // ── Pointer events ────────────────────────────────────────────────────
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e) => {
    if (tool === 'text') {
      const pos = getPos(e);
      setTextPos(pos);
      setShowTextBox(true);
      setTextInput('');
      return;
    }
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const onPointerMove = (e) => {
    if (!isDrawing.current || tool === 'text') return;
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');

    const stroke = { type: 'draw', tool, color, size: brush, x0: lastPos.current.x, y0: lastPos.current.y, x1: pos.x, y1: pos.y };
    drawStroke(ctx, stroke);
    history.current.push(stroke);
    socket?.emit('canvas-draw', { ...stroke, roomId });

    lastPos.current = pos;
  };

  const onPointerUp = () => { isDrawing.current = false; lastPos.current = null; };

  const submitText = () => {
    if (!textInput.trim() || !textPos) { setShowTextBox(false); return; }
    const item = { type: 'text', text: textInput.trim(), x: textPos.x, y: textPos.y, color, size: brush * 3 + 10, author: myName };
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawStroke(ctx, item);
    history.current.push(item);
    socket?.emit('canvas-text', { ...item, roomId });
    setShowTextBox(false);
    setTextInput('');
    setTextPos(null);
  };

  const handleClear = () => {
    history.current = [];
    redraw();
    socket?.emit('canvas-clear', { roomId });
  };

  const handleUndo = () => {
    history.current.pop();
    redraw();
  };

  return (
    <div className={styles.wrap}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Tools */}
        <div className={styles.toolGroup}>
          {[{ id: 'pen', icon: '✏️' }, { id: 'eraser', icon: '⬜' }, { id: 'text', icon: '𝐓' }].map(t => (
            <button key={t.id} className={`${styles.toolBtn} ${tool === t.id ? styles.activeTool : ''}`}
              onClick={() => setTool(t.id)} title={t.id}>
              {t.icon}
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        {/* Colors */}
        <div className={styles.colorPalette}>
          {COLORS.map(c => (
            <button key={c} className={`${styles.colorBtn} ${color === c ? styles.activeColor : ''}`}
              style={{ background: c, borderColor: c === '#ffffff' ? '#555' : c }}
              onClick={() => setColor(c)} />
          ))}
        </div>

        <div className={styles.divider} />

        {/* Brush sizes */}
        <div className={styles.brushGroup}>
          {BRUSHES.map(b => (
            <button key={b} className={`${styles.brushBtn} ${brush === b ? styles.activeBrush : ''}`}
              onClick={() => setBrush(b)}>
              <span style={{ width: b + 4, height: b + 4, borderRadius: '50%', background: color, display: 'block' }} />
            </button>
          ))}
        </div>

        <div className={styles.spacer} />

        {/* Actions */}
        <button className={styles.actionBtn} onClick={handleUndo} title="Undo">↩️</button>
        <button className={styles.actionBtn} onClick={handleClear} title="Clear all">🗑️</button>
      </div>

      {/* Canvas */}
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />

        {/* Floating text input */}
        {showTextBox && textPos && (
          <div className={styles.textBox} style={{ left: textPos.x, top: textPos.y }}>
            <input
              autoFocus
              className={styles.textInput}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitText(); if (e.key === 'Escape') setShowTextBox(false); }}
              placeholder="Type then press Enter"
            />
          </div>
        )}
      </div>

      <div className={styles.hint}>
        🎨 Everyone in the room can draw — changes sync in real time
      </div>
    </div>
  );
}
