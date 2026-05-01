# NexMeet 🎥✨

> Real-time video conferencing with AI-powered meeting notes, live transcription, and persistent meeting history.

![NexMeet](https://img.shields.io/badge/NexMeet-v1.0.0-4f7cff?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python)

---

## Features

| Feature | Technology |
|---|---|
| HD Video Calls | WebRTC (peer-to-peer) |
| Real-time Signaling | Socket.IO |
| Live Transcription | Web Speech API + OpenAI Whisper |
| AI Meeting Notes | Google Gemini 1.5 Flash (free) |
| In-meeting Chat | Socket.IO |
| Screen Sharing | `getDisplayMedia` API |
| Emoji Reactions | Socket.IO broadcast |
| Meeting History | Zustand + localStorage |
| Export Notes | Markdown `.md` download |
| Export Transcript | Plain text download |

---

## Project Structure

```
nexmeet/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # VideoGrid, Controls, ChatPanel, NotesPanel, …
│   │   ├── hooks/           # useWebRTC, useSocket, useMedia, useTranscription
│   │   ├── pages/           # HomePage, MeetingPage, HistoryPage
│   │   ├── store/           # Zustand user + history store
│   │   └── utils/           # API client
│   └── Dockerfile
├── server/                  # Node.js + Express + Socket.IO
│   ├── routes/              # /api/meetings, /api/auth, /api/ai
│   ├── controllers/         # WebRTC signaling via Socket.IO
│   └── Dockerfile
├── python-transcription/    # Flask + OpenAI Whisper microservice
│   ├── app.py
│   └── Dockerfile
└── docker-compose.yml
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- A **Google Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com/app/apikey) (1,500 req/day free tier)
- An **OpenAI API key** (for Whisper transcription — optional, Web Speech API works for free)

### 1. Clone & install

```bash
git clone https://github.com/yourname/nexmeet.git
cd nexmeet
npm install
```

### 2. Configure environment

```bash
# Server
cp server/.env.example server/.env
# → Fill in GEMINI_API_KEY (free at aistudio.google.com) and JWT_SECRET

# Client (usually no changes needed in dev)
cp client/.env.example client/.env

# Python (optional – only needed for Whisper)
cp python-transcription/.env.example python-transcription/.env
# → Fill in OPENAI_API_KEY
```

### 3. Start development servers

```bash
# Start Node server + React client together
npm run dev

# In a separate terminal (optional – for Whisper transcription)
cd python-transcription
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5173**

---

## Running with Docker

```bash
# Copy and fill .env files first, then:
docker-compose up --build
```

Services:
- `http://localhost:5173` — React client
- `http://localhost:3001` — Node.js API + Socket.IO
- `http://localhost:8000` — Python Whisper service

---

## API Reference

### Authentication
```
POST /api/auth/guest     { name }           → { user, token }
POST /api/auth/verify    { token }          → { user }
```

### Meetings
```
POST /api/meetings/create          { hostName, title } → { meeting }
GET  /api/meetings/:id             → { meeting }
POST /api/meetings/:id/end         { duration }        → { meeting }
POST /api/meetings/:id/transcript  { lines }           → { count }
POST /api/meetings/:id/summary     { summary }         → { success }
GET  /api/meetings                 → { meetings }
```

### AI
```
POST /api/ai/summarize       { transcript, meetingTitle? } → { summary }
POST /api/ai/action-items    { transcript }               → { actionItems }
POST /api/ai/chat            { question, transcript }     → { answer }
```

### Whisper (Python microservice)
```
POST /transcribe             multipart: { audio, language?, speaker? } → { text, words }
POST /transcribe/url         { url, language?, speaker? }              → { text }
```

---

## Socket.IO Events

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomId, userId, name }` | Join a meeting room |
| `leave-room` | `{ roomId }` | Leave the room |
| `offer` | `{ to, offer, roomId }` | WebRTC offer |
| `answer` | `{ to, answer }` | WebRTC answer |
| `ice-candidate` | `{ to, candidate, roomId }` | ICE candidate |
| `media-state` | `{ roomId, muted, videoOff, screenSharing }` | Sync media state |
| `chat-message` | `{ roomId, message }` | Send chat message |
| `transcript-line` | `{ roomId, text }` | Broadcast transcript line |
| `reaction` | `{ roomId, emoji }` | Send emoji reaction |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `room-joined` | `{ participants, you }` | Confirmed join + existing peers |
| `participant-joined` | `{ socketId, name, color }` | New peer joined |
| `participant-left` | `{ socketId, name }` | Peer disconnected |
| `offer` / `answer` / `ice-candidate` | Forwarded | WebRTC signaling relay |
| `participant-media-state` | `{ socketId, muted, videoOff }` | Peer media change |
| `chat-message` | `{ id, from, text, time }` | Broadcast message |
| `transcript-line` | `{ speaker, text, timestamp }` | Remote transcript |
| `reaction` | `{ from, emoji }` | Emoji reaction |

---

## WebRTC Flow

```
Peer A joins room → server emits participant-joined to Peer B
Peer B creates offer → sends to Peer A via server
Peer A creates answer → sends back to Peer B via server
ICE candidates exchanged → direct P2P connection established
Video/audio streams flow peer-to-peer (no server relay)
```

> **Production note**: Add a TURN server for users behind strict NATs/firewalls.
> Services: [Twilio TURN](https://www.twilio.com/docs/stun-turn), [Metered](https://www.metered.ca/tools/openrelay/), [coturn](https://github.com/coturn/coturn) (self-hosted).

---

## Transcription Notes

Two transcription methods are supported:

1. **Web Speech API** (built-in, browser-side) — Works in Chrome/Edge, no API key needed. Used for live captions during the meeting.

2. **OpenAI Whisper** (Python microservice) — Higher accuracy, supports more languages, works on any browser. Send audio chunks to `POST /transcribe`.

To send audio to Whisper from the client:
```js
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
recorder.ondataavailable = async ({ data }) => {
  const form = new FormData();
  form.append('audio', data, 'chunk.webm');
  form.append('speaker', userName);
  const res = await fetch('http://localhost:8000/transcribe', { method: 'POST', body: form });
  const { text } = await res.json();
  // emit to socket
};
recorder.start(5000); // chunk every 5s
```

---

## Production Deployment

### Environment variables to set in production:
```
# Server
NODE_ENV=production
JWT_SECRET=<strong-random-string>
GEMINI_API_KEY=AIza...         # free at aistudio.google.com
CLIENT_URL=https://yourdomain.com

# Client (build-time)
VITE_SOCKET_URL=https://yourdomain.com
```

### Recommended infrastructure:
- **Client**: Vercel, Netlify, or Nginx static hosting
- **Server**: Railway, Render, Fly.io, or a VPS (needs WebSocket support)
- **Python**: Railway, Render, or same VPS
- **Database**: Supabase or Firebase for persistent meeting storage
- **TURN server**: Metered.ca free tier or Twilio

---

## Extending with Firebase / Supabase

The server uses an in-memory store for meetings by default. To add persistence:

**Firebase (Firestore)**:
1. Create a Firebase project
2. Fill in `FIREBASE_*` env vars in `server/.env`
3. Replace `meetings` Map in `server/routes/meetings.js` with Firestore calls

**Supabase**:
1. Create a Supabase project and a `meetings` table
2. Fill in `SUPABASE_*` env vars
3. Use `@supabase/supabase-js` in the server routes

---

## License

MIT © 2025 NexMeet
