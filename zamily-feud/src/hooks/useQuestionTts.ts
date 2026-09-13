"use client";

import { useEffect, useRef } from "react";
import { EVENTS } from "@/lib/events";
import { unlockAudioPlayback } from "@/lib/audioUnlock";
import { PublicQuestion } from "@/lib/types";

async function playSpeech(text: string, muted: boolean): Promise<boolean> {
  if (muted || !text.trim()) return false;

  await unlockAudioPlayback();

  try {
    const resp = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (resp.ok) {
      const contentType = resp.headers.get("content-type") ?? "";
      if (contentType.includes("audio") || contentType.includes("mpeg")) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        try {
          await new Promise<void>((resolve, reject) => {
            const audio = new Audio(url);
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error("audio playback failed"));
            void audio.play().catch(reject);
          });
          return true;
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    }
  } catch {
    // fall through to browser speech
  }

  if (window.speechSynthesis) {
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
    return true;
  }

  return false;
}

export function useQuestionTts(
  speakTextProp: string | null,
  question: PublicQuestion | null,
  phase: string,
  muted: boolean,
  isHost: boolean,
  emit: (event: string, payload?: unknown) => void
) {
  const lastSpeechKey = useRef<string | null>(null);

  useEffect(() => {
    if (phase === "speaking") {
      if (!question && !speakTextProp) return;
      const speechKey = `speaking:${question?.id ?? ""}:${speakTextProp ?? ""}`;
      if (lastSpeechKey.current === speechKey) return;
      lastSpeechKey.current = speechKey;

      let cancelled = false;

      (async () => {
        const parts = [speakTextProp, question?.prompt].filter(Boolean) as string[];
        const fullText = parts.join(" ... ");

        if (!muted) {
          try {
            await playSpeech(fullText, false);
          } catch {
            // host still advances the game
          }
        } else {
          await new Promise((r) => setTimeout(r, 900));
        }

        if (!cancelled && isHost) emit(EVENTS.TTS_ENDED);
      })();

      return () => {
        cancelled = true;
        window.speechSynthesis?.cancel();
      };
    }

    if (phase === "reveal" && speakTextProp) {
      const speechKey = `reveal:${speakTextProp}`;
      if (lastSpeechKey.current === speechKey) return;
      lastSpeechKey.current = speechKey;

      void playSpeech(speakTextProp, muted).catch(() => undefined);

      return () => {
        window.speechSynthesis?.cancel();
      };
    }
  }, [speakTextProp, question, phase, muted, isHost, emit]);
}
