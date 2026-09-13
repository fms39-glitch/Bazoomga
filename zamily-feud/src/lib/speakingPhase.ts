import type { Server } from "socket.io";
import { EVENTS } from "./events";
import { GameRoomManager, type RoomState } from "./gameRoom";

const speakingHandles = new Map<string, NodeJS.Timeout>();

export function clearSpeakingFallback(code: string) {
  const handle = speakingHandles.get(code);
  if (handle) {
    clearTimeout(handle);
    speakingHandles.delete(code);
  }
}

export function announceSpeaking(
  io: Server,
  manager: GameRoomManager,
  room: RoomState,
  startAnswerTimer: (io: Server, room: RoomState) => void
) {
  if (room.phase !== "speaking") return;

  io.to(room.code).emit(EVENTS.QUESTION_NEW, {
    duel: room.active && room.gamePlan
      ? {
          promptForA: room.gamePlan.questionsById[room.active.questionIdForA] ?? "",
          promptForB: room.gamePlan.questionsById[room.active.questionIdForB] ?? "",
        }
      : null,
  });

  clearSpeakingFallback(room.code);
  const introLen =
    (room.speakText?.length ?? 0) +
    (room.duelBoardForA?.prompt.length ?? 0) +
    (room.duelBoardForB?.prompt.length ?? 0);
  const delay = Math.min(45000, Math.max(12000, introLen * 80));
  const code = room.code;

  const handle = setTimeout(() => {
    speakingHandles.delete(code);
    const current = manager.getRoom(code);
    if (!current || current.phase !== "speaking") return;
    manager.onTtsEnded(current);
    broadcast(io, manager, current);
    startAnswerTimer(io, current);
  }, delay);
  speakingHandles.set(code, handle);
}

function broadcast(io: Server, manager: GameRoomManager, room: RoomState) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const socketId of sockets) {
    const playerId = room.socketToPlayer.get(socketId);
    io.to(socketId).emit(EVENTS.ROOM_STATE, manager.publicState(room, playerId));
  }
}

export function finishSpeaking(
  io: Server,
  manager: GameRoomManager,
  room: RoomState,
  startAnswerTimer: (io: Server, room: RoomState) => void
) {
  clearSpeakingFallback(room.code);
  manager.onTtsEnded(room);
  broadcast(io, manager, room);
  startAnswerTimer(io, room);
}
