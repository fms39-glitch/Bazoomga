import type { Server } from "socket.io";
import { EVENTS } from "./events";
import { GameRoomManager, type RoomState } from "./gameRoom";
import { startAnswerTimer } from "./judgingFlow";
import { announceSpeaking } from "./speakingPhase";
import { beginSurvey, completeSurvey } from "./surveyFlow";

const assistantTimers = new Map<string, NodeJS.Timeout[]>();

function clearAssistantTimers(code: string) {
  const handles = assistantTimers.get(code) ?? [];
  for (const handle of handles) clearTimeout(handle);
  assistantTimers.delete(code);
}

function schedule(io: Server, manager: GameRoomManager, code: string, delayMs: number, fn: () => void) {
  const handle = setTimeout(fn, delayMs);
  const list = assistantTimers.get(code) ?? [];
  list.push(handle);
  assistantTimers.set(code, list);
}

function broadcast(io: Server, manager: GameRoomManager, room: RoomState) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const socketId of sockets) {
    const playerId = room.socketToPlayer.get(socketId);
    io.to(socketId).emit(EVENTS.ROOM_STATE, manager.publicState(room, playerId));
  }
  io.to(room.code).emit(EVENTS.AGENT_LOG, { log: room.agentLog.slice(-30) });
}

function participatingCount(room: RoomState): number {
  return [...room.players.values()].filter((p) => p.connected && p.participating).length;
}

function announce(io: Server, manager: GameRoomManager, room: RoomState) {
  announceSpeaking(io, manager, room, (ioServer, current) => startAnswerTimer(ioServer, manager, current));
}

export async function runAssistantPipeline(io: Server, manager: GameRoomManager, code: string) {
  const room = manager.getRoom(code);
  if (!room || room.agentStopped || room.config.managementMode !== "assistant") return;

  clearAssistantTimers(code);
  room.agentRunning = true;
  room.agentStopped = false;

  manager.addAgentLog(room, "thinking", "Assistant online. I'll run the full show.");
  broadcast(io, manager, room);

  const playerCount = [...room.players.values()].filter((p) => p.connected).length;
  room.config.questionCount = Math.min(8, Math.max(3, playerCount >= 6 ? 5 : 3));
  room.config.humorLevel = room.config.humorLevel || "family";
  room.config.answerMode = "text";
  manager.addAgentLog(
    room,
    "decision",
    `${room.config.questionCount} rounds, ${room.config.humorLevel} humor, text answers.`
  );
  broadcast(io, manager, room);

  if (room.phase === "polling" || room.phase === "planning") {
    manager.addAgentLog(room, "action", "Survey running — answer your personal questions!");
    broadcast(io, manager, room);
    return;
  }

  if (participatingCount(room) < 2) {
    manager.addAgentLog(room, "thinking", "Waiting for at least 2 players to join...");
    broadcast(io, manager, room);
    schedule(io, manager, code, 2000, () => {
      void runAssistantPipeline(io, manager, code);
    });
    return;
  }

  if (room.phase === "lobby" || room.phase === "ready") {
    schedule(io, manager, code, 800, () => {
      const current = manager.getRoom(code);
      if (!current || current.agentStopped) return;
      if (current.phase !== "lobby" && current.phase !== "ready") return;
      manager.addAgentLog(current, "action", "Launching personalized survey for everyone...");
      broadcast(io, manager, current);
      void beginSurvey(io, manager, code, async (c) => {
        const updated = await completeSurvey(io, manager, c);
        if (updated?.phase === "speaking") announce(io, manager, updated);
        await assistantAfterSurvey(io, manager, c);
      });
    });
  }
}

export async function assistantAfterSurvey(io: Server, manager: GameRoomManager, code: string) {
  const room = manager.getRoom(code);
  if (!room || room.agentStopped || room.config.managementMode !== "assistant") return;

  if (room.phase === "speaking") {
    manager.addAgentLog(room, "action", "First face-off — listen for the host!");
    broadcast(io, manager, room);
    announce(io, manager, room);
    return;
  }

  if (room.phase === "invite") {
    manager.addAgentLog(room, "action", "Opt-in players detected — starting face-offs shortly.");
    broadcast(io, manager, room);
    schedule(io, manager, code, 3000, () => {
      const r = manager.getRoom(code);
      if (!r || r.agentStopped || r.phase !== "invite") return;
      void manager.startFaceOff(r, (progressRoom) => {
        broadcast(io, manager, progressRoom);
      }).then((started) => {
        broadcast(io, manager, started);
        announce(io, manager, started);
      });
    });
  }
}

export function assistantAfterReveal(io: Server, manager: GameRoomManager, code: string) {
  const room = manager.getRoom(code);
  if (!room || room.agentStopped || room.config.managementMode !== "assistant") return;

  schedule(io, manager, code, 7000, () => {
    const current = manager.getRoom(code);
    if (!current || current.agentStopped || current.phase !== "reveal") return;
    manager.addAgentLog(current, "action", "Rotating to the next face-off...");
    void manager.nextFaceOff(current, (progressRoom) => {
      broadcast(io, manager, progressRoom);
    }).then((next) => {
      broadcast(io, manager, next);
      announce(io, manager, next);
    });
  });
}

export function stopAssistant(code: string) {
  clearAssistantTimers(code);
}

export function cleanupAssistant(code: string) {
  clearAssistantTimers(code);
}
