"use client";

import type { Player, PublicGameState } from "@/shared/types";

export function InvitePrompt({
  state,
  me,
  onReady,
  onDecline,
  onBegin,
}: {
  state: PublicGameState;
  me: Player | null;
  onReady: () => void;
  onDecline: () => void;
  onBegin: () => void;
}) {
  if (state.phase !== "invite") return null;

  const readyCount = state.players.filter((player) => player.wantsToPlay).length;

  return (
    <section className="mx-auto w-full max-w-xl rounded-[28px] border border-gold/40 bg-navy/80 p-8 text-center">
      <h2 className="font-display text-4xl text-white">Do you want to play Zamily Feud?</h2>
      <p className="mt-3 text-white/70">{readyCount} player{readyCount === 1 ? "" : "s"} ready</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={onReady} className="rounded-2xl bg-gold px-5 py-3 font-display text-navy">
          I&apos;m in
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="rounded-2xl border border-white/20 px-5 py-3 text-white"
        >
          Just watch
        </button>
      </div>
      {me?.isHost ? (
        <button type="button" onClick={onBegin} className="mt-5 text-sm text-gold underline">
          Begin with current players
        </button>
      ) : null}
    </section>
  );
}
