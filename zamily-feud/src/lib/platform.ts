import type { Platform } from "./types";

export interface RuntimeIdentity {
  name: string;
  platform: Platform;
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  const params = new URLSearchParams(window.location.search);
  if (params.get("platform") === "zoom") return "zoom";
  if ("zoomSdk" in window) return "zoom";
  return navigator.userAgent.toLowerCase().includes("zoom") ? "zoom" : "web";
}

export async function resolveIdentity(fallbackName: string): Promise<RuntimeIdentity> {
  return { name: fallbackName, platform: detectPlatform() };
}

export function sessionKey(roomCode: string) {
  return `zamily-feud:${roomCode.toUpperCase()}`;
}
