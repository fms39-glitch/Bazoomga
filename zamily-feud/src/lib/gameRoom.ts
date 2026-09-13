import { randomUUID } from "crypto";
import {
  AnswerMode,
  AgentLogEntry,
  DEFAULT_CONFIG,
  FaceOff,
  GameConfig,
  GamePhase,
  Judgment,
  Player,
  PublicGameState,
  RevealState,
  SurveyQuestion,
  TimerState,
} from "./types";
import {
  buildGamePlan,
  buildDuelBoard,
  generateHostIntro,
  generateQuestionPool,
  pickDuelQuestions,
  promptForPlayer,
  validateGamePlan,
  type GamePlan,
} from "./gamePlan";

interface PrivateAnswer {
  playerId: string;
  text: string;
  submittedAt: number;
}

interface RoomState {
  code: string;
  hostId: string;
  phase: GamePhase;
  config: GameConfig;
  players: Map<string, Player>;
  socketToPlayer: Map<string, string>;
  queue: string[];
  active: FaceOff | null;
  faceOffRound: number;
  duelBoardForA: SurveyQuestion | null;
  duelBoardForB: SurveyQuestion | null;
  usedDuelForAFromB: Set<string>;
  usedDuelForBFromA: Set<string>;
  questionIndex: number;
  privateAnswers: Map<string, PrivateAnswer>;
  reveal: RevealState | null;
  hostLine: string | null;
  speakText: string | null;
  timer: TimerState | null;
  pausedAt: number | null;
  pausedRemainingMs: number | null;
  gamePlan: GamePlan | null;
  /** playerId -> questionId -> answer text */
  surveyAnswers: Map<string, Record<string, string>>;
  surveySubmitted: Set<string>;
  surveyStartedAt: number | null;
  surveyFinishing: boolean;
  usedQuestionTexts: string[];
  agentLog: AgentLogEntry[];
  agentRunning: boolean;
  agentStopped: boolean;
}

function makeRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function connectedPlayers(room: RoomState) {
  return [...room.players.values()].filter((p) => p.connected);
}

function surveyEligible(room: RoomState) {
  return connectedPlayers(room).filter((p) => p.participating);
}

function viewerQuestion(room: RoomState, viewerId?: string) {
  if (!room.active || !room.gamePlan) return null;

  let prompt: string | null = null;
  if (viewerId === room.active.playerAId) {
    prompt = room.gamePlan.questionsById[room.active.questionIdForA] ?? null;
  } else if (viewerId === room.active.playerBId) {
    prompt = room.gamePlan.questionsById[room.active.questionIdForB] ?? null;
  } else if (room.duelBoardForA) {
    prompt = `${room.players.get(room.active.playerAId)?.name ?? "A"}: ${room.duelBoardForA.prompt}`;
  }

  const board = viewerId === room.active.playerAId ? room.duelBoardForA : viewerId === room.active.playerBId ? room.duelBoardForB : room.duelBoardForA;
  const id = viewerId === room.active.playerAId ? room.active.questionIdForA : viewerId === room.active.playerBId ? room.active.questionIdForB : room.active.questionIdForA;

  if (!prompt || !board) return null;
  return {
    id,
    prompt,
    index: room.faceOffRound + 1,
    total: room.config.questionCount,
  };
}

