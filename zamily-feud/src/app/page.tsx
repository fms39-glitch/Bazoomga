"use client";

import { useState } from "react";
import { JoinForm, Lobby } from "@/components/Lobby";
import { QuestionBoard } from "@/components/QuestionBoard";
import { AnswerPanel } from "@/components/AnswerPanel";
import { HostPanel } from "@/components/HostPanel";
import { RevealPanel, Scoreboard } from "@/components/Scoreboard";
import { SurveyPanel } from "@/components/SurveyPanel";
import { AudioToggle } from "@/components/AudioToggle";
import { EVENTS } from "@/lib/events";
import { useGameSocket } from "@/hooks/useGameSocket";
import { useQuestionTts } from "@/hooks/useQuestionTts";

export default function Home() {
  const { connected, state, playerId, error, isHost, isActive, createRoom, joinRoom, emit } = useGameSocket();
  const [muted, setMuted] = useState(false);
  useQuestionTts(state?.speakText ?? null, state?.question ?? null, state?.phase ?? "lobby", muted, !!isHost, emit);

  if (!state) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="text-center text-sm text-zinc-500">{connected ? "Enter a room to begin" : "Connecting..."}</div>
        <JoinForm onCreate={createRoom} onJoin={joinRoom} />
        {error && <p className="text-center text-red-400">{error}</p>}
      </main>
    );
  }

  return (
    <main className={`mx-auto min-h-screen max-w-5xl px-4 py-8 pl-20 ${isHost ? "pr-80" : ""}`}>
      <AudioToggle muted={muted} onToggle={() => setMuted((m) => !m)} />

      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-sky-300">⚡ ZAMILY FEUD</h1>
          <p className="text-xs text-zinc-500">
            {connected ? "🟢 Connected" : "🔴 Disconnected"} · Room {state.roomCode}
            {state.agentRunning ? " · 🤖 AI running" : ""}
          </p>
        </div>
        {state.phase === "invite" && !state.config.mandatory && playerId && (
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => emit(EVENTS.PLAYER_ACCEPT)}>
              Play
            </button>
            <button className="btn-secondary" onClick={() => emit(EVENTS.PLAYER_DECLINE)}>
              Spectate
            </button>
          </div>
        )}
      </header>

      {state.phase === "planning" && (
        <div className="card mx-auto max-w-xl text-center">
          <p className="text-2xl">🤖</p>
          <p className="mt-2 text-lg text-sky-300">AI is planning your game...</p>
          <p className="mt-1 text-sm text-zinc-400">
            Generating unique questions for each player and pre-planning face-offs.
          </p>
        </div>
      )}

      {state.phase === "polling" && <SurveyPanel state={state} emit={emit} />}

      {(state.phase === "lobby" || state.phase === "invite" || state.phase === "ready") && (
        <Lobby state={state} onCreate={createRoom} onJoin={joinRoom} />
      )}

      {!["lobby", "invite", "ready", "polling"].includes(state.phase) && (
        <div className="space-y-6">
          <QuestionBoard state={state} />
          {playerId && <AnswerPanel state={state} playerId={playerId} isActive={!!isActive} emit={emit} />}
          <RevealPanel state={state} />
          <Scoreboard state={state} />
        </div>
      )}

      {state.phase === "ended" && (
        <p className="mt-6 text-center text-lg text-zinc-300">Game over — thanks for playing!</p>
      )}

      {isHost && <HostPanel state={state} emit={emit} />}
      {error && <p className="mt-4 text-center text-red-400">{error}</p>}
    </main>
  );
}
