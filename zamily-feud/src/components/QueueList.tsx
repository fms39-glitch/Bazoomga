import type { Player } from "@/shared/types";

export function QueueList({
  queueIds,
  playersById,
}: {
  queueIds: string[];
  playersById: Map<string, Player>;
}) {
  return (
    <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-xs uppercase tracking-[0.3em] text-gold">Up next</h3>
      {queueIds.length === 0 ? (
        <p className="mt-3 text-sm text-white/50">No one waiting.</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm text-white/80">
          {queueIds.map((id, index) => (
            <li key={id}>
              {index + 1}. {playersById.get(id)?.name ?? "Player"}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