function toPublic(room: RoomState, viewerId?: string): PublicGameState {
  const players = [...room.players.values()].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  const current = viewerQuestion(room, viewerId);
  const submitted: Record<string, boolean> = {};
  for (const id of [room.active?.playerAId, room.active?.playerBId]) {
    if (id) submitted[id] = room.privateAnswers.has(id);
  }

  const eligible = surveyEligible(room);
  const personalPrompts =
    viewerId && room.gamePlan ? promptForPlayer(room.gamePlan, viewerId) : [];

  const surveyDuration = room.gamePlan?.surveySecondsPerPlayer ?? room.config.questionCount * 10;
  const surveyEndsAt = room.surveyStartedAt
    ? room.surveyStartedAt + surveyDuration * 1000
    : null;

  const duel =
    room.active && room.gamePlan
      ? {
          nameA: room.players.get(room.active.playerAId)?.name ?? "Player A",
          nameB: room.players.get(room.active.playerBId)?.name ?? "Player B",
          promptForA: room.gamePlan.questionsById[room.active.questionIdForA] ?? "",
          promptForB: room.gamePlan.questionsById[room.active.questionIdForB] ?? "",
        }
      : null;

  return {
    roomCode: room.code,
    phase: room.phase,
    config: room.config,
    hostId: room.hostId,
    players,
    queue: room.queue,
    active: room.active,
    question: current,
    timer: room.timer,
    submitted,
    reveal: room.reveal,
    hostLine: room.hostLine,
    speakText: room.speakText,
    questionNumber: room.faceOffRound + 1,
    totalQuestions: room.config.questionCount,
    duel,
    survey:
      room.phase === "polling" && room.gamePlan
        ? {
            submitted: room.surveySubmitted.size,
            total: eligible.length,
            prompts: personalPrompts,
            durationSeconds: surveyDuration,
            endsAt: surveyEndsAt,
          }
        : null,
    surveySubmitted: viewerId ? room.surveySubmitted.has(viewerId) : false,
    agentLog: room.agentLog.slice(-30),
    agentRunning: room.agentRunning,
  };
}

export class GameRoomManager {
  private rooms = new Map<string, RoomState>();

  createRoom(hostSocketId: string, hostName: string): { room: RoomState; playerId: string } {
    const code = makeRoomCode();
    const playerId = randomUUID();
    const room: RoomState = {
      code,
      hostId: playerId,
      phase: "lobby",
      config: { ...DEFAULT_CONFIG },
      players: new Map(),
      socketToPlayer: new Map(),
      queue: [],
      active: null,
      faceOffRound: 0,
      duelBoardForA: null,
      duelBoardForB: null,
      usedDuelForAFromB: new Set(),
      usedDuelForBFromA: new Set(),
      questionIndex: 0,
      privateAnswers: new Map(),
      reveal: null,
      hostLine: null,
      speakText: null,
      timer: null,
      pausedAt: null,
      pausedRemainingMs: null,
      gamePlan: null,
      surveyAnswers: new Map(),
      surveySubmitted: new Set(),
      surveyStartedAt: null,
      surveyFinishing: false,
      usedQuestionTexts: [],
      agentLog: [],
      agentRunning: false,
      agentStopped: false,
    };

    const host: Player = {
      id: playerId,
      name: hostName,
      score: 0,
      playCount: 0,
      winStreak: 0,
      connected: true,
      participating: true,
      joinedAt: Date.now(),
    };
    room.players.set(playerId, host);
    room.socketToPlayer.set(hostSocketId, playerId);
    this.rooms.set(code, room);
    return { room, playerId };
  }

  joinRoom(code: string, socketId: string, name: string): { room: RoomState; playerId: string } | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    if (room.phase !== "lobby" && room.phase !== "invite" && room.phase !== "ready") return null;

