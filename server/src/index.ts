import homepage from "../index.html";
import { join } from "node:path";
import { PORT } from "./config";
import { getRegionMeta, getTilePath, listRegions, worldToTile } from "./map/tiles";
import { queryVectorMap } from "./map/vectorMap";
import { findRoute } from "./map/routing";
import { resolveModelPath, resolveTexturePath } from "./model/assets";
import { buildFigure } from "./model/figure";
import { loadMesh } from "./model/xModel";
import { writeCommand } from "./state/commands";
import { getAllCategories, getCategory, onCategoryUpdate } from "./state/store";
import { startWatcher } from "./state/watcher";

await startWatcher();

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
    "/api/state": () => Response.json(getAllCategories()),
    "/api/state/:category": (req) => {
      const snapshot = getCategory(req.params.category);
      if (!snapshot) return new Response("Not found", { status: 404 });
      return Response.json(snapshot);
    },
    "/api/action": async (req) => {
      if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

      const body = await req.json().catch(() => null);
      if (!body || typeof body.action !== "string") {
        return new Response("Bad request: expected { action, params }", { status: 400 });
      }

      const id = crypto.randomUUID();
      await writeCommand({ id, action: body.action, params: body.params ?? {} });
      return Response.json({ ok: true, id });
    },
    // The character figure: the mod reports ids (which ClothingItem, which
    // texture choice), and this resolves them against the game install into
    // a draw list of mesh + texture URLs the browser can fetch.
    "/api/model/figure": async () => {
      const snapshot = getCategory("appearance");
      if (!snapshot) return new Response("No appearance data yet", { status: 404 });
      try {
        const figure = await buildFigure(snapshot.data as Parameters<typeof buildFigure>[0]);
        return Response.json({ ...figure, updatedAt: snapshot.updatedAt });
      } catch (err) {
        return new Response(String(err), { status: 500 });
      }
    },
    "/api/model/mesh": async (req) => {
      const path = new URL(req.url).searchParams.get("path");
      if (!path) return new Response("Bad request: expected ?path=", { status: 400 });
      const resolved = await resolveModelPath(path);
      if (!resolved) return new Response("Model not found", { status: 404 });
      const mesh = await loadMesh(resolved);
      if (!mesh) return new Response("Model could not be parsed", { status: 415 });
      return Response.json(mesh, { headers: { "cache-control": "public, max-age=86400" } });
    },
    "/api/model/texture": async (req) => {
      const path = new URL(req.url).searchParams.get("path");
      if (!path) return new Response("Bad request: expected ?path=", { status: 400 });
      const resolved = await resolveTexturePath(path);
      if (!resolved) return new Response("Texture not found", { status: 404 });
      return new Response(Bun.file(resolved), { headers: { "cache-control": "public, max-age=86400" } });
    },
    "/api/map/regions": async () => {
      try {
        return Response.json({ regions: await listRegions() });
      } catch (err) {
        return new Response(String(err), { status: 500 });
      }
    },
    "/api/map/:region": async (req) => {
      try {
        const zoomLevels = await getRegionMeta(req.params.region);
        return Response.json({ region: req.params.region, zoomLevels });
      } catch (err) {
        return new Response(String(err), { status: 404 });
      }
    },
    "/api/map/:region/locate": (req) => {
      const url = new URL(req.url);
      const x = Number(url.searchParams.get("x"));
      const y = Number(url.searchParams.get("y"));
      const zoom = Number(url.searchParams.get("zoom") ?? "0");
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return new Response("Bad request: expected ?x=&y= world-square coordinates", { status: 400 });
      }

      try {
        return Response.json(worldToTile(req.params.region, x, y, zoom));
      } catch (err) {
        return new Response(String(err), { status: 404 });
      }
    },
    "/api/map/:region/features": (req) => {
      const url = new URL(req.url);
      const x1 = Number(url.searchParams.get("x1"));
      const y1 = Number(url.searchParams.get("y1"));
      const x2 = Number(url.searchParams.get("x2"));
      const y2 = Number(url.searchParams.get("y2"));
      if (![x1, y1, x2, y2].every(Number.isFinite)) {
        return new Response("Bad request: expected ?x1=&y1=&x2=&y2= world-square bounds", { status: 400 });
      }

      try {
        return Response.json(queryVectorMap(req.params.region, x1, y1, x2, y2));
      } catch (err) {
        return new Response(String(err), { status: 404 });
      }
    },
    "/api/map/:region/route": (req) => {
      const url = new URL(req.url);
      const fromX = Number(url.searchParams.get("fromX"));
      const fromY = Number(url.searchParams.get("fromY"));
      const toX = Number(url.searchParams.get("toX"));
      const toY = Number(url.searchParams.get("toY"));
      if (![fromX, fromY, toX, toY].every(Number.isFinite)) {
        return new Response("Bad request: expected ?fromX=&fromY=&toX=&toY= world-square coordinates", {
          status: 400,
        });
      }

      try {
        const route = findRoute(req.params.region, { x: fromX, y: fromY }, { x: toX, y: toY });
        return Response.json(route);
      } catch (err) {
        return new Response(String(err), { status: 404 });
      }
    },
    // Item icons extracted from the game's UI.pack/UI2.pack texture atlases -
    // filenames match the subtexture names the mod reports as `icon` on
    // inventory items (item:getTex():getName() in
    // PZDashboard_Collectors.lua), e.g. "Item_Radish.png".
    "/game-icons/:name": async (req) => {
      const name = req.params.name;
      if (!/^[A-Za-z0-9_]+\.png$/.test(name)) return new Response("Not found", { status: 404 });
      const file = Bun.file(join(import.meta.dir, "..", "public", "game-icons", name));
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      return new Response(file, { headers: { "Content-Type": "image/png" } });
    },
    "/api/map/:region/:zoom/:x/:y": async (req) => {
      const zoom = Number(req.params.zoom);
      const x = Number(req.params.x);
      const y = Number(req.params.y.replace(/\.png$/, ""));
      if (!Number.isInteger(zoom) || !Number.isInteger(x) || !Number.isInteger(y)) {
        return new Response("Bad request: zoom/x/y must be integers", { status: 400 });
      }

      try {
        const path = await getTilePath(req.params.region, zoom, x, y);
        const file = Bun.file(path);
        if (!(await file.exists())) return new Response("Not found", { status: 404 });
        return new Response(file, { headers: { "Content-Type": "image/png" } });
      } catch (err) {
        return new Response(String(err), { status: 404 });
      }
    },
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
        await writeCommand({ id: commandId, action: msg.action, params: msg.params ?? {} });
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
