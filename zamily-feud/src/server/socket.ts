import type { Server, Socket } from "socket.io";
import { EVENTS } from "../lib/events";
import {
  cleanupAssistant,
  runAssistantPipeline,
  stopAssistant,
} from "../lib/assistant";
import { GameRoomManager, type RoomState } from "../lib/gameRoom";
import { clearAnswerTimer } from "../lib/answerTimer";
import { runJudging, startAnswerTimer } from "../lib/judgingFlow";
import { beginSurvey, clearSurveyTimer, completeSurvey } from "../lib/surveyFlow";
import { announceSpeaking, finishSpeaking } from "../lib/speakingPhase";
import type { GameConfig } from "../lib/types";

const manager = new GameRoomManager();

function broadcast(io: Server, room: RoomState) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const socketId of sockets) {
    const playerId = room.socketToPlayer.get(socketId);
    io.to(socketId).emit(EVENTS.ROOM_STATE, manager.publicState(room, playerId));
  }
}

function clearTimer(code: string) {
  clearAnswerTimer(code);
}

async function finishSurvey(io: Server, code: string) {
  const updated = await completeSurvey(io, manager, code);
  if (updated?.phase === "speaking") {
    announceSpeaking(io, manager, updated, (ioServer, room) => startAnswerTimer(ioServer, manager, room));
  }
  if (updated) {
    const { assistantAfterSurvey } = await import("../lib/assistant");
    await assistantAfterSurvey(io, manager, code);
  }
}

async function startSurveyFlow(io: Server, code: string) {
  await beginSurvey(io, manager, code, (c) => finishSurvey(io, c));
  const room = manager.getRoom(code);
  if (room?.config.managementMode === "assistant" && !room.agentStopped && room.phase === "polling") {
    void runAssistantPipeline(io, manager, code);
  }
}

async function startFaceOff(io: Server, room: RoomState) {
  const updated = await manager.startFaceOff(room, (progressRoom) => {
    broadcast(io, progressRoom);
  });
  broadcast(io, updated);
  announceSpeaking(io, manager, updated, (ioServer, room) => startAnswerTimer(ioServer, manager, room));
}

function getRoomForSocket(socket: Socket): RoomState | null {
  const code = socket.data.roomCode as string | undefined;
  if (!code) return null;
  return manager.getRoom(code) ?? null;
}

function getPlayerId(socket: Socket, room: RoomState): string | undefined {
  return manager.getPlayerId(room, socket.id);
}

