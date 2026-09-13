"use client";

import { useEffect, useState } from "react";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
}

export function SpeakBanner({
  active,
  locked,
  onSubmit,
}: {
  active: boolean;
  locked: boolean;
  onSubmit: (value: string) => void;
}) {
  const [heard, setHeard] = useState("");

  useEffect(() => {
    if (!active || locked) return;
    const SpeechRecognition =
      (window as Window & {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setHeard(transcript);
    };
    recognition.onerror = () => undefined;
    recognition.start();
    return () => recognition.stop();
  }, [active, locked]);

  if (!active) return null;

  return (
    <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-gold bg-gold/10 px-6 py-6 text-center">
      <p className="font-display text-4xl text-gold">You may speak now</p>
      <p className="mt-2 text-sm text-white/70">
        Everyone in Zoom can hear you. Your words stay private in the game until the reveal.
      </p>
      {heard ? <p className="mt-4 text-white">Heard: {heard}</p> : null}
      {locked ? (
        <p className="mt-4 text-emerald-300">Locked in</p>
      ) : (
        <button
          type="button"
          onClick={() => onSubmit(heard)}
          className="mt-5 rounded-2xl bg-gold px-5 py-3 font-display text-navy"
        >
          I&apos;m done speaking
        </button>
      )}
    </div>
  );
}
