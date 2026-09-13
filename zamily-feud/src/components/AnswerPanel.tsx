"use client";

import { useState } from "react";
import { EVENTS } from "@/lib/events";
import { PublicGameState } from "@/lib/types";

interface Props {
  state: PublicGameState;
  playerId: string;
  isActive: boolean;
  emit: (event: string, payload?: unknown) => void;
}

export function AnswerPanel({ state, playerId, isActive, emit }: Props) {
  const [answer, setAnswer] = useState("");
  const submitted = state.submitted[playerId];

  if (!isActive || state.phase !== "answering" || submitted) {
    if (isActive && submitted) {
      return <p className="text-center text-sm text-emerald-300">✅ Answer locked in — waiting for reveal...</p>;
    }
    return null;
  }

  if (state.config.answerMode === "speak") {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <p className="text-2xl font-bold text-emerald-300">🎤 You may speak now!</p>
        <p className="mt-2 text-sm text-zinc-400">Everyone can hear you in Zoom. Type a backup answer below if needed.</p>
        <div className="mt-4 flex gap-2">
          <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Backup typed answer" />
          <button className="btn-primary" onClick={() => { emit(EVENTS.PLAYER_ANSWER, { text: answer }); setAnswer(""); }}>
            Lock In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-xl">
      <p className="mb-3 text-sm text-zinc-400">Your answer is private until the reveal.</p>
      <div className="flex gap-2">
        <input
          className="input"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && answer.trim()) {
              emit(EVENTS.PLAYER_ANSWER, { text: answer });
              setAnswer("");
            }
          }}
          placeholder="Type your answer..."
          autoFocus
        />
        <button
          className="btn-primary whitespace-nowrap"
          onClick={() => {
            emit(EVENTS.PLAYER_ANSWER, { text: answer });
            setAnswer("");
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
