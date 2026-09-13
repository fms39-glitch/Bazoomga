import { randomUUID } from "crypto";
import Groq from "groq-sdk";
import { GameConfig, SurveyAnswer } from "./types";
import { DEFAULT_GROQ_MODEL } from "./groqConfig";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

export interface QuestionEntry {
  id: string;
  prompt: string;
}

export interface GamePlan {
  questionBank: QuestionEntry[];
  questionsById: Record<string, string>;
  /** playerId -> exactly Q questionIds (zero overlap across players) */
  surveyByPlayer: Record<string, string[]>;
  faceOffPairs: Array<[string, string]>;
  surveySecondsPerPlayer: number;
  requiredUnique: number;
}

export interface DuelPick {
  questionIdForA: string;
  questionIdForB: string;
}

/** RequiredUniqueQuestions = Q × N */
export function calculateRequiredQuestions(N: number, Q: number): number {
  return Q * N;
}

function normalizePrompt(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupePrompts(pool: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of pool) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = normalizePrompt(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function toQuestionEntries(prompts: string[]): QuestionEntry[] {
  return prompts.map((prompt) => ({ id: randomUUID(), prompt }));
}

export function assignSurveyQuestions(
  players: string[],
  bank: QuestionEntry[],
  Q: number
): Record<string, string[]> {
  const N = players.length;
  const needed = Q * N;
  if (bank.length < needed) {
    throw new Error(`Need ${needed} questions for survey, got ${bank.length}`);
  }

  const shuffledBank = [...bank].sort(() => Math.random() - 0.5).slice(0, needed);
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  const surveyByPlayer: Record<string, string[]> = {};

  shuffledPlayers.forEach((playerId, i) => {
    surveyByPlayer[playerId] = shuffledBank.slice(i * Q, (i + 1) * Q).map((q) => q.id);
  });

  return surveyByPlayer;
}

export function pickDuelQuestions(
  playerA: string,
  playerB: string,
  surveyByPlayer: Record<string, string[]>,
  usedForAFromB: Set<string> = new Set(),
  usedForBFromA: Set<string> = new Set()
): DuelPick | null {
  const poolForA = (surveyByPlayer[playerB] ?? []).filter((id) => !usedForAFromB.has(id));
  const poolForB = (surveyByPlayer[playerA] ?? []).filter((id) => !usedForBFromA.has(id));

  if (poolForA.length === 0 || poolForB.length === 0) return null;

  return {
    questionIdForA: poolForA[Math.floor(Math.random() * poolForA.length)]!,
    questionIdForB: poolForB[Math.floor(Math.random() * poolForB.length)]!,
  };
}

function pickRandomPair(players: string[], used: Array<[string, string]>): [string, string] {
  if (players.length < 2) return [players[0]!, players[0]!];

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const a = players[Math.floor(Math.random() * players.length)]!;
    let b = players[Math.floor(Math.random() * players.length)]!;
    while (b === a) b = players[Math.floor(Math.random() * players.length)]!;
    const key = [a, b].sort().join(":");
    const overused = used.filter(([x, y]) => [x, y].sort().join(":") === key).length >= 2;
    if (!overused) return [a, b];
  }

  return [players[0]!, players[1] ?? players[0]!];
}

export function validateGamePlan(plan: GamePlan): void {
  const allIds = Object.values(plan.surveyByPlayer).flat();
  const unique = new Set(allIds);
  if (unique.size !== allIds.length) {
    throw new Error("Survey assignment has overlapping questionIds between players");
  }

  for (const ids of Object.values(plan.surveyByPlayer)) {
    for (const id of ids) {
      if (!plan.questionsById[id]) {
        throw new Error(`Unknown questionId in survey map: ${id}`);
      }
    }
  }
}

export function buildGamePlan(playerIds: string[], questionCount: number, bank: QuestionEntry[]): GamePlan {
  const N = playerIds.length;
  const Q = questionCount;
  const requiredUnique = calculateRequiredQuestions(N, Q);

  if (bank.length < requiredUnique) {
    throw new Error(`Need ${requiredUnique} unique questions, got ${bank.length}`);
  }

  const workingBank = bank.slice(0, requiredUnique);
  const questionsById = Object.fromEntries(workingBank.map((q) => [q.id, q.prompt]));
  const surveyByPlayer = assignSurveyQuestions(playerIds, workingBank, Q);

  for (const playerId of playerIds) {
    if ((surveyByPlayer[playerId] ?? []).length < Q) {
      throw new Error(`Player ${playerId} did not receive ${Q} survey questions`);
    }
  }

  const shuffledPlayers = [...playerIds].sort(() => Math.random() - 0.5);
  const faceOffPairs: Array<[string, string]> = [];
  for (let round = 0; round < Q; round += 1) {
    faceOffPairs.push(pickRandomPair(shuffledPlayers, faceOffPairs));
  }

  const plan: GamePlan = {
    questionBank: workingBank,
    questionsById,
    surveyByPlayer,
    faceOffPairs,
    surveySecondsPerPlayer: Q * 10,
    requiredUnique,
  };

  validateGamePlan(plan);
  return plan;
}

function humorHint(config: GameConfig): string {
  const parts = [
    `Humor: ${config.humorLevel}.`,
    `Style: ${config.comedianStyle}.`,
    config.allowInsults ? "Light teasing OK." : "No insults.",
  ];
  if (config.humorLevel === "family") parts.push("Keep PG.");
  return parts.join(" ");
}

const CREATIVE_SEEDS = [
  "something people pretend to enjoy at family gatherings",
  "a reason someone might ghost a group chat",
  "something you'd hide when unexpected guests arrive",
  "a bad habit everyone has but nobody admits",
  "something people do in the first 5 minutes of waking up",
  "a place where people definitely judge your outfit",
  "something you'd pack for a reality TV show",
  "a word people yell during sports",
  "something that instantly makes a room feel awkward",
  "a food people claim is healthy but isn't",
  "something people lie about on their resume",
  "a sound that makes pets go crazy",
  "something people do when they think nobody is watching",
  "a reason to leave a party early",
  "something you'd find in someone's junk drawer",
  "a modern excuse for being late",
  "something people overspend on",
  "a holiday tradition that gets out of hand",
  "something people do on autopilot",
  "a celebrity people would want on their team",
];

function buildCreativeFallback(count: number, avoid: string[]): string[] {
  const avoidKeys = new Set(avoid.map(normalizePrompt));
  const out: string[] = [];
  let i = 0;

  while (out.length < count) {
    const seed = CREATIVE_SEEDS[i % CREATIVE_SEEDS.length]!;
    const variants = [`Name ${seed}.`, `Tell me ${seed}.`, `What's ${seed}?`, `Give me ${seed}.`];
    const candidate = variants[Math.floor(i / CREATIVE_SEEDS.length) % variants.length]!;
    i += 1;
    const key = normalizePrompt(candidate);
    if (!avoidKeys.has(key) && !out.some((q) => normalizePrompt(q) === key)) {
      out.push(candidate);
    }
    if (i > count * 30) break;
  }

  return out.slice(0, count);
}

async function generatePromptBatch(config: GameConfig, count: number, avoid: string[]): Promise<string[]> {
  if (!groq) return buildCreativeFallback(count, avoid);

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      temperature: 0.95,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write original Family Feud survey questions. ${humorHint(config)} Each question must start with "Name", "Tell me", or "What". Never repeat. Return ONLY JSON: {"questions":["..."]}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            count,
            avoid: avoid.slice(0, 100),
            tone: config.humorLevel,
            style: config.comedianStyle,
          }),
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { questions?: string[] };
    const generated = dedupePrompts((parsed.questions ?? []).filter(Boolean));
    if (generated.length >= count) return generated.slice(0, count);

    return dedupePrompts([
      ...generated,
      ...buildCreativeFallback(count - generated.length, [...avoid, ...generated]),
    ]).slice(0, count);
  } catch (err) {
    console.error("Groq question generation failed:", err);
    return buildCreativeFallback(count, avoid);
  }
}

