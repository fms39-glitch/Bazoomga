export type Platform = "web" | "zoom";

export type GamePhase =
  | "lobby"
  | "planning"
  | "polling"
  | "invite"
  | "ready"
  | "speaking"
  | "answering"
  | "judging"
  | "reveal"
  | "paused"
  | "ended";

export type AnswerMode = "text" | "speak";
export type HostType = "ai" | "human";
export type ManagementMode = "manual" | "assistant";
export type HumorLevel = "family" | "moderate" | "adult";

export interface Player {
  id: string;
  name: string;
  score: number;
  playCount: number;
  winStreak: number;
  connected: boolean;
  participating: boolean;
  joinedAt: number;
}

export interface GameConfig {
  hostType: HostType;
  managementMode: ManagementMode;
  questionCount: number;
  mandatory: boolean;
  answerMode: AnswerMode;
  timerSeconds: number;
  maxWinStreak: number;
  humorLevel: HumorLevel;
  allowInsults: boolean;
  comedianStyle: string;
}

export interface SurveyAnswer {
  text: string;
  aliases: string[];
  points: number;
}

export interface SurveyQuestion {
  id: string;
  prompt: string;
  answers: SurveyAnswer[];
}

export interface FaceOff {
  playerAId: string;
  playerBId: string;
  /** Question from B's survey that A must answer */
  questionIdForA: string;
  /** Question from A's survey that B must answer */
  questionIdForB: string;
}

export interface DuelDisplay {
  nameA: string;
  nameB: string;
  promptForA: string;
  promptForB: string;
}

export interface Judgment {
  playerId: string;
  answer: string;
  correct: boolean;
  points: number;
  matchedAnswer: string | null;
  reason: string;
}

export interface TimerState {
  startedAt: number;
  endsAt: number;
  remainingMs: number;
}

export interface PublicQuestion {
  id: string;
  prompt: string;
  index: number;
  total: number;
}

export interface RevealState {
  judgments: Judgment[];
  winnerId: string | null;
  hostLine: string | null;
}

export interface SurveyProgress {
  submitted: number;
  total: number;
  /** This player's personal survey prompts only */
  prompts: string[];
  /** Q * 10 seconds */
  durationSeconds: number;
  endsAt: number | null;
}

export interface AgentLogEntry {
  id: string;
  timestamp: number;
  type: "thinking" | "action" | "decision" | "error";
  message: string;
}

export interface PublicGameState {
  roomCode: string;
  phase: GamePhase;
  config: GameConfig;
  hostId: string;
  players: Player[];
  queue: string[];
  active: FaceOff | null;
  question: PublicQuestion | null;
  timer: TimerState | null;
  submitted: Record<string, boolean>;
  reveal: RevealState | null;
  hostLine: string | null;
  /** Spoken intro before the question */
  speakText: string | null;
  questionNumber: number;
  totalQuestions: number;
  survey: SurveyProgress | null;
  surveySubmitted: boolean;
  agentLog: AgentLogEntry[];
  agentRunning: boolean;
  /** Face-off display — each duelist may have a different question */
  duel: DuelDisplay | null;
}

export const DEFAULT_CONFIG: GameConfig = {
  hostType: "ai",
  managementMode: "manual",
  questionCount: 5,
  mandatory: true,
  answerMode: "text",
  timerSeconds: 10,
  maxWinStreak: 3,
  humorLevel: "family",
  allowInsults: false,
  comedianStyle: "classic game show",
};
