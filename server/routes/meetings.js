const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory store — replace with Firebase/Supabase in production
const meetings = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// POST /api/meetings/create
router.post('/create', (req, res) => {
  const { hostName, title, password } = req.body;
  const meetingId = uuidv4();
  const roomCode = generateRoomCode();

  const meeting = {
    id: meetingId,
    roomCode,
    title: title || 'Untitled Meeting',
    hostName,
    password: password || null,      // optional room password
    createdAt: new Date().toISOString(),
    status: 'active',
    participants: [],
    transcript: [],
    summary: null,
  };

  meetings.set(meetingId, meeting);
  meetings.set(roomCode, meeting);

  res.json({ success: true, meeting: { id: meetingId, roomCode, title: meeting.title, hasPassword: !!password } });
});

// GET /api/meetings/check/:code — check if a room code exists
router.get('/check/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const meeting = meetings.get(code);
  if (!meeting || meeting.status === 'ended') {
    return res.json({ exists: false });
  }
  res.json({
    exists: true,
    title: meeting.title,
    hostName: meeting.hostName,
    hasPassword: !!meeting.password,
    participantCount: meeting.participants?.length || 0,
  });
});

// POST /api/meetings/join — verify password if room has one
router.post('/join', (req, res) => {
  const { roomCode, password } = req.body;
  const code = roomCode?.toUpperCase();
  const meeting = meetings.get(code);

  if (!meeting || meeting.status === 'ended') {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  if (meeting.password && meeting.password !== password) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  res.json({ success: true, meeting: { id: meeting.id, roomCode: code, title: meeting.title } });
});

// GET /api/meetings/:id
router.get('/:id', (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  res.json({ success: true, meeting });
});

// POST /api/meetings/:id/end
router.post('/:id/end', (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  meeting.status = 'ended';
  meeting.endedAt = new Date().toISOString();
  meeting.duration = req.body.duration;
  res.json({ success: true, meeting });
});

// POST /api/meetings/:id/transcript
router.post('/:id/transcript', (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  meeting.transcript.push(...(req.body.lines || []));
  res.json({ success: true, count: meeting.transcript.length });
});

// POST /api/meetings/:id/summary
router.post('/:id/summary', (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  meeting.summary = req.body.summary;
  res.json({ success: true });
});

// GET /api/meetings
router.get('/', (req, res) => {
  const list = [...new Set(meetings.values())]
    .filter(m => m.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
  res.json({ success: true, meetings: list });
});

module.exports = router;