export async function generateQuestionPool(
  config: GameConfig,
  playerCount: number,
  questionCount: number,
  avoid: string[] = []
): Promise<QuestionEntry[]> {
  const N = Math.max(playerCount, 2);
  const Q = questionCount;
  const required = calculateRequiredQuestions(N, Q);

  const batchSize = 15;
  const prompts: string[] = [];
  const seen = new Set(avoid.map(normalizePrompt));

  while (prompts.length < required) {
    const need = Math.min(batchSize, required - prompts.length);
    const batch = await generatePromptBatch(config, need, [...avoid, ...prompts]);
    for (const q of batch) {
      const key = normalizePrompt(q);
      if (seen.has(key)) continue;
      seen.add(key);
      prompts.push(q);
      if (prompts.length >= required) break;
    }
    if (batch.length === 0) break;
  }

  if (prompts.length < required) {
    const fill = buildCreativeFallback(required - prompts.length, [...avoid, ...prompts]);
    for (const q of fill) {
      const key = normalizePrompt(q);
      if (seen.has(key)) continue;
      seen.add(key);
      prompts.push(q);
    }
  }

  if (prompts.length < required) {
    throw new Error(`Could only generate ${prompts.length}/${required} unique questions`);
  }

  return toQuestionEntries(prompts.slice(0, required));
}

