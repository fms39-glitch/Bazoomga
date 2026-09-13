"use client";

import { useSyncedTimer } from "@/lib/useSyncedTimer";
import type { TimerState } from "@/shared/types";

export function CountdownTimer({
  timer,
  visible,
}: {
  timer: TimerState | null;
  visible: boolean;
}) {
  const remaining = useSyncedTimer(timer);
  if (!visible) return null;

  const seconds = Math.ceil(remaining / 1000);
  const urgent = seconds <= 3;

  return (
    <div className="mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/10 bg-black/40 sm:h-40 sm:w-40">
      <span
        className={`font-display text-7xl sm:text-8xl ${
          urgent ? "animate-pulse text-danger" : "text-white"
        }`}
      >
        {Math.max(seconds, 0)}
      </span>
    </div>
  );
}
