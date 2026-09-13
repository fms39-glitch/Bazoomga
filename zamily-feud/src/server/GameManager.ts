import { GameRoom } from "./GameRoom";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class GameManager {
  private rooms = new Map<string, GameRoom>();

  createRoom(): GameRoom {
    const code = this.nextCode();
    const room = new GameRoom(code);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  private nextCode() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let code = "";
      for (let i = 0; i < 4; i += 1) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return `Z${Date.now().toString(36).slice(-3).toUpperCase()}`;
  }
}

export const gameManager = new GameManager();
