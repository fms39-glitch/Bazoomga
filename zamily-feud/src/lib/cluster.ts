import Groq from "groq-sdk";
import { SurveyAnswer, SurveyQuestion } from "./types";
import { SURVEY_PROMPTS } from "./questions";
import { DEFAULT_GROQ_MODEL } from "./groqConfig";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

function fallbackCluster(prompt: string, answers: string[]): SurveyAnswer[] {
  const counts = new Map<string, { text: string; count: number }>();
  for (const raw of answers) {
    const text = raw.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { text, count: 1 });
  }
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const total = sorted.reduce((sum, item) => sum + item.count, 0) || 1;
  return sorted.map((item, index) => ({
    text: item.text,
    aliases: [],
    points: Math.max(5, Math.round((item.count / total) * (100 - index * 8))),
  }));
}

export async function clusterSurveyAnswers(
  promptIndex: number,
  prompt: string,
  answers: string[]
): Promise<SurveyQuestion> {
  if (!groq || answers.length === 0) {
    return {
      id: `survey-${promptIndex}`,
      prompt,
      answers: fallbackCluster(prompt, answers),
    };
  }

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            'Cluster survey answers for a Family Feud game. Group synonyms together. Return ONLY JSON: {"clusters":[{"label":"...","members":["..."],"count":N}]} sorted by count descending, max 5 clusters.',
        },
        {
          role: "user",
          content: JSON.stringify({ question: prompt, answers }),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      clusters?: Array<{ label: string; members: string[]; count: number }>;
    };
    const clusters = parsed.clusters ?? [];
    const total = clusters.reduce((sum, c) => sum + (c.count || 1), 0) || 1;
    const board: SurveyAnswer[] = clusters.slice(0, 5).map((cluster, index) => ({
      text: cluster.label,
      aliases: cluster.members.filter((m) => m.toLowerCase() !== cluster.label.toLowerCase()),
      points: Math.max(5, Math.round(((cluster.count || 1) / total) * (100 - index * 8))),
    }));

    if (board.length === 0) {
      return { id: `survey-${promptIndex}`, prompt, answers: fallbackCluster(prompt, answers) };
    }
    return { id: `survey-${promptIndex}`, prompt, answers: board };
  } catch {
    return { id: `survey-${promptIndex}`, prompt, answers: fallbackCluster(prompt, answers) };
  }
}

export function getSurveyPrompts(count: number): string[] {
  return SURVEY_PROMPTS.slice(0, Math.min(count, SURVEY_PROMPTS.length));
}
