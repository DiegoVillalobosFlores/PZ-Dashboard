import homepage from "../../../packages/web/index.html";
import { join } from "node:path";
import { makeRoutes } from "../../../packages/core/routes";
import { writeCommand } from "../../../packages/core/state/commands";
import { getAllCategories, onCategoryUpdate } from "../../../packages/core/state/store";
import { startWatcher } from "../../../packages/core/state/watcher";
import { makeNodeFiles, nodeCodecs } from "./files";
import { FILE_PREFIX, MAP_CACHE_DIR, PORT, PZ_INSTALL_DIR, PZ_LUA_DIR } from "./config";

const files = makeNodeFiles();
const commandPath = join(PZ_LUA_DIR, `${FILE_PREFIX}command.json`);

const api = makeRoutes(files, nodeCodecs, {
  installDir: PZ_INSTALL_DIR,
  cacheDir: MAP_CACHE_DIR,
  commandPath,
});

void startWatcher(files, PZ_LUA_DIR);

// All WebSocket clients subscribe to this single topic; the frontend
// filters by `category` client-side rather than us tracking per-client
// subscriptions, since every client wants the full state anyway.
const STATE_TOPIC = "state";

type ClientMessage =
  | { type: "action"; action: string; params?: Record<string, unknown>; requestId?: string }
  | { type: "ping" };

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: PORT,
  routes: {
    // "/ws" must be a static route (not caught by the "/*" SPA fallback
    // below) - Bun's router prefers exact matches over wildcards regardless
    // of declaration order, so this always wins.
    "/ws": (req, srv) => {
      const upgraded = srv.upgrade(req);
      if (!upgraded) return new Response("WebSocket upgrade failed", { status: 400 });
    },
    "/api/*": (req) => api(req),
    "/game-icons/*": (req) => api(req),
    // SPA fallback: React Router handles "/health", "/inventory", "/skills"
    // etc. client-side, so any GET not matched above (including a direct
    // browser navigation/refresh on those paths) serves the app shell.
    // Lowest-priority route - only reached once every route above misses.
    "/*": homepage,
  },
  websocket: {
    open(ws) {
      ws.subscribe(STATE_TOPIC);
      // Prime the newly connected client with everything we already know,
      // in the same shape as the live updates it'll get afterwards.
      for (const [category, snapshot] of Object.entries(getAllCategories())) {
        ws.send(JSON.stringify({ type: "state", category, ...snapshot }));
      }
    },
    async message(ws, raw) {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
        return;
      }

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (msg.type === "action") {
        if (typeof msg.action !== "string") {
          ws.send(JSON.stringify({ type: "error", message: "action must be a string", requestId: msg.requestId }));
          return;
        }
        const commandId = crypto.randomUUID();
        await writeCommand(files, commandPath, { id: commandId, action: msg.action, params: msg.params ?? {} });
        // Ack that the command was written; the actual result arrives later
        // as a normal state update on the "commandResult" category once the
        // mod picks it up and reports back.
        ws.send(JSON.stringify({ type: "actionAck", requestId: msg.requestId, commandId }));
      }
    },
  },
});

// Fan every store update out to subscribed WebSocket clients, in the same
// { type: "state", category, data, updatedAt } shape used for the initial
// snapshot on connect.
onCategoryUpdate((category, snapshot) => {
  server.publish(STATE_TOPIC, JSON.stringify({ type: "state", category, ...snapshot }));
});

console.log(`[server] listening on http://localhost:${PORT}`);
