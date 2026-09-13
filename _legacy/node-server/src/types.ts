// ---------------------------------------------------------------------------
// Shared types for game state + WebSocket messages
// ---------------------------------------------------------------------------

export type Role = "HOST" | "PLAYER" | "AUDIENCE";
export type GamePhase = "LOBBY" | "POLLING" | "PLAYING";

export interface ConnectedUser {
  id: string;
  name: string;
  role: Role;
}

export interface BoardEntry {
  label: string;
  count: number;
  revealed: boolean;
}

/** What the Python agent service returns from /cluster */
export interface Cluster {
  label: string;
  members: string[];
  count: number;
}

/** Messages a browser client sends to the server */
export type ClientMessage =
  | { type: "join_lobby"; name: string; role: Role }
  | { type: "host_start_polling" }
  | { type: "submit_poll_answers"; answers: string[] }
  | { type: "host_start_game"; questionIndex: number }
  | { type: "guess"; guess: string };

/** Public (client-safe) view of the board -- hides un-revealed labels */
export interface PublicBoardEntry {
  label: string; // "???" if not revealed
  count: number | null;
  revealed: boolean;
}

/** Messages the server broadcasts to all connected browser clients */
export type ServerMessage =
  | { type: "lobby_update"; users: ConnectedUser[]; phase: GamePhase }
  | { type: "start_polling"; questions: string[] }
  | { type: "poll_progress"; submitted: number; total: number }
  | { type: "host_line"; text: string }
  | { type: "board_update"; question: string | null; board: PublicBoardEntry[] }
  | { type: "guess_result"; result: "hit" | "miss"; guess: string };
