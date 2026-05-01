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

// Build allowed origins list
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow any vercel.app or railway.app subdomain
    if (origin.endsWith('.vercel.app') || origin.endsWith('.railway.app')) {
      return callback(null, true);
    }
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow local network
    if (/^http:\/\/(localhost|192\.168\.|10\.|172\.)/.test(origin)) {
      return callback(null, true);
    }
    callback(null, true); // permissive for now — tighten after testing
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

const io = new Server(server, {
  cors: corsOptions,
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight for ALL routes
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/meetings', meetingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/debug', debugRoutes);

app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  allowedOrigins,
}));

// Socket.IO
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 NexMeet server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for WebRTC signaling`);
  console.log(`🌍 Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✓ Connected' : '✗ No API key'}\n`);
});

module.exports = { app, server, io };
