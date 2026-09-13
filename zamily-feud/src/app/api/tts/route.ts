import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function synthesize(text: string) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }

  const voiceId = process.env.CARTESIA_VOICE_ID ?? "69267136-1bdc-412f-ad78-0caad210fb40";
  const response = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": "2025-04-16",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "sonic-2",
      transcript: text,
      language: "en",
      voice: { mode: "id", id: voiceId },
      output_format: {
        container: "mp3",
        sample_rate: 44100,
        bit_rate: 128000,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Cartesia error", response.status, detail);
    return NextResponse.json({ error: "Cartesia TTS failed" }, { status: 502 });
  }

  const audio = await response.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  return synthesize(text);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  return synthesize(text);
}
