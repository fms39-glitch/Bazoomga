"use client";

import { useEffect, useRef } from "react";

async function playBrowserVoice(text: string) {
  if (!window.speechSynthesis) return;
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export function useQuestionAudio(
  questionText: string | null,
  phase: string,
  muted: boolean,
  onEnded: () => void
) {
  const lastQuestion = useRef<string | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    if (phase !== "reading" || !questionText || muted) {
      if (phase === "reading" && muted && lastQuestion.current !== questionText) {
        lastQuestion.current = questionText;
        ended.current = true;
        const timeout = window.setTimeout(onEnded, 800);
        return () => window.clearTimeout(timeout);
      }
      return;
    }

    if (lastQuestion.current === questionText) return;
    lastQuestion.current = questionText;
    ended.current = false;
    let cancelled = false;
    const audio = new Audio();

    const finish = () => {
      if (cancelled || ended.current) return;
      ended.current = true;
      onEnded();
    };

    const run = async () => {
      try {
        const response = await fetch(`/api/tts?text=${encodeURIComponent(questionText)}`);
        if (!response.ok) throw new Error("tts");
        const blob = await response.blob();
        audio.src = URL.createObjectURL(blob);
        audio.onended = () => {
          URL.revokeObjectURL(audio.src);
          finish();
        };
        audio.onerror = finish;
        await audio.play();
      } catch {
        await playBrowserVoice(questionText);
        finish();
      }
    };

    void run();
    return () => {
      cancelled = true;
      audio.pause();
      window.speechSynthesis?.cancel();
    };
  }, [questionText, phase, muted, onEnded]);
}
