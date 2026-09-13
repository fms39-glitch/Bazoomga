import { randomUUID } from "crypto";
import { shuffleQuestions } from "../shared/questions";
import {
  DEFAULT_CONFIG,
  type AnswerMode,
  type GameConfig,
  type GamePhase,
  type JudgeResult,
  type Platform,
  type Player,
  type PublicGameState,
  type RevealEntry,
  type SurveyQuestion,
  type TimerState,
} from "../shared/types";
import { groqJudge } from "./judge";

type RoomListener = (event: string, payload: unknown) => void;

interface PrivateAnswer {
  text: string;
  submittedAt: number;
}

export class GameRoom {
  readonly code: string;
  private readonly createdAt = Date.now();
  private phase: GamePhase = "setup";
  private pausedFrom: GamePhase | null = null;
  private config: GameConfig = { ...DEFAULT_CONFIG };
  private players = new Map<string, Player>();
  private hostId: string | null = null;
  private questions: SurveyQuestion[] = [];
  private questionIndex = -1;
  private activePlayerIds: string[] = [];
  private answeredIds: string[] = [];
  private privateAnswers = new Map<string, PrivateAnswer>();
  private timer: TimerState | null = null;
  private reveal: RevealEntry[] | null = null;
  private lastWinnerId: string | null = null;
  private listener: RoomListener | null = null;
  private timerHandle: NodeJS.Timeout | null = null;
  private ttsWatchdog: NodeJS.Timeout | null = null;
  private autoNextHandle: NodeJS.Timeout | null = null;
  private pausedRemainingMs = 0;

  constructor(code: string) {
    this.code = code;
  }

  onEvent(listener: RoomListener) {
    this.listener = listener;
  }

  addPlayer(input: {
    id?: string;
    name: string;
    isHost?: boolean;
    platform: Platform;
  }): Player {
    const existing = input.id ? this.players.get(input.id) : undefined;
    if (existing) {
      existing.name = input.name || existing.name;
      existing.connected = true;
      existing.platform = input.platform;
      this.emitState();
      return existing;
    }

    const player: Player = {
      id: input.id ?? randomUUID(),
      name: input.name.trim() || "Player",
      isHost: Boolean(input.isHost) || this.players.size === 0,
      isSpectator: false,
      wantsToPlay: this.config.participation === "mandatory",
      score: 0,
      plays: 0,
      streak: 0,
      connected: true,
      platform: input.platform,
    };

    if (player.isHost) {
      this.hostId = player.id;
      player.wantsToPlay = this.config.hostPlays;
    }

    this.players.set(player.id, player);
    this.emitState();
    return player;
  }

  markDisconnected(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    this.emitState();
  }

  configure(hostId: string, patch: Partial<GameConfig>) {
    this.assertHost(hostId);
    this.config = { ...this.config, ...patch };
    const host = this.players.get(this.hostId ?? "");
    if (host) {
      host.wantsToPlay = this.config.hostPlays;
    }
    if (this.config.participation === "mandatory") {
      for (const player of this.players.values()) {
        if (!player.isHost || this.config.hostPlays) {
          player.wantsToPlay = true;
          player.isSpectator = false;
        }
      }
    }
    this.emitState();
  }

  start(hostId: string) {
    this.assertHost(hostId);
    if (this.config.participation === "optional") {
      this.phase = "invite";
      this.emitState();
      return;
    }
    this.beginMatch();
  }

  setReady(playerId: string, ready: boolean) {
    const player = this.requirePlayer(playerId);
    player.wantsToPlay = ready;
    player.isSpectator = !ready;
    this.emitState();

    if (this.phase === "invite" && this.allPlayersResponded() && this.contestants().length >= 2) {
      this.beginMatch();
    }
  }

  beginWithCurrentPlayers(hostId: string) {
    this.assertHost(hostId);
    this.beginMatch();
  }

  onTtsEnded() {
    if (this.phase !== "reading") return;
    this.beginAnswering();
  }

  submitAnswer(playerId: string, text: string) {
    if (this.phase !== "answering") return;
    if (!this.activePlayerIds.includes(playerId)) return;
    if (this.privateAnswers.has(playerId)) return;

    this.privateAnswers.set(playerId, {
      text: text.trim(),
      submittedAt: Date.now(),
    });
    this.answeredIds.push(playerId);
    this.emit("answer:locked", { playerId });
    this.emitState();

    if (this.activePlayerIds.every((id) => this.privateAnswers.has(id))) {
      void this.finishAnswering();
    }
  }

  pause(hostId: string) {
    this.assertHost(hostId);
    if (this.phase === "paused" || this.phase === "ended") return;
    this.pausedFrom = this.phase;
    if (this.timer) {
      this.pausedRemainingMs = Math.max(0, this.timer.endsAt - Date.now());
    }
    this.clearTimers();
    this.phase = "paused";
    this.emitState();
  }

