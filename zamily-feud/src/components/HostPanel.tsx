"use client";

import { EVENTS } from "@/lib/events";
import { GameConfig, HumorLevel, ManagementMode, PublicGameState } from "@/lib/types";
import { AgentConsole } from "./AgentConsole";

interface Props {
  state: PublicGameState;
  emit: (event: string, payload?: unknown) => void;
}

export function HostPanel({ state, emit }: Props) {
  const update = (patch: Partial<GameConfig>) => emit(EVENTS.HOST_CONFIGURE, patch);
  const hasOthers = state.players.filter((p) => p.connected && p.id !== state.hostId).length > 0;

  const startLabel =
    state.phase === "lobby"
      ? "Start Survey"
      : state.phase === "invite" || state.phase === "ready"
        ? "Start Face-Off"
        : state.phase === "reveal"
          ? "Next Question"
          : "Start Game";

  const handleStart = () => {
    if (state.phase === "lobby") emit(EVENTS.HOST_START);
    else if (state.phase === "invite" || state.phase === "ready") emit("host:begin");
    else if (state.phase === "reveal") emit(EVENTS.HOST_QUESTION_READY);
    else emit(EVENTS.HOST_START);
  };

  return (
    <aside className="fixed right-0 top-0 z-50 h-screen w-80 overflow-y-auto border-l border-fuchsia-900 bg-[#110a1a] p-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-fuchsia-300">Host Controls</h2>
      <p className="mt-1 text-xs text-zinc-500">Room {state.roomCode}</p>

      {(state.config.managementMode === "assistant" || state.agentLog.length > 0) && (
        <AgentConsole
          log={state.agentLog}
          running={state.agentRunning}
          phase={state.phase}
          armed={state.config.managementMode === "assistant"}
          onStop={() => emit(EVENTS.HOST_STOP_AI)}
        />
      )}

      <div className="mt-4 space-y-3 text-sm">
        <label className="block">
          <span className="text-zinc-400">Run game via</span>
          <select
            className="input mt-1"
            value={state.config.managementMode}
            onChange={(e) => update({ managementMode: e.target.value as ManagementMode })}
            disabled={state.agentRunning}
          >
            <option value="manual">Manual (you control)</option>
            <option value="assistant">AI Assistant (auto-run)</option>
          </select>
        </label>

        <label className="block">
          <span className="text-zinc-400">Questions</span>
          <input
            type="number"
            min={1}
            max={8}
            value={state.config.questionCount}
            className="input mt-1"
            onChange={(e) => update({ questionCount: Number(e.target.value) })}
            disabled={state.agentRunning}
          />
        </label>

        <label className="block">
          <span className="text-zinc-400">Humor filter</span>
          <select
            className="input mt-1"
            value={state.config.humorLevel}
            onChange={(e) => update({ humorLevel: e.target.value as HumorLevel })}
          >
            <option value="family">Family-safe (PG)</option>
            <option value="moderate">Moderate</option>
            <option value="adult">Adult (edgy)</option>
          </select>
        </label>

        <label className="block">
          <span className="text-zinc-400">Host style</span>
          <input
            className="input mt-1"
            value={state.config.comedianStyle}
            onChange={(e) => update({ comedianStyle: e.target.value })}
            placeholder="e.g. Steve Harvey, classic game show"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.config.allowInsults}
            onChange={(e) => update({ allowInsults: e.target.checked })}
          />
          Allow light teasing
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.config.mandatory}
            onChange={(e) => update({ mandatory: e.target.checked })}
          />
          Mandatory participation
        </label>

        <div className="flex gap-2">
          <button
            className={`btn-secondary flex-1 ${state.config.answerMode === "text" ? "ring-2 ring-sky-500" : ""}`}
            onClick={() => emit(EVENTS.HOST_SWITCH_MODE, { mode: "text" })}
          >
            Text
          </button>
          <button
            className={`btn-secondary flex-1 ${state.config.answerMode === "speak" ? "ring-2 ring-sky-500" : ""}`}
            onClick={() => emit(EVENTS.HOST_SWITCH_MODE, { mode: "speak" })}
          >
            Speak
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary col-span-2" onClick={handleStart}>
            {startLabel}
          </button>
          {(state.phase === "invite" || state.phase === "ready") && (
            <button className="btn-secondary col-span-2" onClick={() => emit("host:begin")}>
              Begin with current players
            </button>
          )}
          <button className="btn-secondary" onClick={() => emit(EVENTS.HOST_PAUSE)}>
            Pause
          </button>
          <button className="btn-secondary" onClick={() => emit(EVENTS.HOST_RESUME)}>
            Resume
          </button>
          <button className="btn-secondary" onClick={() => emit(EVENTS.HOST_FORCE_NEXT)}>
            Force Next
          </button>
          <button className="btn-danger" onClick={() => emit(EVENTS.HOST_STOP)}>
            Stop Game
          </button>
        </div>

        <div className="border-t border-fuchsia-900/40 pt-3">
          <button className="btn-secondary w-full" onClick={() => emit(EVENTS.HOST_QUIT)}>
            Leave Room
          </button>
          {hasOthers && (
            <button className="btn-danger mt-2 w-full" onClick={() => emit(EVENTS.HOST_END_ALL)}>
              End Session for Everyone
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-xs uppercase tracking-widest text-zinc-500">Up Next</h3>
        <ul className="mt-2 space-y-1 text-xs text-zinc-300">
          {state.queue.slice(0, 6).map((id) => {
            const p = state.players.find((pl) => pl.id === id);
            return <li key={id}>• {p?.name ?? id}</li>;
          })}
        </ul>
      </div>
    </aside>
  );
}
