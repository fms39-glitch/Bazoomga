import type { Server } from "socket.io";
import { EVENTS } from "./events";
import { GameRoomManager, type RoomState } from "./gameRoom";

const timerHandles = new Map<string, NodeJS.Timeout>();

export function clearAnswerTimer(code: string) {
  const handle = timerHandles.get(code);
  if (handle) {
    clearTimeout(handle);
    timerHandles.delete(code);
  }
}

export function startAnswerTimer(
  io: Server,
  manager: GameRoomManager,
  room: RoomState,
  onExpire: (io: Server, code: string) => void
) {
  io.to(room.code).emit(EVENTS.TIMER_START, room.timer);
  scheduleAnswerExpiry(io, manager, room.code, onExpire);
}

export function scheduleAnswerExpiry(
  io: Server,
  manager: GameRoomManager,
  code: string,
  onExpire: (io: Server, code: string) => void
) {
  clearAnswerTimer(code);
  const room = manager.getRoom(code);
  if (!room?.timer || room.phase !== "answering") return;

  const delay = Math.max(0, room.timer.endsAt - Date.now());
  const handle = setTimeout(() => {
    timerHandles.delete(code);
    const current = manager.getRoom(code);
    if (!current || current.phase !== "answering") return;
    if (manager.bothAnsweredOrExpired(current)) {
      onExpire(io, code);
    }
  }, delay);
  timerHandles.set(code, handle);
}
