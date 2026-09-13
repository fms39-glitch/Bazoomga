"use client";

import { useEffect, useState } from "react";
import { SOCKET_EVENTS } from "@/shared/events";
import type { TimerState } from "@/shared/types";
import { getSocket } from "./socket";

interface TimerPayload {
  startedAt: number;
  endsAt: number;
  serverNow: number;
}

export function useSyncedTimer(timer: TimerState | null) {
  const [remaining, setRemaining] = useState(timer?.remainingMs ?? 0);
  const [endsAt, setEndsAt] = useState(timer?.endsAt ?? null);
  const [skew, setSkew] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    const onStart = (payload: TimerPayload) => {
      setSkew(payload.serverNow - Date.now());
      setEndsAt(payload.endsAt);
    };
    socket.on(SOCKET_EVENTS.TIMER_START, onStart);
    return () => {
      socket.off(SOCKET_EVENTS.TIMER_START, onStart);
    };
  }, []);

  useEffect(() => {
    if (timer?.endsAt) {
      setEndsAt(timer.endsAt);
    }
  }, [timer?.endsAt]);

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      setRemaining(Math.max(0, endsAt - Date.now() - skew));
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [endsAt, skew]);

  return remaining;
}
