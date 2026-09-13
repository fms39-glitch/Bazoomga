import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { config } from "dotenv";
import { attachGameServer } from "./src/server/socket";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

void app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    void handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: "/api/socket",
  });

  attachGameServer(io);

  httpServer.listen(port, hostname, () => {
    console.log(`Zamily Feud ready on http://localhost:${port}`);
    console.log("Open this URL in a browser or paste it into a Zoom meeting chat.");
  });
});
