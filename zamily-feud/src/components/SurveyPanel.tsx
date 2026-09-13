"use client";

import { useEffect, useMemo, useState } from "react";
import { EVENTS } from "@/lib/events";
import { PublicGameState } from "@/lib/types";

function useSurveyCountdown(endsAt: number | null | undefined) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) {
      setRemaining(null);
      return;
    }

    const tick = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return remaining;
}

export function SurveyPanel({
  state,
  emit,
}: {
  state: PublicGameState;
  emit: (event: string, payload?: unknown) => void;
}) {
  const prompts = state.survey?.prompts ?? [];
  const [answers, setAnswers] = useState<string[]>(() => prompts.map(() => ""));

  useEffect(() => {
    setAnswers(prompts.map(() => ""));
  }, [state.survey?.prompts]);

  const remaining = useSurveyCountdown(state.survey?.endsAt);
  const allFilled = useMemo(() => answers.every((a) => a.trim().length > 0), [answers]);

  if (state.phase !== "polling" || !state.survey) return null;

  if (state.surveySubmitted) {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 text-lg text-emerald-300">Survey submitted!</p>
        <p className="mt-1 text-sm text-zinc-400">
          {state.survey.submitted} / {state.survey.total} players done — game starts when everyone finishes.
        </p>
        {remaining !== null && remaining > 0 && (
          <p className="mt-2 text-xs text-zinc-500">Time left: {remaining}s</p>
        )}
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-sky-300">📋 Your Personal Survey</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Answer your {state.survey.prompts.length} personal questions — zero overlap with anyone else. In
            face-offs you&apos;ll answer questions from your opponent&apos;s survey.{" "}
            <span className="text-sky-200">
              {state.survey.submitted}/{state.survey.total}
            </span>{" "}
            submitted.
          </p>
        </div>
        {remaining !== null && (
          <div className="rounded-xl border border-sky-500/40 bg-sky-950/40 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-widest text-sky-400">Time</p>
            <p className="text-2xl font-bold text-sky-200">{remaining}s</p>
          </div>
        )}
      </div>

      {prompts.map((prompt, index) => (
        <label key={`${prompt}-${index}`} className="block space-y-1">
          <span className="text-sm text-sky-200">
            {index + 1}. {prompt}
          </span>
          <input
            className="input"
            value={answers[index] ?? ""}
            onChange={(e) => {
              const next = [...answers];
              next[index] = e.target.value;
              setAnswers(next);
            }}
            placeholder="Your answer..."
          />
        </label>
      ))}

      <button
        className="btn-primary w-full disabled:opacity-40"
        disabled={!allFilled}
        onClick={() => emit(EVENTS.SURVEY_SUBMIT, { answers })}
      >
        Submit Survey
      </button>
    </div>
  );
}
