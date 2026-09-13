import { BoardEntry, Cluster, PublicBoardEntry, ConnectedUser, GamePhase } from "./types";

class GameState {
  phase: GamePhase = "LOBBY";
  users: ConnectedUser[] = [];
  questions: string[] = [];
  pollingAnswers: Record<string, string>[] = [];
  currentQuestionIndex: number = 0;
  board: BoardEntry[] = [];

  addUser(user: ConnectedUser) {
    this.users.push(user);
  }

  removeUser(id: string) {
    this.users = this.users.filter(u => u.id !== id);
  }

  startPolling(questions: string[]) {
    this.phase = "POLLING";
    this.questions = questions;
    this.pollingAnswers = questions.map(() => ({}));
  }

  submitPoll(userId: string, answers: string[]) {
    if (this.phase !== "POLLING") return;
    answers.forEach((ans, i) => {
      if (i < this.pollingAnswers.length) {
        this.pollingAnswers[i][userId] = ans;
      }
    });
  }

  /** Returns count of audience members who have submitted */
  pollSubmittedCount(): number {
    const audienceIds = this.users.filter(u => u.role === "AUDIENCE").map(u => u.id);
    return audienceIds.filter(id => id in (this.pollingAnswers[0] || {})).length;
  }

  /** Returns total audience member count */
  audienceCount(): number {
    return this.users.filter(u => u.role === "AUDIENCE").length;
  }

  /** True once every audience member has submitted their answers */
  allAudienceSubmitted(): boolean {
    const audienceIds = this.users.filter(u => u.role === "AUDIENCE").map(u => u.id);
    if (audienceIds.length === 0) return false;
    const submitted = Object.keys(this.pollingAnswers[0] || {});
    return audienceIds.every(id => submitted.includes(id));
  }

  startGame(questionIndex: number, clusters: Cluster[]) {
    this.phase = "PLAYING";
    this.currentQuestionIndex = questionIndex;
    this.board = clusters.map((c) => ({
      label: c.label,
      count: c.count,
      revealed: false,
    }));
  }

  question(): string | null {
    return this.questions[this.currentQuestionIndex] || null;
  }

  unrevealedLabels(): string[] {
    return this.board.filter((b) => !b.revealed).map((b) => b.label);
  }

  reveal(label: string): { entry: BoardEntry; rank: number } | null {
    const idx = this.board.findIndex((b) => b.label === label && !b.revealed);
    if (idx === -1) return null;
    this.board[idx].revealed = true;
    return { entry: this.board[idx], rank: idx + 1 };
  }

  publicBoard(): PublicBoardEntry[] {
    return this.board.map((b) => ({
      label: b.revealed ? b.label : "???",
      count: b.revealed ? b.count : null,
      revealed: b.revealed,
    }));
  }
}

export const gameState = new GameState();
