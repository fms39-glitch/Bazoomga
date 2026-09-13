import { NextRequest, NextResponse } from "next/server";
import { groqJudge, localJudge } from "@/server/judge";
import { QUESTION_BANK } from "@/shared/questions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    question?: string;
    answer?: string;
    questionId?: string;
  };

  const question =
    QUESTION_BANK.find((item) => item.id === body.questionId) ??
    QUESTION_BANK.find((item) => item.text === body.question);

  if (!question || !body.answer) {
    return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
  }

  const result = process.env.GROQ_API_KEY
    ? await groqJudge(question, body.answer)
    : localJudge(question, body.answer);

  return NextResponse.json(result);
}
