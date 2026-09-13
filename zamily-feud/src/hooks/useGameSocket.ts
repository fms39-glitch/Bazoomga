"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { EVENTS } from "@/lib/events";
import { PublicGameState } from "@/lib/types";

const STORAGE_KEY = "zamily-feud-session";

interface Session {
  roomCode: string;
  playerId: string;
  name: string;
}

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<PublicGameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetSession = useCallback(() => {
    saveSession(null);
    setState(null);
    setPlayerId(null);
    setRoomCode(null);
    setError(null);
  }, []);

  useEffect(() => {
    const socket = io({ path: "/api/socket", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on(EVENTS.ROOM_ERROR, (payload: { message: string }) => setError(payload.message));
    socket.on(EVENTS.ROOM_CLOSED, (payload: { message: string }) => {
      setError(payload.message);
      resetSession();
    });
    socket.on(EVENTS.ROOM_CREATED, (payload: { roomCode: string; playerId: string; state: PublicGameState }) => {
      setRoomCode(payload.roomCode);
      setPlayerId(payload.playerId);
      setState(payload.state);
      setError(null);
      const me = payload.state.players.find((p) => p.id === payload.playerId);
      saveSession({ roomCode: payload.roomCode, playerId: payload.playerId, name: me?.name ?? "Host" });
    });
    socket.on(EVENTS.ROOM_JOINED, (payload: { roomCode: string; playerId: string; state: PublicGameState }) => {
      setRoomCode(payload.roomCode);
      setPlayerId(payload.playerId);
      setState(payload.state);
      setError(null);
      const me = payload.state.players.find((p) => p.id === payload.playerId);
      saveSession({ roomCode: payload.roomCode, playerId: payload.playerId, name: me?.name ?? "Player" });
    });
    socket.on(EVENTS.ROOM_STATE, (payload: PublicGameState) => setState(payload));

    const session = loadSession();
    if (session?.roomCode && session.name) {
      socket.emit(EVENTS.ROOM_JOIN, {
        roomCode: session.roomCode,
        name: session.name,
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [resetSession]);

  const createRoom = useCallback((name: string) => {
    const trimmed = name.trim() || "Host";
    saveSession(null);
    socketRef.current?.emit(EVENTS.ROOM_CREATE, { name: trimmed });
  }, []);

  const joinRoom = useCallback((code: string, name: string) => {
    const trimmedName = name.trim() || "Player";
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError("Enter a room code to join.");
      return;
    }
    socketRef.current?.emit(EVENTS.ROOM_JOIN, { roomCode: trimmedCode, name: trimmedName });
  }, []);

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const isHost = state && playerId ? state.hostId === playerId : false;
  const isActive =
    state?.active && playerId
      ? playerId === state.active.playerAId || playerId === state.active.playerBId
      : false;

  return {
    connected,
    state,
    playerId,
    roomCode,
    error,
    isHost,
    isActive,
    createRoom,
    joinRoom,
    emit,
    resetSession,
    socket: socketRef.current,
  };
}
