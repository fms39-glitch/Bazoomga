import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
  socket = io(url, {
    path: "/socket.io",
    autoConnect: true,
    transports: ["websocket", "polling"],
  });

  return socket;
}
