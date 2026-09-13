"use client";

import { useSyncedTimer } from "@/hooks/useSyncedTimer";
import { PublicGameState } from "@/lib/types";

export function QuestionBoard({ state }: { state: PublicGameState }) {
  const { seconds, urgent } = useSyncedTimer(state.timer, state.phase);
  const showTimer = state.phase === "answering" && state.timer;

  const playerA = state.players.find((p) => p.id === state.active?.playerAId);
  const playerB = state.players.find((p) => p.id === state.active?.playerBId);
  const duel = state.duel;

  const headline = state.question?.prompt ?? duel?.promptForA ?? state.hostLine ?? "Waiting for the next question...";

  return (
    <section className="card mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-sky-400">
          Face-off {state.questionNumber} of {state.totalQuestions}
        </p>

        {duel && duel.promptForA !== duel.promptForB ? (
          <div className="mt-4 space-y-4 text-left">
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-sky-400">{duel.nameA}&apos;s question</p>
              <p className="mt-2 text-xl font-bold text-white">{duel.promptForA}</p>
            </div>
            <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-fuchsia-300">{duel.nameB}&apos;s question</p>
              <p className="mt-2 text-xl font-bold text-white">{duel.promptForB}</p>
            </div>
            <p className="text-center text-xs text-zinc-500">
              Each duelist answers a question from their opponent&apos;s survey — never their own.
            </p>
          </div>
        ) : (
          <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-4xl">{headline}</h2>
        )}

        {state.phase === "speaking" && (
          <p className="mt-3 text-sm text-sky-300">🎙 AI host is reading the question...</p>
        )}
      </div>

      {showTimer && (
        <div className={`timer ${urgent ? "timer-urgent" : ""}`}>
          <span className={`timer-number ${urgent ? "text-red-400" : ""}`}>{Math.max(seconds, 0)}</span>
          <span className="mt-1 text-xs uppercase tracking-widest text-zinc-400">seconds</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[playerA, playerB].map((player) => {
          if (!player) return null;
          const locked = state.submitted[player.id];
          return (
            <div
              key={player.id}
              className={`rounded-xl border px-4 py-5 text-center ${
                state.phase === "answering" || state.phase === "speaking"
                  ? "border-sky-500/50 bg-sky-950/30"
                  : "border-zinc-700 bg-zinc-900/40"
              }`}
            >
              <p className="text-xs uppercase tracking-widest text-zinc-500">Face-off</p>
              <p className="mt-2 text-xl font-bold text-white">{player.name}</p>
              <p className="mt-1 text-sm text-sky-300">{player.score} pts</p>
              {locked && <p className="mt-2 text-xs text-emerald-300">Answer locked</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