    const existing = [...room.players.values()].find((p) => p.name.toLowerCase() === name.toLowerCase());
    const playerId = existing?.id ?? randomUUID();
    const player: Player = existing ?? {
      id: playerId,
      name,
      score: 0,
      playCount: 0,
      winStreak: 0,
      connected: true,
      participating: room.config.mandatory,
      joinedAt: Date.now(),
    };
    player.connected = true;
    room.players.set(playerId, player);
    room.socketToPlayer.set(socketId, playerId);
    return { room, playerId };
  }

  leaveRoom(code: string, socketId: string): RoomState | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return room;
    const player = room.players.get(playerId);
    if (player) player.connected = false;
    room.socketToPlayer.delete(socketId);
    return room;
  }

  hostQuit(code: string, hostId: string): "closed" | "transferred" | "noop" {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || room.hostId !== hostId) return "noop";
    const others = connectedPlayers(room).filter((p) => p.id !== hostId);
    if (others.length === 0) {
      this.rooms.delete(code.toUpperCase());
      return "closed";
    }
    room.hostId = others[0].id;
    return "transferred";
  }

  endRoomForAll(code: string, hostId: string): boolean {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || room.hostId !== hostId) return false;
    this.rooms.delete(code.toUpperCase());
    return true;
  }

  destroyRoom(code: string) {
    this.rooms.delete(code.toUpperCase());
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getPlayerId(room: RoomState, socketId: string): string | undefined {
    return room.socketToPlayer.get(socketId);
  }

  isHost(room: RoomState, playerId: string): boolean {
    return room.hostId === playerId;
  }

  addAgentLog(room: RoomState, type: AgentLogEntry["type"], message: string) {
    room.agentLog.push({ id: randomUUID(), timestamp: Date.now(), type, message });
    if (room.agentLog.length > 50) room.agentLog.shift();
  }

  stopAgent(room: RoomState) {
    room.agentRunning = false;
    room.agentStopped = true;
    this.addAgentLog(room, "action", "Host stopped the AI assistant.");
  }

  configure(room: RoomState, config: Partial<GameConfig>): RoomState {
    if (room.agentRunning && room.config.managementMode === "assistant") return room;
    room.config = { ...room.config, ...config };
    if (config.managementMode === "assistant" && room.phase === "lobby") {
      this.addAgentLog(room, "thinking", "AI Assistant armed — I'll run the full show when you're ready.");
    }
    if (config.managementMode === "manual") room.agentStopped = false;
    if (room.config.mandatory) {
      for (const player of room.players.values()) {
        if (player.connected) player.participating = true;
      }
    }
    return room;
  }

  acceptInvite(room: RoomState, playerId: string): RoomState {
    const player = room.players.get(playerId);
    if (player) player.participating = true;
    if (room.phase === "invite") room.phase = "ready";
    return room;
  }

  declineInvite(room: RoomState, playerId: string): RoomState {
    const player = room.players.get(playerId);
    if (player) player.participating = false;
    return room;
  }

  participatingIds(room: RoomState): string[] {
    return surveyEligible(room).map((p) => p.id);
  }

  async prepareSurvey(room: RoomState, onProgress?: (room: RoomState) => void): Promise<RoomState | "not_enough"> {
    if (room.config.mandatory) {
      for (const p of connectedPlayers(room)) p.participating = true;
    }

    const ids = this.participatingIds(room);
    if (ids.length < 2) return "not_enough";

    room.phase = "planning";
    this.addAgentLog(room, "thinking", `Planning game for ${ids.length} players...`);
    onProgress?.(room);

    const bank = await generateQuestionPool(room.config, ids.length, room.config.questionCount, room.usedQuestionTexts);
    room.usedQuestionTexts.push(...bank.map((q) => q.prompt));
    room.gamePlan = buildGamePlan(ids, room.config.questionCount, bank);
    validateGamePlan(room.gamePlan);

    this.addAgentLog(
      room,
      "decision",
      `Plan ready: ${ids.length} players × ${room.config.questionCount} survey Qs, ${room.gamePlan.requiredUnique} unique in bank, ${room.gamePlan.surveySecondsPerPlayer}s survey.`
    );
    onProgress?.(room);

    room.surveyAnswers.clear();
    room.surveySubmitted.clear();
    room.surveyFinishing = false;
    room.surveyStartedAt = Date.now();
    room.phase = "polling";
    this.addAgentLog(room, "action", "Survey live — everyone gets different questions!");
    onProgress?.(room);
    return room;
  }

  submitSurvey(room: RoomState, playerId: string, answers: string[]): RoomState | "invalid" {
    if (room.phase !== "polling" || !room.gamePlan) return "invalid";
    if (room.surveySubmitted.has(playerId)) return "invalid";

    const questionIds = room.gamePlan.surveyByPlayer[playerId];
    if (!questionIds || answers.length !== questionIds.length) return "invalid";

    const answerMap: Record<string, string> = {};
    questionIds.forEach((id, i) => {
      answerMap[id] = answers[i]?.trim() ?? "";
    });
    room.surveyAnswers.set(playerId, answerMap);
    room.surveySubmitted.add(playerId);
    return room;
  }

  allSurveySubmitted(room: RoomState): boolean {
    const eligible = surveyEligible(room);
    if (eligible.length < 2) return false;
    return eligible.every((p) => room.surveySubmitted.has(p.id));
  }

  forceCompleteSurvey(room: RoomState): RoomState {
    if (!room.gamePlan) return room;
    for (const player of surveyEligible(room)) {
      if (room.surveySubmitted.has(player.id)) continue;
      const questionIds = room.gamePlan.surveyByPlayer[player.id] ?? [];
      const empty: Record<string, string> = {};
      questionIds.forEach((id) => {
        empty[id] = "";
      });
      room.surveyAnswers.set(player.id, empty);
      room.surveySubmitted.add(player.id);
    }
    return room;
  }

  async finishSurvey(room: RoomState, onProgress?: (room: RoomState) => void): Promise<RoomState> {
    if (room.surveyFinishing || !room.gamePlan) return room;
    room.surveyFinishing = true;

    room.faceOffRound = 0;
    room.usedDuelForAFromB.clear();
    room.usedDuelForBFromA.clear();
    this.addAgentLog(room, "decision", "Survey complete — starting face-offs from opponent questions.");
    onProgress?.(room);

    if (!room.config.mandatory) {
      room.phase = "invite";
      return room;
    }

    return this.startFaceOff(room, onProgress);
  }

  async startFaceOff(room: RoomState, onProgress?: (room: RoomState) => void): Promise<RoomState> {
    if (!room.gamePlan) return room;

    const pair = room.gamePlan.faceOffPairs[room.faceOffRound];
    if (!pair) {
      room.phase = "ended";
      return room;
    }

    const [playerAId, playerBId] = pair;
    const duel = pickDuelQuestions(
      playerAId,
      playerBId,
      room.gamePlan.surveyByPlayer,
      room.usedDuelForAFromB,
      room.usedDuelForBFromA
    );

    if (!duel) {
      this.addAgentLog(room, "error", "No unused opponent survey questions left for this pair.");
      room.faceOffRound += 1;
      if (room.faceOffRound >= room.config.questionCount) {
        room.phase = "ended";
        return room;
      }
      return this.startFaceOff(room, onProgress);
    }

    room.usedDuelForAFromB.add(duel.questionIdForA);
    room.usedDuelForBFromA.add(duel.questionIdForB);

    const promptForA = room.gamePlan.questionsById[duel.questionIdForA] ?? "";
    const promptForB = room.gamePlan.questionsById[duel.questionIdForB] ?? "";
    const answerFromB = room.surveyAnswers.get(playerBId)?.[duel.questionIdForA] ?? "";
    const answerFromA = room.surveyAnswers.get(playerAId)?.[duel.questionIdForB] ?? "";

    this.addAgentLog(room, "thinking", "Building duel boards from opponent survey answers...");
    onProgress?.(room);

    room.duelBoardForA = await buildDuelBoard(duel.questionIdForA, promptForA, answerFromB, room.config);
    room.duelBoardForB = await buildDuelBoard(duel.questionIdForB, promptForB, answerFromA, room.config);

    room.active = {
      playerAId,
      playerBId,
      questionIdForA: duel.questionIdForA,
      questionIdForB: duel.questionIdForB,
    };
    room.privateAnswers.clear();
    room.reveal = null;
    room.timer = null;

    const nameA = room.players.get(playerAId)?.name ?? "Player A";
    const nameB = room.players.get(playerBId)?.name ?? "Player B";

    const intro = await generateHostIntro(promptForA, promptForB, nameA, nameB, room.config);
    room.speakText = intro;
    room.hostLine = promptForA === promptForB ? promptForA : `${nameA}: ${promptForA} | ${nameB}: ${promptForB}`;
    room.phase = "speaking";

    this.addAgentLog(
      room,
      "action",
      `Face-off ${room.faceOffRound + 1}: ${nameA} answers from ${nameB}'s survey, ${nameB} from ${nameA}'s.`
    );
    onProgress?.(room);
    return room;
  }

  onTtsEnded(room: RoomState): RoomState {
    if (room.phase !== "speaking") return room;
    const endsAt = Date.now() + room.config.timerSeconds * 1000;
    room.timer = { startedAt: Date.now(), endsAt, remainingMs: room.config.timerSeconds * 1000 };
    room.phase = "answering";
    room.speakText = null;
    return room;
  }

  submitAnswer(room: RoomState, playerId: string, text: string): RoomState | "not_active" | "already_submitted" {
    if (room.phase !== "answering") return "not_active";
    if (!room.active || (playerId !== room.active.playerAId && playerId !== room.active.playerBId)) {
      return "not_active";
    }
    if (room.privateAnswers.has(playerId)) return "already_submitted";
    room.privateAnswers.set(playerId, { playerId, text: text.trim(), submittedAt: Date.now() });
    return room;
  }

  bothAnsweredOrExpired(room: RoomState): boolean {
    if (!room.active) return true;
    const aDone = room.privateAnswers.has(room.active.playerAId);
    const bDone = room.privateAnswers.has(room.active.playerBId);
    const expired = room.timer ? Date.now() >= room.timer.endsAt : false;
    return (aDone && bDone) || expired;
  }

  moveToJudging(room: RoomState): RoomState {
    room.phase = "judging";
    room.timer = null;
    return room;
  }

  applyJudgments(room: RoomState, judgments: Judgment[], hostLine: string): RoomState {
    let winnerId: string | null = null;
    let topPoints = -1;

    for (const j of judgments) {
      const player = room.players.get(j.playerId);
      if (!player) continue;
      player.playCount += 1;
      if (j.correct) {
        player.score += j.points;
        if (j.points > topPoints) {
          topPoints = j.points;
          winnerId = j.playerId;
        } else if (j.points === topPoints && topPoints > 0) {
          winnerId = null;
        }
      }
    }

    room.reveal = { judgments, winnerId, hostLine };
    room.hostLine = hostLine;
    room.speakText = hostLine;
    room.phase = "reveal";
    return room;
  }

  async nextFaceOff(room: RoomState, onProgress?: (room: RoomState) => void): Promise<RoomState> {
    room.privateAnswers.clear();
    room.reveal = null;
    room.timer = null;
    room.speakText = null;
    room.hostLine = null;

    if (room.faceOffRound + 1 >= room.config.questionCount) {
      room.phase = "ended";
      room.active = null;
      this.addAgentLog(room, "decision", "Game over!");
      return room;
    }

    room.faceOffRound += 1;
    room.duelBoardForA = null;
    room.duelBoardForB = null;
    return this.startFaceOff(room, onProgress);
  }

  pause(room: RoomState): RoomState {
    if (room.phase !== "answering" || !room.timer || room.pausedAt) return room;
    room.pausedAt = Date.now();
    room.pausedRemainingMs = Math.max(0, room.timer.endsAt - Date.now());
    room.phase = "paused";
    return room;
  }

  resume(room: RoomState): RoomState {
    if (room.phase !== "paused" || room.pausedRemainingMs === null) return room;
    const endsAt = Date.now() + room.pausedRemainingMs;
    room.timer = { startedAt: Date.now(), endsAt, remainingMs: room.pausedRemainingMs };
    room.pausedAt = null;
    room.pausedRemainingMs = null;
    room.phase = "answering";
    return room;
  }

  stop(room: RoomState): RoomState {
    room.phase = "ended";
    room.active = null;
    room.timer = null;
    room.agentRunning = false;
    return room;
  }

  switchMode(room: RoomState, mode: AnswerMode): RoomState {
    room.config.answerMode = mode;
    return room;
  }

  async forceNext(room: RoomState, onProgress?: (room: RoomState) => void): Promise<RoomState> {
    if (room.phase === "reveal" || room.phase === "judging") {
      return this.nextFaceOff(room, onProgress);
    }
    if (room.phase === "answering" || room.phase === "speaking") {
      room.privateAnswers.clear();
      return this.nextFaceOff(room, onProgress);
    }
    return room;
  }

  publicState(room: RoomState, viewerId?: string): PublicGameState {
    return toPublic(room, viewerId);
  }
}

export type { RoomState };
