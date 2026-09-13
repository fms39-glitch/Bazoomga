# Zamily Feud — Hosting & Zoom SDK

## Quick local run

```powershell
cd zamily-feud
npm install
npm run dev
```

Open http://localhost:3000 (kill anything on port 3000 first if needed).

---

## Environment variables

Copy `.env.local.example` → `.env`:

| Variable | Purpose |
|----------|---------|
| `CARTESIA_API_KEY` | TTS voice (required for host speech) |
| `GROQ_API_KEY` | AI questions, judgment, host lines |
| `GROQ_MODEL` | `openai/gpt-oss-20b` (default) or `qwen/qwen3.6-27b` |
| `CARTESIA_VOICE_ID` | Cartesia voice UUID |
| `PORT` | Server port (default 3000) |

**Important:** The old `llama-3.1-70b-versatile` model is decommissioned. If survey questions look static, check `GROQ_MODEL`.

---

## Production hosting

This app uses a **custom Node server** (`server.ts`) with **Socket.io**. Plain Vercel serverless alone cannot run the game server.

### Recommended: Railway (easiest)

1. Push repo to GitHub.
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub.
3. Set root directory: `zamily-feud`
4. Add env vars from `.env`.
5. Start command: `npm start`
6. Copy the public URL (e.g. `https://zamily-feud-production.up.railway.app`).

### Alternative: Render / Fly.io

Same pattern: Node app, `npm start`, expose port, set env vars, enable WebSockets.

### Vercel split (advanced)

- **Frontend + API routes** on Vercel
- **Socket.io server** on Railway/Render
- Set `NEXT_PUBLIC_SOCKET_URL` to the socket server (requires a small client change)

For MVP testing, use **one Railway deployment** for everything.

---

## Zoom testing (no SDK — works today)

1. Deploy to Railway (or tunnel local with ngrok).
2. Host pastes the game URL into Zoom chat.
3. Everyone opens the link in their browser inside Zoom.
4. Host creates room → players join with code → Start Survey.

---

## Zoom Apps SDK (in-meeting app)

### 1. Create a Zoom App

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/) → **Develop** → **Build App**.
2. Choose **Zoom Apps** (in-client).
3. Set:
   - **Home URL:** `https://YOUR-DOMAIN.com`
   - **Domain allowlist:** your production domain
   - **Redirect URL (OAuth):** `https://YOUR-DOMAIN.com/api/zoom/callback` (when you add OAuth)

4. Save **Client ID** and **Client Secret**.

### 2. Install SDK

```bash
cd zamily-feud
npm install @zoom/appssdk
```

### 3. Add env vars

```
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_ZOOM_CLIENT_ID=your_client_id
```

### 4. Bootstrap in the client

Create `src/components/ZoomProvider.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import zoomSdk from "@zoom/appssdk";

export function ZoomProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void zoomSdk.config({
      capabilities: ["getMeetingContext", "getMeetingParticipants", "openUrl"],
    }).catch(() => undefined);
  }, []);
  return <>{children}</>;
}
```

Wrap your app in `layout.tsx` when `?platform=zoom` or inside Zoom.

### 5. Auto-fill player names

```typescript
const ctx = await zoomSdk.getMeetingContext();
const user = await zoomSdk.getUserContext();
// Pre-fill lobby name from user.displayName
```

### 6. Launch from Zamily game list

When the host clicks "Zamily Feud" in your Zamily platform:

- **Option A:** Open your deployed URL as the Zoom App Home URL.
- **Option B:** Call `zoomSdk.openUrl({ url: "https://YOUR-DOMAIN.com?platform=zoom" })` for all participants.

### 7. Publish

- Complete Zoom App verification checklist.
- Submit for review if distributing outside your account.

---

## Survey algorithm (implemented)

| Input | Meaning |
|-------|---------|
| N | Players in survey |
| Q | Questions field in Host Controls |

**Required unique questions:** `Q × N`

**Survey:** Strict partition — each of the Q×N questions goes to exactly one player (Q per player, zero overlap).

**Face-off:** When A vs B are selected:
- A answers a random question from **B's** survey (unseen by A)
- B answers a random question from **A's** survey (unseen by B)
- Boards use the opponent's real survey answer as the top response

---

## Verify after deploy

1. Two browser tabs → create + join room.
2. Start Survey → questions should be **creative and different** per player (no `(survey 1)` labels).
3. Complete survey → face-off question should be **new to both duelists**.
4. Host tab unmuted → Cartesia TTS plays → 10s timer syncs.
5. Submit answers → Groq judges → reveal with host line.
