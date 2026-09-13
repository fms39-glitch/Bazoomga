import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

import { gameState } from "./gameState";
import * as agent from "./agentClient";
import { ClientMessage, ServerMessage, ConnectedUser } from "./types";
import { randomUUID } from "crypto";

const PORT = Number(process.env.PORT ?? 4000);
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? "http://localhost:8000";

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// TTS proxy: browser calls /api/tts?text=... → we call Python /tts → audio
// ---------------------------------------------------------------------------
app.get("/api/tts", async (req, res) => {
  const text = req.query.text as string;
  if (!text) { res.status(400).json({ error: "text required" }); return; }
  try {
    const ttsRes = await fetch(`${AGENT_SERVICE_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!ttsRes.ok) {
      res.status(ttsRes.status).json({ error: "TTS service error" });
      return;
    }
    const buffer = await ttsRes.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "no-store");
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("TTS proxy error:", err);
    res.status(500).json({ error: "TTS unavailable" });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
}

const clients = new Set<ExtendedWebSocket>();

function broadcast(message: ServerMessage) {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastLobbyUpdate() {
  broadcast({ type: "lobby_update", users: gameState.users, phase: gameState.phase });
}

function broadcastPollProgress() {
  broadcast({
    type: "poll_progress",
    submitted: gameState.pollSubmittedCount(),
    total: gameState.audienceCount(),
  });
}

function currentBoardMessage(): ServerMessage {
  return {
    type: "board_update",
    question: gameState.question(),
    board: gameState.publicBoard(),
  };
}

wss.on("connection", (socket: ExtendedWebSocket) => {
  clients.add(socket);
  socket.userId = randomUUID();
  console.log(`Client connected: ${socket.userId}. Total: ${clients.size}`);

  socket.send(JSON.stringify({ type: "lobby_update", users: gameState.users, phase: gameState.phase }));

  socket.on("message", async (raw) => {
    let message: ClientMessage;
    try { message = JSON.parse(raw.toString()); }
    catch { return; }

    try {
      if (message.type === "join_lobby") {
        gameState.addUser({ id: socket.userId!, name: message.name, role: message.role });
        broadcastLobbyUpdate();
      } else if (message.type === "host_start_polling") {
        const questions = await agent.generateQuestions();
        gameState.startPolling(questions);
        broadcastLobbyUpdate();
        broadcast({ type: "start_polling", questions });
        broadcastPollProgress();
      } else if (message.type === "submit_poll_answers") {
        gameState.submitPoll(socket.userId!, message.answers);
        broadcastPollProgress();
        // Auto-proceed once every audience member has answered
        if (gameState.allAudienceSubmitted()) {
          console.log("All audience submitted — auto-starting game...");
          await handleStartGame(0);
        }
      } else if (message.type === "host_start_game") {
        await handleStartGame(message.questionIndex);
      } else if (message.type === "guess") {
        await handleGuess(message.guess);
      }
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    if (socket.userId) {
      gameState.removeUser(socket.userId);
      broadcastLobbyUpdate();
      if (gameState.phase === "POLLING") broadcastPollProgress();
    }
    console.log(`Client disconnected. Total: ${clients.size}`);
  });
});

async function handleStartGame(index: number) {
  const question = gameState.questions[index];
  if (!question) return;

  const rawAnswersMap = gameState.pollingAnswers[index] || {};
  const rawAnswers = Object.values(rawAnswersMap).filter((a) => a.trim() !== "");
  if (rawAnswers.length === 0) rawAnswers.push("Nothing");

  const clusters = await agent.clusterAnswers(question, rawAnswers);
  gameState.startGame(index, clusters);
  broadcastLobbyUpdate();

  const introLine = await agent.hostIntro(question);
  broadcast({ type: "host_line", text: introLine });
  broadcast(currentBoardMessage());
}

async function handleGuess(guess: string) {
  const question = gameState.question();
  if (!question) return;

  const unrevealed = gameState.unrevealedLabels();
  const match = await agent.matchGuess(question, guess, unrevealed);

  if (match) {
    const result = gameState.reveal(match);
    if (result) {
      const line = await agent.hostReveal(question, result.entry.label, result.entry.count, result.rank);
      broadcast({ type: "guess_result", result: "hit", guess });
      broadcast({ type: "host_line", text: line });
      broadcast(currentBoardMessage());
      return;
    }
  }

  const line = await agent.hostWrong(guess);
  broadcast({ type: "guess_result", result: "miss", guess });
  broadcast({ type: "host_line", text: line });
}

server.listen(PORT, () => {
  console.log(`Zamily Feud node-server listening on http://localhost:${PORT}`);
  console.log(`Agent service expected at ${AGENT_SERVICE_URL}`);
});
