"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SOCKET_EVENTS } from "@/shared/events";
import type {
  AnswerMode,
  GameConfig,
  Player,
  PublicGameState,
  SessionIdentity,
} from "@/shared/types";
import { detectPlatform, resolveIdentity, sessionKey } from "./platform";
import { getSocket } from "./socket";

interface JoinResult {
  ok: boolean;
  message?: string;
  player?: Player;
  state?: PublicGameState;
}

export function useGame() {
  const [state, setState] = useState<PublicGameState | null>(null);
  const [me, setMe] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState = (next: PublicGameState) => setState(next);
    const onError = (payload: { message: string }) => setError(payload.message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(SOCKET_EVENTS.ROOM_STATE, onState);
    socket.on(SOCKET_EVENTS.ROOM_ERROR, onError);
    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(SOCKET_EVENTS.ROOM_STATE, onState);
      socket.off(SOCKET_EVENTS.ROOM_ERROR, onError);
    };
  }, []);

  const persist = useCallback((identity: SessionIdentity, player: Player) => {
    sessionStorage.setItem(
      sessionKey(identity.roomCode),
      JSON.stringify({ ...identity, playerId: player.id })
    );
    setMe(player);
  }, []);

  const createRoom = useCallback(
    async (name: string) => {
      const identity = await resolveIdentity(name);
      const socket = getSocket();
      return await new Promise<JoinResult>((resolve) => {
        socket.emit(
          SOCKET_EVENTS.ROOM_CREATE,
          { name: identity.name, platform: identity.platform },
          (result: JoinResult) => {
            if (result.ok && result.player && result.state) {
              persist(
                {
                  playerId: result.player.id,
                  name: result.player.name,
                  roomCode: result.state.roomCode,
                  isHost: true,
                },
                result.player
              );
              setState(result.state);
              setError(null);
            } else {
              setError(result.message ?? "Could not create room");
            }
            resolve(result);
          }
        );
      });
    },
    [persist]
  );

  const joinRoom = useCallback(
    async (code: string, name: string, playerId?: string) => {
      const identity = await resolveIdentity(name);
      const socket = getSocket();
      return await new Promise<JoinResult>((resolve) => {
        socket.emit(
          SOCKET_EVENTS.ROOM_JOIN,
          {
            code,
            name: identity.name,
            playerId,
            platform: identity.platform,
          },
          (result: JoinResult) => {
            if (result.ok && result.player && result.state) {
              persist(
                {
                  playerId: result.player.id,
                  name: result.player.name,
                  roomCode: result.state.roomCode,
                  isHost: result.player.isHost,
                },
                result.player
              );
              setState(result.state);
              setError(null);
            } else {
              setError(result.message ?? "Could not join room");
            }
            resolve(result);
          }
        );
      });
    },
    [persist]
  );

  const emit = useCallback((event: string, payload?: unknown) => {
    getSocket().emit(event, payload);
  }, []);

  const actions = useMemo(
    () => ({
      configure: (patch: Partial<GameConfig>) => emit(SOCKET_EVENTS.HOST_CONFIGURE, patch),
      start: () => emit(SOCKET_EVENTS.HOST_START),
      begin: () => emit("host:begin"),
      pause: () => emit(SOCKET_EVENTS.HOST_PAUSE),
      resume: () => emit(SOCKET_EVENTS.HOST_RESUME),
      stop: () => emit(SOCKET_EVENTS.HOST_STOP),
      forceNext: () => emit(SOCKET_EVENTS.HOST_FORCE_NEXT),
      switchMode: (mode: AnswerMode) => emit(SOCKET_EVENTS.HOST_SWITCH_MODE, { mode }),
      override: (payload: {
        playerId: string;
        points: number;
        correct: boolean;
        matchedAnswer?: string;
      }) => emit(SOCKET_EVENTS.HOST_OVERRIDE, payload),
      ready: () => emit(SOCKET_EVENTS.PLAYER_READY),
      decline: () => emit(SOCKET_EVENTS.PLAYER_DECLINE),
      ttsEnded: () => emit(SOCKET_EVENTS.TTS_ENDED),
      submitAnswer: (text: string) => emit(SOCKET_EVENTS.ANSWER_SUBMIT, { text }),
    }),
    [emit]
  );

  const currentMe =
    me && state ? state.players.find((player) => player.id === me.id) ?? me : me;

  return {
    state,
    me: currentMe,
    error,
    connected,
    platform: detectPlatform(),
    createRoom,
    joinRoom,
    actions,
  };
}

export function readSession(roomCode: string): SessionIdentity | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(sessionKey(roomCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionIdentity;
  } catch {
    return null;
  }
}
