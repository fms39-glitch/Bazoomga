"use client";

import { PublicGameState } from "@/lib/types";
import { unlockAudioPlayback } from "@/lib/audioUnlock";

interface Props {
  state: PublicGameState;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
}

export function Lobby({ state }: Props) {
  if (state.phase !== "lobby" && state.phase !== "invite" && state.phase !== "ready") return null;

  return (
    <div className="card mx-auto max-w-lg space-y-4">
      <h2 className="text-xl font-bold text-sky-300">Join Zamily Feud</h2>
      <p className="text-sm text-zinc-400">
        Room <span className="font-mono text-sky-200">{state.roomCode}</span> ·{" "}
        {state.players.filter((p) => p.connected).length} connected
      </p>
      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {state.players
          .filter((p) => p.connected)
          .map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{p.name}</span>
              {p.id === state.hostId && <span className="text-xs text-fuchsia-300">HOST</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}

export function JoinForm({ onCreate, onJoin }: { onCreate: (name: string) => void; onJoin: (code: string, name: string) => void }) {
  return (
    <div className="card mx-auto max-w-lg space-y-4">
      <h1 className="text-center text-3xl font-black tracking-wider text-sky-300">⚡ ZAMILY FEUD</h1>
      <p className="text-center text-sm text-zinc-400">Works in your browser or inside a Zoom meeting.</p>
      <input id="name" className="input" placeholder="Your name" />
      <input id="code" className="input" placeholder="Room code (to join)" />
      <div className="flex gap-3">
        <button
          className="btn-primary flex-1"
          onClick={() => {
            void unlockAudioPlayback();
            onCreate((document.getElementById("name") as HTMLInputElement).value);
          }}
        >
          Create Room
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={() => {
            void unlockAudioPlayback();
            onJoin(
              (document.getElementById("code") as HTMLInputElement).value,
              (document.getElementById("name") as HTMLInputElement).value
            );
          }}
        >
          Join Room
        </button>
      </div>
    </div>
  );
}
