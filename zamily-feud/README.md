# Zamily Feud

AI-hosted Family Feud for Zoom meetings and the web. Same URL works in a browser tab or pasted into a Zoom meeting chat.

## Quick start

```bash
cd zamily-feud
npm install
npm run dev
```

Open **http://localhost:3000**

## Environment

Copy `.env.local.example` to `.env` or `.env.local`:

```
CARTESIA_API_KEY=your_key
GROQ_API_KEY=your_key
CARTESIA_VOICE_ID=69267136-1bdc-412f-ad78-0caad210fb40
GROQ_MODEL=openai/gpt-oss-20b
PORT=3000
```

## Test in a browser (2 tabs)

1. Tab 1: enter your name → **Create Room**. Note the room code in the header.
2. Tab 2: enter name + room code → **Join Room**.
3. Tab 1 (host): use the right-side **Host Controls** → **Start Game**.
4. Both tabs: AI reads the question (Cartesia TTS) → 10-second timer → active players answer → Groq judges → reveal → next face-off.

## Test in Zoom

1. Deploy to Vercel (or use a tunnel like ngrok for local testing).
2. Host pastes the game URL into Zoom chat.
3. Everyone opens the link in their browser inside Zoom.
4. Host creates the room; players join with the room code.

## Architecture

- **Next.js 14** — UI + API routes (`/api/tts`, `/api/judge`, `/api/health`)
- **Custom Node server** (`server.ts`) — Socket.io real-time game state at `/api/socket`
- **Cartesia** — question TTS
- **Groq** — answer judgment and scoring

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production Next.js build |
| `npm start` | Production server |
