import type { Server } from "socket.io";
import { EVENTS } from "./events";
import { clearAnswerTimer, startAnswerTimer as emitAnswerTimer } from "./answerTimer";
import { GameRoomManager, type RoomState } from "./gameRoom";
import { judgeAnswers } from "./judge";

function broadcast(io: Server, manager: GameRoomManager, room: RoomState) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const socketId of sockets) {
    const playerId = room.socketToPlayer.get(socketId);
    io.to(socketId).emit(EVENTS.ROOM_STATE, manager.publicState(room, playerId));
  }
}

export async function runJudging(io: Server, manager: GameRoomManager, code: string) {
  const room = manager.getRoom(code);
  if (!room || room.phase !== "answering" || !room.active) return;

  clearAnswerTimer(code);
  manager.addAgentLog(room, "thinking", "Judging answers with Groq...");
  broadcast(io, manager, room);
  manager.moveToJudging(room);
  broadcast(io, manager, room);

  const boardA = room.duelBoardForA;
  const boardB = room.duelBoardForB;
  if (!boardA || !boardB) {
    room.phase = "ended";
    broadcast(io, manager, room);
    return;
  }

  const answerA = room.privateAnswers.get(room.active.playerAId)?.text ?? "";
  const answerB = room.privateAnswers.get(room.active.playerBId)?.text ?? "";

  const resultA = await judgeAnswers(boardA, [{ playerId: room.active.playerAId, answer: answerA }], room.config);
  const resultB = await judgeAnswers(boardB, [{ playerId: room.active.playerBId, answer: answerB }], room.config);

  const judgments = [...resultA.judgments, ...resultB.judgments];
  const hostLine = [resultA.hostLine, resultB.hostLine].filter(Boolean).join(" ");

  manager.addAgentLog(room, "decision", "Judgment complete — revealing results!");
  broadcast(io, manager, room);
  manager.applyJudgments(room, judgments, hostLine);
  broadcast(io, manager, room);
  io.to(code).emit(EVENTS.ANSWER_REVEAL, { reveal: room.reveal });
  const { assistantAfterReveal } = await import("./assistant");
  assistantAfterReveal(io, manager, code);
}

export function startAnswerTimer(io: Server, manager: GameRoomManager, room: RoomState) {
  emitAnswerTimer(io, manager, room, (ioServer, code) => {
    void runJudging(ioServer, manager, code);
  });
}
