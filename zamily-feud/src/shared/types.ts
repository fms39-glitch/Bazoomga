export type Platform = "web" | "zoom";

export type GamePhase =
  | "lobby"
  | "setup"
  | "invite"
  | "reading"
  | "answering"
  | "judging"
  | "reveal"
  | "paused"
  | "ended";

export type AnswerMode = "text" | "speak";
export type HostType = "ai" | "human";
export type Participation = "mandatory" | "optional";

export interface GameConfig {
  hostType: HostType;
  questionCount: number;
  participation: Participation;
  answerMode: AnswerMode;
  maxStreak: number;
  timerSeconds: number;
  hostPlays: boolean;
}

export const DEFAULT_CONFIG: GameConfig = {
  hostType: "ai",
  questionCount: 5,
  participation: "optional",
  answerMode: "text",
  maxStreak: 3,
  timerSeconds: 10,
  hostPlays: true,
};

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isSpectator: boolean;
  wantsToPlay: boolean;
  score: number;
  plays: number;
  streak: number;
  connected: boolean;
  platform: Platform;
}

export interface TimerState {
  startedAt: number;
  endsAt: number;
  durationMs: number;
  remainingMs: number;
}

export interface RevealEntry {
  playerId: string;
  playerName: string;
  answer: string;
  correct: boolean;
  points: number;
  matchedAnswer: string | null;
  reason: string;
}

export interface SurveyAnswer {
  text: string;
  aliases: string[];
  points: number;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  answers: SurveyAnswer[];
}

export interface JudgeResult {
  correct: boolean;
  points: number;
  matchedAnswer: string | null;
  reason: string;
}

export interface PublicGameState {
  roomCode: string;
  phase: GamePhase;
  pausedFrom: GamePhase | null;
  config: GameConfig;
  players: Player[];
  hostId: string | null;
  questionIndex: number;
  questionTotal: number;
  questionText: string | null;
  activePlayerIds: string[];
  queueIds: string[];
  answeredIds: string[];
  timer: TimerState | null;
  reveal: RevealEntry[] | null;
  lastWinnerId: string | null;
  lastWinnerName: string | null;
}

export interface SessionIdentity {
  playerId: string;
  name: string;
  roomCode: string;
  isHost: boolean;
}
