import { PublicGameState } from "@/lib/types";

export function RevealPanel({ state }: { state: PublicGameState }) {
  if (!state.reveal || (state.phase !== "reveal" && state.phase !== "ended")) return null;

  return (
    <section className="card mx-auto max-w-3xl space-y-4">
      {state.reveal.hostLine && (
        <p className="text-center text-lg font-semibold text-sky-200">{state.reveal.hostLine}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {state.reveal.judgments.map((entry) => (
          <article
            key={entry.playerId}
            className={`rounded-xl border px-5 py-5 ${
              entry.correct ? "border-emerald-500/40 bg-emerald-950/30" : "border-red-500/40 bg-red-950/30"
            }`}
          >
            <p className="text-xs uppercase tracking-widest text-zinc-400">
              {state.players.find((p) => p.id === entry.playerId)?.name ?? "Player"}
            </p>
            <p className="mt-2 text-2xl font-bold text-white">{entry.answer || "(no answer)"}</p>
            <p className="mt-3 text-sky-300">{entry.points} points</p>
            <p className="mt-2 text-sm text-zinc-400">{entry.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Scoreboard({ state }: { state: PublicGameState }) {
  const ranked = [...state.players]
    .filter((p) => p.connected)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return (
    <aside className="card mx-auto max-w-3xl">
      <h3 className="text-xs uppercase tracking-[0.3em] text-sky-400">Scoreboard</h3>
      <ol className="mt-3 space-y-2">
        {ranked.map((player, index) => (
          <li key={player.id} className="flex items-center justify-between text-sm">
            <span className="text-zinc-200">
              {index + 1}. {player.name}
              {!player.participating ? " · spectator" : ""}
            </span>
            <span className="font-bold text-sky-300">{player.score}</span>
          </li>
        ))}
      </ol>

      {state.queue.length > 0 && (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <h4 className="text-xs uppercase tracking-widest text-zinc-500">Up next</h4>
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            {state.queue.slice(0, 5).map((id, index) => (
              <li key={id}>
                {index + 1}. {state.players.find((p) => p.id === id)?.name ?? "Player"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
