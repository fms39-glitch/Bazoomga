// ---------------------------------------------------------------------------
// agentClient.ts
// ---------------------------------------------------------------------------
// Thin wrapper around calls to the Python agent service. Node never talks to
// Ollama directly -- it always goes through this HTTP boundary. This keeps
// the AI logic swappable/replaceable without touching any game code here.
//
// Requires Node 18+ (uses the built-in global `fetch`).

import { Cluster } from "./types";

const AGENT_SERVICE_URL =
  process.env.AGENT_SERVICE_URL ?? "http://localhost:8000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AGENT_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Agent service error on ${path}: ${res.status} ${res.statusText} ${text}`
    );
  }

  return (await res.json()) as T;
}

export async function generateQuestions(): Promise<string[]> {
  const data = await postJson<{ questions: string[] }>("/generate-questions", {});
  return data.questions;
}

export async function clusterAnswers(
  question: string,
  answers: string[]
): Promise<Cluster[]> {

  const data = await postJson<{ clusters: Cluster[] }>("/cluster", {
    question,
    answers,
  });
  return data.clusters;
}

export async function matchGuess(
  question: string,
  guess: string,
  boardAnswers: string[]
): Promise<string | null> {
  const data = await postJson<{ match: string | null }>("/match", {
    question,
    guess,
    board_answers: boardAnswers,
  });
  return data.match;
}

export async function hostIntro(question: string): Promise<string> {
  const data = await postJson<{ line: string }>("/host/intro", { question });
  return data.line;
}

export async function hostReveal(
  question: string,
  answer: string,
  points: number,
  rank: number
): Promise<string> {
  const data = await postJson<{ line: string }>("/host/reveal", {
    question,
    answer,
    points,
    rank,
  });
  return data.line;
}

export async function hostWrong(guess: string): Promise<string> {
  const data = await postJson<{ line: string }>("/host/wrong", { guess });
  return data.line;
}

export async function hostRoundEnd(
  winningTeam: string,
  totalPoints: number
): Promise<string> {
  const data = await postJson<{ line: string }>("/host/round-end", {
    winning_team: winningTeam,
    total_points: totalPoints,
  });
  return data.line;
}