export async function buildDuelBoard(
  questionId: string,
  prompt: string,
  opponentSurveyAnswer: string,
  config: GameConfig
): Promise<{ id: string; prompt: string; answers: SurveyAnswer[] }> {
  const top = opponentSurveyAnswer.trim() || "Survey answer";
  const aiBoard = await generateFaceOffBoard(prompt, config);
  const normalizedTop = normalizePrompt(top);

  const rest = aiBoard.filter((a) => normalizePrompt(a.text) !== normalizedTop).slice(0, 3);
  const points = [40, 25, 15, 10];
  const answers: SurveyAnswer[] = [
    { text: top, aliases: [], points: 40 },
    ...rest.map((a, i) => ({ ...a, points: points[i + 1] ?? 5 })),
  ];

  while (answers.length < 4) {
    answers.push({ text: `Alternate ${answers.length}`, aliases: [], points: points[answers.length] ?? 5 });
  }

  return { id: questionId, prompt, answers: answers.slice(0, 4) };
}

export async function generateHostIntro(
  promptForA: string,
  promptForB: string,
  nameA: string,
  nameB: string,
  config: GameConfig
): Promise<string> {
  const same = normalizePrompt(promptForA) === normalizePrompt(promptForB);

  if (!groq) {
    if (same) return `${nameA} and ${nameB}, here comes your question — ${promptForA}`;
    return `${nameA}, you get: "${promptForA}". ${nameB}, you get: "${promptForB}". Go!`;
  }

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      temperature: 0.85,
      messages: [
        {
          role: "system",
          content: `You are a Family Feud host. ${humorHint(config)} One or two short energetic sentences. No JSON.`,
        },
        {
          role: "user",
          content: same
            ? `Duelists: ${nameA} vs ${nameB}\nQuestion: "${promptForA}"`
            : `Duelists: ${nameA} vs ${nameB}\n${nameA}'s question: "${promptForA}"\n${nameB}'s question: "${promptForB}"`,
        },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || `Face-off time! ${nameA} vs ${nameB}!`;
  } catch {
    return `Face-off! ${nameA} vs ${nameB}!`;
  }
}

export async function generateFaceOffBoard(prompt: string, config: GameConfig): Promise<SurveyAnswer[]> {
  const humor = humorHint(config);
  if (!groq) {
    return [
      { text: "Answer one", aliases: [], points: 40 },
      { text: "Answer two", aliases: [], points: 25 },
      { text: "Answer three", aliases: [], points: 15 },
      { text: "Answer four", aliases: [], points: 10 },
    ];
  }

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Generate 4 plausible Family Feud survey answers with point values 40,25,15,10. ${humor} Return ONLY JSON: {"answers":[{"text":"...","aliases":[],"points":N}]}`,
        },
        { role: "user", content: prompt },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      answers?: Array<{ text: string; aliases?: string[]; points: number }>;
    };
    return (parsed.answers ?? []).slice(0, 4).map((a, i) => ({
      text: a.text,
      aliases: a.aliases ?? [],
      points: a.points ?? [40, 25, 15, 10][i] ?? 5,
    }));
  } catch {
    return [
      { text: "Popular answer", aliases: [], points: 40 },
      { text: "Second choice", aliases: [], points: 25 },
      { text: "Third choice", aliases: [], points: 15 },
      { text: "Long shot", aliases: [], points: 10 },
    ];
  }
}

export function promptForPlayer(plan: GamePlan, playerId: string): string[] {
  return (plan.surveyByPlayer[playerId] ?? []).map((id) => plan.questionsById[id] ?? "");
}