  resume(hostId: string) {
    this.assertHost(hostId);
    if (this.phase !== "paused" || !this.pausedFrom) return;
    const restore = this.pausedFrom;
    this.pausedFrom = null;
    this.phase = restore;
    if (restore === "answering" && this.pausedRemainingMs > 0) {
      const now = Date.now();
      this.timer = {
        startedAt: now,
        endsAt: now + this.pausedRemainingMs,
        durationMs: this.config.timerSeconds * 1000,
        remainingMs: this.pausedRemainingMs,
      };
      this.timerHandle = setTimeout(() => {
        void this.finishAnswering();
      }, this.pausedRemainingMs);
      this.emit("timer:start", {
        startedAt: this.timer.startedAt,
        endsAt: this.timer.endsAt,
        serverNow: now,
      });
    }
    this.emitState();
  }

  stop(hostId: string) {
    this.assertHost(hostId);
    this.clearTimers();
    this.phase = "ended";
    this.emitState();
  }

  switchMode(hostId: string, mode: AnswerMode) {
    this.assertHost(hostId);
    this.config.answerMode = mode;
    this.emitState();
  }

  forceNext(hostId: string) {
    this.assertHost(hostId);
    this.clearTimers();
    this.advanceFaceOff();
  }

  overrideJudgment(
    hostId: string,
    payload: { playerId: string; points: number; correct: boolean; matchedAnswer?: string }
  ) {
    this.assertHost(hostId);
    if (!this.reveal) return;
    const entry = this.reveal.find((item) => item.playerId === payload.playerId);
    const player = this.players.get(payload.playerId);
    if (!entry || !player) return;

    player.score += payload.points - entry.points;
    entry.points = payload.points;
    entry.correct = payload.correct;
    entry.matchedAnswer = payload.matchedAnswer ?? entry.matchedAnswer;
    entry.reason = "Overridden by the host.";
    this.applyFaceOffOutcome();
    this.emit("answer:reveal", { reveal: this.reveal });
    this.emitState();
  }

  getPublicState(): PublicGameState {
    return {
      roomCode: this.code,
      phase: this.phase,
      pausedFrom: this.pausedFrom,
      config: this.config,
      players: [...this.players.values()],
      hostId: this.hostId,
      questionIndex: Math.max(this.questionIndex, 0),
      questionTotal: this.questions.length || this.config.questionCount,
      questionText: this.currentQuestion()?.text ?? null,
      activePlayerIds: [...this.activePlayerIds],
      queueIds: this.queueIds(),
      answeredIds: [...this.answeredIds],
      timer: this.timer
        ? { ...this.timer, remainingMs: Math.max(0, this.timer.endsAt - Date.now()) }
        : null,
      reveal: this.reveal,
      lastWinnerId: this.lastWinnerId,
      lastWinnerName: this.lastWinnerId
        ? this.players.get(this.lastWinnerId)?.name ?? null
        : null,
    };
  }

  idleMs(now = Date.now()) {
    return now - this.createdAt;
  }

  private beginMatch() {
    const contestants = this.contestants();
    if (contestants.length < 2) {
      this.emit("room:error", { message: "Need at least 2 players to start." });
      this.phase = "setup";
      this.emitState();
      return;
    }

    for (const player of this.players.values()) {
      player.isSpectator = !contestants.some((contestant) => contestant.id === player.id);
      player.score = 0;
      player.plays = 0;
      player.streak = 0;
    }

    this.questions = shuffleQuestions(this.config.questionCount);
    this.questionIndex = -1;
    this.lastWinnerId = null;
    this.advanceFaceOff();
  }

  private advanceFaceOff() {
    this.clearTimers();
    this.privateAnswers.clear();
    this.answeredIds = [];
    this.reveal = null;
    this.timer = null;
    this.questionIndex += 1;

    if (this.questionIndex >= this.questions.length) {
      this.phase = "ended";
      this.activePlayerIds = [];
      this.emitState();
      return;
    }

    this.pickActivePlayers();
    this.phase = "reading";
    this.emit("question:new", {
      questionText: this.currentQuestion()?.text,
      questionIndex: this.questionIndex,
      questionTotal: this.questions.length,
      activePlayerIds: this.activePlayerIds,
    });
    this.ttsWatchdog = setTimeout(() => this.beginAnswering(), 20000);
    this.emitState();
  }

