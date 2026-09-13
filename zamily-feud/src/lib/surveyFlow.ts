import type { Server } from "socket.io";
import { EVENTS } from "./events";
import { GameRoomManager, type RoomState } from "./gameRoom";

const surveyHandles = new Map<string, NodeJS.Timeout>();

function broadcast(io: Server, manager: GameRoomManager, room: RoomState) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const socketId of sockets) {
    const playerId = room.socketToPlayer.get(socketId);
    io.to(socketId).emit(EVENTS.ROOM_STATE, manager.publicState(room, playerId));
  }
}

export function clearSurveyTimer(code: string) {
  const handle = surveyHandles.get(code);
  if (handle) {
    clearTimeout(handle);
    surveyHandles.delete(code);
  }
}

export function scheduleSurveyExpiry(io: Server, manager: GameRoomManager, room: RoomState, finishSurvey: (code: string) => void) {
  clearSurveyTimer(room.code);
  if (room.phase !== "polling" || !room.gamePlan || !room.surveyStartedAt) return;

  const endsAt = room.surveyStartedAt + room.gamePlan.surveySecondsPerPlayer * 1000;
  const delay = Math.max(0, endsAt - Date.now());
  const code = room.code;

  const handle = setTimeout(() => {
    surveyHandles.delete(code);
    const current = manager.getRoom(code);
    if (!current || current.phase !== "polling") return;
    manager.forceCompleteSurvey(current);
    broadcast(io, manager, current);
    finishSurvey(code);
  }, delay);
  surveyHandles.set(code, handle);
}

export async function beginSurvey(
  io: Server,
  manager: GameRoomManager,
  code: string,
  finishSurvey: (code: string) => Promise<void>
) {
  const room = manager.getRoom(code);
  if (!room) return;
  if (room.phase !== "lobby" && room.phase !== "ready") return;

  broadcast(io, manager, room);
  const result = await manager.prepareSurvey(room, (progressRoom) => {
    broadcast(io, manager, progressRoom);
  });

  if (result === "not_enough") {
    manager.addAgentLog(room, "error", "Need at least 2 participating players to start.");
    room.phase = "lobby";
    broadcast(io, manager, room);
    return;
  }

  broadcast(io, manager, result);
  scheduleSurveyExpiry(io, manager, result, (c) => {
    void finishSurvey(c);
  });
}

export async function completeSurvey(
  io: Server,
  manager: GameRoomManager,
  code: string
): Promise<RoomState | null> {
  const room = manager.getRoom(code);
  if (!room || room.phase !== "polling" || room.surveyFinishing) return null;

  clearSurveyTimer(code);
  room.agentRunning = true;
  manager.addAgentLog(room, "thinking", "Survey complete — building face-off boards...");
  broadcast(io, manager, room);

  const updated = await manager.finishSurvey(room, (progressRoom) => {
    broadcast(io, manager, progressRoom);
  });
  broadcast(io, manager, updated);
  return updated;
}
