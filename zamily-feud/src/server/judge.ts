import type { JudgeResult, SurveyQuestion } from "../shared/types";
import { DEFAULT_GROQ_MODEL } from "../lib/groqConfig";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function localJudge(question: SurveyQuestion, answer: string): JudgeResult {
  const normalized = normalize(answer);
  if (!normalized) {
    return {
      correct: false,
      points: 0,
      matchedAnswer: null,
      reason: "No answer was submitted.",
    };
  }

  for (const entry of question.answers) {
    const candidates = [entry.text, ...entry.aliases].map(normalize);
    const matched = candidates.some((candidate) => {
      if (!candidate) return false;
      if (normalized === candidate) return true;
      if (normalized.length < 3) return false;
      return normalized.includes(candidate) || candidate.includes(normalized);
    });

    if (matched) {
      return {
        correct: true,
        points: entry.points,
        matchedAnswer: entry.text,
        reason: `Matched the survey answer "${entry.text}".`,
      };
    }
  }

  return {
    correct: false,
    points: 0,
    matchedAnswer: null,
    reason: "That answer was not on the board.",
  };
}

export async function groqJudge(
  question: SurveyQuestion,
  answer: string
): Promise<JudgeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return localJudge(question, answer);
  }

  const model = DEFAULT_GROQ_MODEL;
  const expected = question.answers.map((entry) => ({
    answer: entry.text,
    aliases: entry.aliases,
    points: entry.points,
  }));

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are the judge for Zamily Feud, a Family Feud-style game. Compare a contestant answer to official survey answers. Accept close synonyms, slang, and minor spelling errors. Return ONLY JSON: {\"correct\":boolean,\"points\":number,\"matchedAnswer\":string|null,\"reason\":string}",
          },
          {
            role: "user",
            content: JSON.stringify({
              question: question.text,
              officialAnswers: expected,
              contestantAnswer: answer,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Groq judge error", response.status, await response.text());
      return localJudge(question, answer);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Partial<JudgeResult>;
    const fallback = localJudge(question, answer);

    return {
      correct: Boolean(parsed.correct),
      points: Number.isFinite(parsed.points) ? Number(parsed.points) : fallback.points,
      matchedAnswer: parsed.matchedAnswer ?? fallback.matchedAnswer,
      reason: parsed.reason || fallback.reason,
    };
  } catch (error) {
    console.error("Groq judge failed, using local fallback", error);
    return localJudge(question, answer);
  }
}
