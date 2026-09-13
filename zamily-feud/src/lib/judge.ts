import Groq from "groq-sdk";
import { GameConfig, Judgment, SurveyQuestion } from "@/lib/types";
import { DEFAULT_GROQ_MODEL } from "@/lib/groqConfig";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

function humorInstructions(config: GameConfig): string {
  const lines = [
    `Humor level: ${config.humorLevel}.`,
    config.allowInsults ? "Light teasing allowed." : "No insults or mean-spirited jokes.",
    `Host style: ${config.comedianStyle}.`,
  ];
  if (config.humorLevel === "family") lines.push("Keep everything PG and family-friendly.");
  if (config.humorLevel === "adult") lines.push("Edgier jokes OK but stay tasteful for a party game.");
  return lines.join(" ");
}

function fallbackJudge(
  question: SurveyQuestion,
  playerId: string,
  answer: string
): Judgment {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) {
    return {
      playerId,
      answer,
      correct: false,
      points: 0,
      matchedAnswer: null,
      reason: "No answer given before time ran out.",
    };
  }

  for (const candidate of question.answers) {
    const options = [candidate.text, ...candidate.aliases].map((v) => v.toLowerCase());
    if (options.some((opt) => normalized.includes(opt) || opt.includes(normalized))) {
      return {
        playerId,
        answer,
        correct: true,
        points: candidate.points,
        matchedAnswer: candidate.text,
        reason: `Matched survey answer "${candidate.text}".`,
      };
    }
  }

  return {
    playerId,
    answer,
    correct: false,
    points: 0,
    matchedAnswer: null,
    reason: "Answer did not match any survey response.",
  };
}

export async function judgeAnswers(
  question: SurveyQuestion,
  submissions: { playerId: string; answer: string }[],
  config: GameConfig
): Promise<{ judgments: Judgment[]; hostLine: string }> {
  if (!groq) {
    const judgments = submissions.map((s) => fallbackJudge(question, s.playerId, s.answer));
    const winner = [...judgments].sort((a, b) => b.points - a.points)[0];
    const hostLine = winner?.correct
      ? `We have a match! "${winner.answer}" scores ${winner.points} points.`
      : "Tough round — no perfect matches this time.";
    return { judgments, hostLine };
  }

  const prompt = `You are judging a Family Feud-style face-off.

${humorInstructions(config)}

Question: ${question.prompt}

Valid survey answers (with points):
${question.answers.map((a) => `- ${a.text} (${a.points} pts). Aliases: ${a.aliases.join(", ") || "none"}`).join("\n")}

Player submissions:
${submissions.map((s) => `- Player ${s.playerId}: "${s.answer}"`).join("\n")}

Return ONLY valid JSON:
{
  "judgments": [
    {
      "playerId": "<id>",
      "answer": "<submitted answer>",
      "correct": true/false,
      "points": <number>,
      "matchedAnswer": "<matched survey answer or null>",
      "reason": "<short reason>"
    }
  ],
  "hostLine": "<1-2 sentence dramatic reveal line matching the humor settings>"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_GROQ_MODEL,
      messages: [
        { role: "system", content: "Return only JSON. Be fair with fuzzy matching." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { judgments: Judgment[]; hostLine: string };
    return {
      judgments: parsed.judgments ?? [],
      hostLine: parsed.hostLine ?? "And the results are in!",
    };
  } catch {
    const judgments = submissions.map((s) => fallbackJudge(question, s.playerId, s.answer));
    return { judgments, hostLine: "The judges have spoken!" };
  }
}
