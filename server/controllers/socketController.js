const { v4: uuidv4 } = require('uuid');

const rooms = new Map();
// roomId -> { hostSocketId, participants: Map<socketId, participant>, canvas: [] }

const COLORS = ['#4f7cff','#7c5cff','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#8b5cf6'];

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ─── ROOM ─────────────────────────────────────────────────────────────
    socket.on('join-room', ({ roomId, userId, name }) => {
      socket.join(roomId);

      const isNewRoom = !rooms.has(roomId);
      if (isNewRoom) {
        rooms.set(roomId, {
          hostSocketId: socket.id,   // first to join = host
          participants: new Map(),
          canvas: [],                // persistent strokes for late joiners
        });
      }

      const room = rooms.get(roomId);
      const isHost = room.hostSocketId === socket.id;
      const colorIndex = room.participants.size % COLORS.length;

      const participant = {
        userId,
        name,
        color: COLORS[colorIndex],
        socketId: socket.id,
        joinedAt: Date.now(),
        isHost,
      };
      room.participants.set(socket.id, participant);

      // Send existing participants + host info to the new joiner
      const existing = [...room.participants.entries()]
        .filter(([sid]) => sid !== socket.id)
        .map(([, p]) => p);

      socket.emit('room-joined', {
        roomId,
        participants: existing,
        you: participant,
        hostSocketId: room.hostSocketId,
        canvas: room.canvas,         // send existing canvas strokes
      });

      // Tell everyone else
      socket.to(roomId).emit('participant-joined', participant);

      console.log(`[Room ${roomId}] ${name} joined (${isHost ? 'HOST' : 'participant'}). Total: ${room.participants.size}`);
    });

    socket.on('leave-room', ({ roomId }) => leaveRoom(socket, roomId, io));

    // ─── WEBRTC SIGNALING ──────────────────────────────────────────────────
    socket.on('offer',         ({ to, offer })     => io.to(to).emit('offer',         { from: socket.id, offer }));
    socket.on('answer',        ({ to, answer })    => io.to(to).emit('answer',        { from: socket.id, answer }));
    socket.on('ice-candidate', ({ to, candidate }) => io.to(to).emit('ice-candidate', { from: socket.id, candidate }));

    // ─── MEDIA STATE ───────────────────────────────────────────────────────
    socket.on('media-state', ({ roomId, muted, videoOff, screenSharing }) => {
      socket.to(roomId).emit('participant-media-state', { socketId: socket.id, muted, videoOff, screenSharing });
    });

    // ─── CHAT ──────────────────────────────────────────────────────────────
    socket.on('chat-message', ({ roomId, message }) => {
      const room = rooms.get(roomId);
      const p = room?.participants.get(socket.id);
      io.to(roomId).emit('chat-message', {
        id: uuidv4(),
        from: p?.name || 'Unknown',
        socketId: socket.id,
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      });
    });

    // ─── TRANSCRIPTION ─────────────────────────────────────────────────────
    socket.on('transcript-line', ({ roomId, text }) => {
      const room = rooms.get(roomId);
      const p = room?.participants.get(socket.id);
      io.to(roomId).emit('transcript-line', { speaker: p?.name || 'Unknown', text, timestamp: Date.now() });
    });

    // ─── REACTIONS ─────────────────────────────────────────────────────────
    socket.on('reaction', ({ roomId, emoji }) => {
      const room = rooms.get(roomId);
      const p = room?.participants.get(socket.id);
      io.to(roomId).emit('reaction', { from: p?.name, emoji, socketId: socket.id });
    });

    // ─── HOST ENDS MEETING ─────────────────────────────────────────────────
    socket.on('host-end-meeting', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      // Only the host can end for everyone
      if (room.hostSocketId !== socket.id) return;
      io.to(roomId).emit('meeting-ended-by-host', {
        hostName: room.participants.get(socket.id)?.name || 'Host',
      });
      // Clean up room
      rooms.delete(roomId);
      console.log(`[Room ${roomId}] Ended by host.`);
    });

    // ─── COLLABORATIVE CANVAS ──────────────────────────────────────────────
    socket.on('canvas-draw', ({ roomId, stroke }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      // Persist stroke so late joiners get it
      room.canvas.push(stroke);
      // Limit to last 500 strokes to prevent memory bloat
      if (room.canvas.length > 500) room.canvas = room.canvas.slice(-500);
      // Broadcast to everyone else
      socket.to(roomId).emit('canvas-draw', stroke);
    });

    socket.on('canvas-clear', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.canvas = [];
      io.to(roomId).emit('canvas-clear');
    });

    socket.on('canvas-text', ({ roomId, item }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.canvas.push({ type: 'text', ...item });
      socket.to(roomId).emit('canvas-text', item);
    });

    // ─── DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) leaveRoom(socket, roomId, io);
      }
    });

    socket.on('disconnect', () => console.log(`[Socket] Disconnected: ${socket.id}`));
  });
}

function leaveRoom(socket, roomId, io) {
  const room = rooms.get(roomId);
  if (!room) return;

  const participant = room.participants.get(socket.id);
  room.participants.delete(socket.id);
  socket.leave(roomId);

  if (participant) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    io.to(roomId).emit('participant-left', { socketId: socket.id, name: participant.name, time });
    console.log(`[Room ${roomId}] ${participant.name} left. Remaining: ${room.participants.size}`);
  }

  // If host left but room still has people, assign new host
  if (room.participants.size > 0 && room.hostSocketId === socket.id) {
    const newHostEntry = [...room.participants.entries()][0];
    room.hostSocketId = newHostEntry[0];
    newHostEntry[1].isHost = true;
    io.to(roomId).emit('host-changed', { newHostSocketId: newHostEntry[0], newHostName: newHostEntry[1].name });
    console.log(`[Room ${roomId}] New host: ${newHostEntry[1].name}`);
  }

  if (room.participants.size === 0) {
    rooms.delete(roomId);
    console.log(`[Room ${roomId}] Empty, cleaned up.`);
  }
}

module.exports = { setupSocketHandlers };