export function attachGameServer(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on(EVENTS.ROOM_CREATE, ({ name }: { name: string }) => {
      const trimmed = name?.trim() || "Host";
      const { room, playerId } = manager.createRoom(socket.id, trimmed);
      socket.data.roomCode = room.code;
      socket.join(room.code);
      socket.emit(EVENTS.ROOM_CREATED, {
        roomCode: room.code,
        playerId,
        state: manager.publicState(room, playerId),
      });
      broadcast(io, room);
    });

    socket.on(EVENTS.ROOM_JOIN, ({ roomCode, name }: { roomCode: string; name: string }) => {
      const result = manager.joinRoom(roomCode, socket.id, name?.trim() || "Player");
      if (!result) {
        socket.emit(EVENTS.ROOM_ERROR, { message: "Room not found. Check the code and try again." });
        return;
      }

      socket.data.roomCode = result.room.code;
      socket.join(result.room.code);
      socket.emit(EVENTS.ROOM_JOINED, {
        roomCode: result.room.code,
        playerId: result.playerId,
        state: manager.publicState(result.room, result.playerId),
      });
      broadcast(io, result.room);
      if (
        result.room.config.managementMode === "assistant" &&
        !result.room.agentStopped &&
        (result.room.phase === "lobby" || result.room.phase === "ready")
      ) {
        void runAssistantPipeline(io, manager, result.room.code);
      }
    });

    socket.on(EVENTS.HOST_CONFIGURE, (patch: Partial<GameConfig>) => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      const wasAssistant = room.config.managementMode === "assistant";
      manager.configure(room, patch);
      broadcast(io, room);
      if (!wasAssistant && room.config.managementMode === "assistant" && !room.agentStopped) {
        void runAssistantPipeline(io, manager, room.code);
      }
    });

    socket.on(EVENTS.HOST_START_SURVEY, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      void startSurveyFlow(io, room.code);
    });

    socket.on(EVENTS.HOST_START, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;

      if (room.phase === "lobby" || room.phase === "ready") {
        void startSurveyFlow(io, room.code);
        return;
      }

      if (room.phase === "invite") {
        void startFaceOff(io, room);
        return;
      }

      if (room.phase === "reveal") {
        clearTimer(room.code);
        void manager.nextFaceOff(room, (progressRoom) => {
          broadcast(io, progressRoom);
        }).then((next) => {
          broadcast(io, next);
          announceSpeaking(io, manager, next, (ioServer, room) => startAnswerTimer(ioServer, manager, room));
        });
      }
    });

    socket.on("host:begin", () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      void startFaceOff(io, room);
    });

    socket.on(EVENTS.SURVEY_SUBMIT, ({ answers }: { answers: string[] }) => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId) return;

      const result = manager.submitSurvey(room, playerId, answers);
      if (result === "invalid") {
        socket.emit(EVENTS.ROOM_ERROR, { message: "Could not submit survey. Answer every question." });
        return;
      }

      broadcast(io, room);
      if (manager.allSurveySubmitted(room)) {
        void finishSurvey(io, room.code);
      }
    });

    socket.on(EVENTS.PLAYER_ACCEPT, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId) return;
      manager.acceptInvite(room, playerId);
      broadcast(io, room);
    });

    socket.on(EVENTS.PLAYER_DECLINE, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId) return;
      manager.declineInvite(room, playerId);
      broadcast(io, room);
    });

    socket.on(EVENTS.TTS_ENDED, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      if (room.phase !== "speaking") return;
      finishSpeaking(io, manager, room, (ioServer, current) => startAnswerTimer(ioServer, manager, current));
    });

    socket.on(EVENTS.PLAYER_ANSWER, ({ text }: { text: string }) => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId) return;

      const result = manager.submitAnswer(room, playerId, text);
      if (result === "not_active" || result === "already_submitted") return;

      broadcast(io, room);
      if (manager.bothAnsweredOrExpired(room)) {
        void runJudging(io, manager, room.code);
      }
    });

    socket.on(EVENTS.HOST_PAUSE, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      clearTimer(room.code);
      manager.pause(room);
      broadcast(io, room);
    });

    socket.on(EVENTS.HOST_RESUME, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      manager.resume(room);
      broadcast(io, room);
      startAnswerTimer(io, manager, room);
    });

    socket.on(EVENTS.HOST_STOP, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      clearTimer(room.code);
      clearSurveyTimer(room.code);
      stopAssistant(room.code);
      manager.stop(room);
      broadcast(io, room);
    });

    socket.on(EVENTS.HOST_FORCE_NEXT, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      clearTimer(room.code);

      if (room.phase === "answering") {
        void runJudging(io, manager, room.code);
        return;
      }

      void manager.forceNext(room, (progressRoom) => {
        broadcast(io, progressRoom);
      }).then((next) => {
        broadcast(io, next);
        announceSpeaking(io, manager, next, (ioServer, room) => startAnswerTimer(ioServer, manager, room));
      });
    });

    socket.on(EVENTS.HOST_SWITCH_MODE, ({ mode }: { mode: "text" | "speak" }) => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      manager.switchMode(room, mode);
      broadcast(io, room);
    });

    socket.on(EVENTS.HOST_QUESTION_READY, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      clearTimer(room.code);
      void manager.nextFaceOff(room, (progressRoom) => {
        broadcast(io, progressRoom);
      }).then((next) => {
        broadcast(io, next);
        announceSpeaking(io, manager, next, (ioServer, room) => startAnswerTimer(ioServer, manager, room));
      });
    });

    socket.on(EVENTS.HOST_STOP_AI, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;
      stopAssistant(room.code);
      manager.stopAgent(room);
      broadcast(io, room);
    });

    socket.on(EVENTS.HOST_QUIT, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;

      const code = room.code;
      stopAssistant(code);
      clearTimer(code);
      clearSurveyTimer(code);
      const result = manager.hostQuit(code, playerId);

      if (result === "closed") {
        cleanupAssistant(code);
        manager.destroyRoom(code);
        io.to(code).emit(EVENTS.ROOM_CLOSED, { message: "Host left. Room closed." });
        socket.leave(code);
        socket.data.roomCode = undefined;
        return;
      }

      manager.leaveRoom(code, socket.id);
      socket.leave(code);
      socket.data.roomCode = undefined;
      socket.emit(EVENTS.ROOM_CLOSED, { message: "You left the room." });

      const updated = manager.getRoom(code);
      if (updated) broadcast(io, updated);
    });

    socket.on(EVENTS.HOST_END_ALL, () => {
      const room = getRoomForSocket(socket);
      const playerId = room ? getPlayerId(socket, room) : undefined;
      if (!room || !playerId || !manager.isHost(room, playerId)) return;

      const code = room.code;
      stopAssistant(code);
      clearTimer(code);
      clearSurveyTimer(code);
      if (!manager.endRoomForAll(code, playerId)) return;

      cleanupAssistant(code);
      io.to(code).emit(EVENTS.ROOM_CLOSED, { message: "Host ended the session for everyone." });
      io.in(code).socketsLeave(code);
      manager.destroyRoom(code);
      socket.data.roomCode = undefined;
    });

    socket.on("disconnect", () => {
      const code = socket.data.roomCode as string | undefined;
      if (!code) return;
      const room = manager.leaveRoom(code, socket.id);
      if (room) broadcast(io, room);
    });
  });
}
