import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "zamily-feud",
    tts: Boolean(process.env.CARTESIA_API_KEY),
    judge: Boolean(process.env.GROQ_API_KEY),
  });
}
