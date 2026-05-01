require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const meetingRoutes = require('./routes/meetings');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const debugRoutes = require('./routes/debug');
const { setupSocketHandlers } = require('./controllers/socketController');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || 'http://localhost:5173',
      /^http:\/\/192\.168\./,   // allow any 192.168.x.x (local network)
      /^http:\/\/10\./,          // allow 10.x.x.x
      /^http:\/\/172\./,         // allow 172.x.x.x
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/meetings', meetingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/debug', debugRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Socket.IO
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 NexMeet server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for WebRTC signaling`);
  console.log(`🤖 Gemini AI:    ${process.env.GEMINI_API_KEY ? '✓ Connected' : '✗ No API key (get one free at aistudio.google.com)'}\n`);
});

module.exports = { app, server, io };