  private pickActivePlayers() {
    const contestants = this.contestants();
    const sorted = [...contestants].sort((a, b) => {
      if (a.plays !== b.plays) return a.plays - b.plays;
      return a.name.localeCompare(b.name);
    });

    const stayer =
      this.lastWinnerId &&
      contestants.find(
        (player) =>
          player.id === this.lastWinnerId && player.streak > 0 && player.streak < this.config.maxStreak
      );

    if (stayer) {
      const partner = sorted.find((player) => player.id !== stayer.id);
      this.activePlayerIds = partner ? [stayer.id, partner.id] : [stayer.id];
      return;
    }

    this.activePlayerIds = sorted.slice(0, 2).map((player) => player.id);
  }

  private beginAnswering() {
    if (this.phase !== "reading" && this.phase !== "paused") return;
    this.clearWatchdog();
    this.phase = "answering";
    const now = Date.now();
    const durationMs = this.config.timerSeconds * 1000;
    this.timer = {
      startedAt: now,
      endsAt: now + durationMs,
      durationMs,
      remainingMs: durationMs,
    };
    this.timerHandle = setTimeout(() => {
      void this.finishAnswering();
    }, durationMs);
    this.emit("timer:start", {
      startedAt: now,
      endsAt: now + durationMs,
      serverNow: now,
    });
    this.emitState();
  }

  private async finishAnswering() {
    if (this.phase !== "answering") return;
    this.clearTimers();
    this.phase = "judging";
    this.emitState();

    const question = this.currentQuestion();
    if (!question) {
      this.phase = "ended";
      this.emitState();
      return;
    }

    const reveal: RevealEntry[] = [];
    for (const playerId of this.activePlayerIds) {
      const player = this.players.get(playerId);
      if (!player) continue;
      const submitted = this.privateAnswers.get(playerId);
      const result: JudgeResult = await groqJudge(question, submitted?.text ?? "");
      player.score += result.points;
      player.plays += 1;
      reveal.push({
        playerId,
        playerName: player.name,
        answer: submitted?.text || "(no answer)",
        correct: result.correct,
        points: result.points,
        matchedAnswer: result.matchedAnswer,
        reason: result.reason,
      });
    }

    this.reveal = reveal;
    this.applyFaceOffOutcome();
    this.phase = "reveal";
    this.emit("answer:reveal", { reveal });
    this.emitState();
    this.autoNextHandle = setTimeout(() => this.advanceFaceOff(), 9000);
  }

  private applyFaceOffOutcome() {
    if (!this.reveal || this.reveal.length === 0) return;

    const ranked = [...this.reveal].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aTime = this.privateAnswers.get(a.playerId)?.submittedAt ?? Number.MAX_SAFE_INTEGER;
      const bTime = this.privateAnswers.get(b.playerId)?.submittedAt ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    const winner = ranked[0];
    const loser = ranked[1];
    const tied = Boolean(loser && winner.points === loser.points);

    for (const player of this.players.values()) {
      if (!this.activePlayerIds.includes(player.id)) continue;
      if (tied) {
        if (player.streak >= this.config.maxStreak) player.streak = 0;
        continue;
      }
      if (player.id === winner.playerId) {
        player.streak += 1;
        if (player.streak >= this.config.maxStreak) {
          player.streak = 0;
          this.lastWinnerId = null;
        } else {
          this.lastWinnerId = player.id;
        }
      } else {
        player.streak = 0;
      }
    }

    if (tied) {
      this.lastWinnerId = null;
    }
  }

  private queueIds() {
    return this.contestants()
      .filter((player) => !this.activePlayerIds.includes(player.id))
      .sort((a, b) => a.plays - b.plays || a.name.localeCompare(b.name))
      .map((player) => player.id);
  }

  private contestants() {
    return [...this.players.values()].filter((player) => {
      if (!player.connected) return false;
      if (player.isHost && !this.config.hostPlays) return false;
      return player.wantsToPlay && !player.isSpectator;
    });
  }

  private currentQuestion() {
    return this.questions[this.questionIndex] ?? null;
  }

  private allPlayersResponded() {
    return [...this.players.values()]
      .filter((player) => player.connected && (!player.isHost || this.config.hostPlays))
      .every((player) => player.wantsToPlay || player.isSpectator);
  }

  private requirePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) throw new Error("Player not found");
    return player;
  }

  private assertHost(playerId: string) {
    if (playerId !== this.hostId) {
      throw new Error("Only the host can do that.");
    }
  }

  private clearWatchdog() {
    if (this.ttsWatchdog) {
      clearTimeout(this.ttsWatchdog);
      this.ttsWatchdog = null;
    }
  }

  private clearTimers() {
    this.clearWatchdog();
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.autoNextHandle) {
      clearTimeout(this.autoNextHandle);
      this.autoNextHandle = null;
    }
  }

  private emit(event: string, payload: unknown) {
    this.listener?.(event, payload);
  }

  private emitState() {
    this.emit("room:state", this.getPublicState());
  }
}
