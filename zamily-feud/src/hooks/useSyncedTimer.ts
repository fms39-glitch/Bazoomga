"use client";

import { useEffect, useState } from "react";
import { TimerState } from "@/lib/types";

export function useSyncedTimer(timer: TimerState | null, phase: string) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!timer || phase !== "answering") {
      setRemainingMs(0);
      return;
    }

    const tick = () => setRemainingMs(Math.max(0, timer.endsAt - Date.now()));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [timer, phase]);

  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = seconds <= 3 && seconds > 0;
  return { seconds, urgent, expired: remainingMs <= 0 };
}
