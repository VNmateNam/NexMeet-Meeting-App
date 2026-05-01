const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'nexmeet-dev-secret-change-in-production';

// Simple guest auth — no password required
// In production: integrate Firebase Auth or Supabase Auth

// POST /api/auth/guest
router.post('/guest', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }

  const userId = uuidv4();
  const user = { userId, name: name.trim(), role: 'guest' };

  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });

  res.json({ success: true, user, token });
});

// POST /api/auth/verify
router.post('/verify', (req, res) => {
  const { token } = req.body;
  try {
    const user = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, user });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
