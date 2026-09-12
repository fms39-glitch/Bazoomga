# Zamily Feud — Node.js + TypeScript (server) / Python (AI agents)

Two independent services, run side by side:

```
zamily-feud-v2/
├── node-server/              <- Node.js + TypeScript: game state, WebSocket, player-facing API
│   ├── src/
│   │   ├── server.ts         (Express + WebSocket server, main entry point)
│   │   ├── gameState.ts      (in-memory board/question state)
│   │   ├── agentClient.ts    (HTTP client that calls the Python agent service)
│   │   └── types.ts          (shared TypeScript types)
│   ├── public/
│   │   └── index.html        (test frontend — plain browser page, no Zoom yet)
│   ├── package.json
│   └── tsconfig.json
│
├── python-agent-service/     <- Python + FastAPI: ONLY the two AI agents, nothing else
│   ├── agents.py             (HostAgent + FuzzyJudgeAgent, talk to local Ollama)
│   ├── main.py               (thin API exposing /cluster, /match, /host/*)
│   └── requirements.txt
│
└── README.md                 <- you are here
```

**How the pieces talk to each other:**

```
Browser (public/index.html)
   |  WebSocket (ws://localhost:4000)
   v
Node.js server  (node-server, port 4000)
   |  HTTP (http://localhost:8000)
   v
Python agent service  (python-agent-service, port 8000)
   |  HTTP (http://localhost:11434)
   v
Ollama (running your local LLM)
```

You will run **three** things locally: Ollama (background service), the Python agent
service, and the Node server. Order matters — start them in this order.

---

## Step 1 — Install & start Ollama

```bash
# Install from https://ollama.com/download, then:
ollama pull llama3.2:3b
ollama run llama3.2:3b "say hello"   # quick sanity check
```

Ollama runs its own background server at `http://localhost:11434` automatically once installed.

## Step 2 — Start the Python agent service

```bash
cd python-agent-service
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Leave this terminal running. Confirm it's alive:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

If you pulled a different Ollama model, set it before starting uvicorn:
```bash
export OLLAMA_MODEL="llama3.1:8b"     # Windows: set OLLAMA_MODEL=llama3.1:8b
```

## Step 3 — Start the Node.js server

Open a **second terminal**:

```bash
cd node-server
npm install
npm run dev
```

You should see:
```
Zamily Feud node-server listening on http://localhost:4000
Agent service expected at http://localhost:8000
```

`npm run dev` uses `tsx` to run the TypeScript directly with auto-reload on save.
For a production-style run instead: `npm run build` then `npm start` (runs the
compiled JS from `dist/`).

**Requires Node.js 18 or newer** (the code uses the built-in global `fetch` —
no extra HTTP library needed). Check with `node --version`.

## Step 4 — Test it in your browser

Open **http://localhost:4000**. This is the same test page as before, but now
talking over a **WebSocket** instead of plain HTTP requests — this is the piece
that will matter once multiple real players are connected at once (in Zoom,
each participant's browser context becomes one of these WebSocket connections).

1. Use the pre-filled example (okra/ladyfinger/carrot/carrots/broccoli) and
   click **Start Round**. You should see the board come back with **3 entries**,
   not 5 — that's the Fuzzy Judge Agent clustering working.
2. Type a guess like "dog" or "veggie" variants and click **Guess** — watch the
   host line react and the board reveal if it's a match.
3. Open the page in a **second browser tab** — you'll see both tabs receive the
   same board updates and host lines live, since they're both connected to the
   same WebSocket broadcast. This is your first real test of multiplayer sync.

---

## Why split it this way (recap)

- **Node.js/TypeScript** owns: WebSocket connections, game state, board logic,
  and — later — the actual Zoom Apps SDK frontend (which must be JS/React
  regardless). Good at handling many simultaneous live connections cheaply.
- **Python** owns: the two AI agents (`HostAgent`, `FuzzyJudgeAgent`) and
  nothing else. It has no idea a "game" exists — it just receives a question +
  answers, or a guess + board, and returns a result. This keeps the AI logic
  swappable (e.g., you could later put a different model or a cloud LLM behind
  the exact same `/cluster` and `/host/*` endpoints without touching Node at all).

---

## Troubleshooting

- **Node server logs "Agent service error on /cluster: ... ECONNREFUSED"** →
  the Python service (Step 2) isn't running, or isn't on port 8000. Check that
  terminal first.
- **Python service hangs on a request** → Ollama isn't running, or
  `OLLAMA_MODEL` doesn't match a model you've actually pulled (`ollama list`
  to check).
- **`npm run dev` fails with a fetch-related type error** → confirm
  `node --version` is 18+; older Node doesn't have global `fetch`.
- **WebSocket won't connect from the browser** → make sure you're loading the
  page from `http://localhost:4000` (served by the Node server itself), not
  opening `public/index.html` directly as a `file://` URL — the WebSocket URL
  in the page is relative to whatever host served it.

## Next steps
1. Tune `HOST_SYSTEM_PROMPT` / `JUDGE_SYSTEM_PROMPT` in `python-agent-service/agents.py`.
2. Replace the "paste raw answers" textarea with real per-player input (one
   WebSocket message per player instead of one big pasted block).
3. Add rooms/sessions to `gameState.ts` so multiple simultaneous games don't
   share one global board.
4. Once this feels solid, build a Zoom Apps SDK frontend that talks to the
   same Node WebSocket server — the backend doesn't need to change.
