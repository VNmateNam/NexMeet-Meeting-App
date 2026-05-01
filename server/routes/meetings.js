const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory store — replace with Firebase/Supabase in production
const meetings = new Map();

// Generate unique room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/meetings/create
router.post('/create', (req, res) => {
  const { hostName, title } = req.body;
  const meetingId = uuidv4();
  const roomCode = generateRoomCode();

  const meeting = {
    id: meetingId,
    roomCode,
    title: title || 'Untitled Meeting',
    hostName,
    createdAt: new Date().toISOString(),
    status: 'active',
    participants: [],
    transcript: [],
    summary: null,
  };

  meetings.set(meetingId, meeting);
  meetings.set(roomCode, meeting); // also index by code

  res.json({ success: true, meeting: { id: meetingId, roomCode, title: meeting.title } });
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

  const { lines } = req.body;
  meeting.transcript.push(...lines);

  res.json({ success: true, count: meeting.transcript.length });
});

// POST /api/meetings/:id/summary
router.post('/:id/summary', (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

  meeting.summary = req.body.summary;
  res.json({ success: true });
});

// GET /api/meetings — list all (paginated in production)
router.get('/', (req, res) => {
  const list = [...new Set(meetings.values())]
    .filter(m => m.id) // deduplicate
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
  res.json({ success: true, meetings: list });
});

module.exports = router;
