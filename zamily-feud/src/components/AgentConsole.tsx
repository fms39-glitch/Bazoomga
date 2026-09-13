"use client";

import { AgentLogEntry, GamePhase } from "@/lib/types";

const TYPE_COLORS: Record<AgentLogEntry["type"], string> = {
  thinking: "text-violet-300",
  action: "text-sky-300",
  decision: "text-emerald-300",
  error: "text-red-300",
};

export function AgentConsole({
  log,
  running,
  phase,
  armed,
  onStop,
}: {
  log: AgentLogEntry[];
  running: boolean;
  phase: GamePhase;
  armed: boolean;
  onStop: () => void;
}) {
  const isProcessing = running && phase === "polling" && log.some((e) => e.message.includes("Clustering"));

  return (
    <section className="rounded-xl border border-violet-900/50 bg-[#0a0614] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-violet-300">
          AI Assistant {running ? "· LIVE" : armed ? "· ARMED" : ""}
        </h3>
        {running && (
          <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={onStop}>
            Stop AI
          </button>
        )}
      </div>

      {isProcessing && (
        <p className="mt-2 animate-pulse text-xs text-violet-200">
          Processing survey answers with Groq — usually 10–30 seconds...
        </p>
      )}

      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
        {log.length === 0 ? (
          <p className="text-zinc-500">
            {armed
              ? "Assistant is ready. Click Start Survey above to begin."
              : "Select AI Assistant mode, then click Start Survey."}
          </p>
        ) : (
          log.map((entry) => (
            <p key={entry.id} className={TYPE_COLORS[entry.type]}>
              <span className="text-zinc-600">{new Date(entry.timestamp).toLocaleTimeString()} </span>
              [{entry.type}] {entry.message}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
