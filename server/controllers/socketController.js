const { v4: uuidv4 } = require('uuid');

// In-memory room store (use Redis in production)
const rooms = new Map();
// roomId -> { participants: Map<socketId, { userId, name, color }> }

const COLORS = ['#4f7cff','#7c5cff','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#8b5cf6'];

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ─── ROOM ────────────────────────────────────────────────
    socket.on('join-room', ({ roomId, userId, name }) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) rooms.set(roomId, { participants: new Map() });
      const room = rooms.get(roomId);

      const colorIndex = room.participants.size % COLORS.length;
      const participant = { userId, name, color: COLORS[colorIndex], socketId: socket.id, joinedAt: Date.now() };
      room.participants.set(socket.id, participant);

      // Tell the new user about everyone already in the room
      const existing = [...room.participants.entries()]
        .filter(([sid]) => sid !== socket.id)
        .map(([, p]) => p);

      socket.emit('room-joined', { roomId, participants: existing, you: participant });

      // Tell everyone else about the new user
      socket.to(roomId).emit('participant-joined', participant);

      console.log(`[Room ${roomId}] ${name} joined. Total: ${room.participants.size}`);
    });

    socket.on('leave-room', ({ roomId }) => {
      leaveRoom(socket, roomId, io);
    });

    // ─── WEBRTC SIGNALING ─────────────────────────────────────
    socket.on('offer', ({ to, offer, roomId }) => {
      io.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // ─── MEDIA STATE ─────────────────────────────────────────
    socket.on('media-state', ({ roomId, muted, videoOff, screenSharing }) => {
      socket.to(roomId).emit('participant-media-state', {
        socketId: socket.id,
        muted,
        videoOff,
        screenSharing,
      });
    });

    // ─── CHAT ────────────────────────────────────────────────
    socket.on('chat-message', ({ roomId, message }) => {
      const room = rooms.get(roomId);
      const participant = room?.participants.get(socket.id);
      const msg = {
        id: uuidv4(),
        from: participant?.name || 'Unknown',
        socketId: socket.id,
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      };
      io.to(roomId).emit('chat-message', msg);
    });

    // ─── TRANSCRIPTION ───────────────────────────────────────
    socket.on('transcript-line', ({ roomId, text }) => {
      const room = rooms.get(roomId);
      const participant = room?.participants.get(socket.id);
      const line = {
        speaker: participant?.name || 'Unknown',
        text,
        timestamp: Date.now(),
      };
      // Broadcast to all in room including sender
      io.to(roomId).emit('transcript-line', line);
    });

    // ─── REACTIONS ──────────────────────────────────────────
    socket.on('reaction', ({ roomId, emoji }) => {
      const room = rooms.get(roomId);
      const participant = room?.participants.get(socket.id);
      io.to(roomId).emit('reaction', { from: participant?.name, emoji, socketId: socket.id });
    });

    // ─── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) leaveRoom(socket, roomId, io);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}

function leaveRoom(socket, roomId, io) {
  const room = rooms.get(roomId);
  if (!room) return;

  const participant = room.participants.get(socket.id);
  room.participants.delete(socket.id);
  socket.leave(roomId);

  if (participant) {
    io.to(roomId).emit('participant-left', { socketId: socket.id, name: participant.name });
    console.log(`[Room ${roomId}] ${participant.name} left. Remaining: ${room.participants.size}`);
  }

  if (room.participants.size === 0) {
    rooms.delete(roomId);
    console.log(`[Room ${roomId}] Empty, cleaned up.`);
  }
}

module.exports = { setupSocketHandlers };
