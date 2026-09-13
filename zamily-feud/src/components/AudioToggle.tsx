"use client";

import { unlockAudioPlayback } from "@/lib/audioUnlock";

export function AudioToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (muted) void unlockAudioPlayback();
        onToggle();
      }}
      title={muted ? "Unmute AI host" : "Mute AI host"}
      className="fixed left-4 top-1/2 z-50 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-sky-700 bg-[#0d1a3a] text-2xl shadow-lg transition hover:bg-sky-950"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
