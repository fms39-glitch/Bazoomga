import type { RevealEntry } from "@/shared/types";

export function RevealOverlay({ reveal }: { reveal: RevealEntry[] | null }) {
  if (!reveal?.length) return null;

  return (
    <section className="mx-auto mt-6 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
      {reveal.map((entry) => (
        <article
          key={entry.playerId}
          className={`rounded-3xl border px-5 py-6 ${
            entry.correct ? "border-emerald-400/40 bg-emerald-400/10" : "border-danger/40 bg-danger/10"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">{entry.playerName}</p>
          <p className="mt-3 font-display text-3xl text-white">{entry.answer}</p>
          <p className="mt-4 text-gold">{entry.points} points</p>
          <p className="mt-2 text-sm text-white/70">{entry.reason}</p>
        </article>
      ))}
    </section>
  );
}
