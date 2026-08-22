import type { Codecs, GameFiles } from "./index";
import { getAllCategories, getCategory } from "./state/store";
import { writeCommand } from "./state/commands";
import { renderIcon } from "./icons";
import { getRegionMeta, getTilePath, listRegions, worldToTile } from "./map/tiles";
import { queryVectorMap } from "./map/vectorMap";
import { findRoute } from "./map/routing";
import { resolveModelPath, resolveTexturePath } from "./model/assets";
import { buildFigure } from "./model/figure";
import { loadMesh } from "./model/xModel";

export type RouteHandler = (request: Request) => Promise<Response>;

export type RouteOptions = {
  installDir: string;
  cacheDir: string;
  commandPath: string;
};

const IMMUTABLE = { "cache-control": "public, max-age=86400" };

function notFound() {
  return new Response("Not found", { status: 404 });
}

function badRequest(message: string) {
  return new Response(`Bad request: ${message}`, { status: 400 });
}

function contentType(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (/\.jpe?g$/.test(path)) return "image/jpeg";
  return "application/octet-stream";
}

function numbers(url: URL, names: string[]): number[] | null {
  const values = names.map((name) => Number(url.searchParams.get(name)));
  return values.every(Number.isFinite) ? values : null;
}

export function makeRoutes(files: GameFiles, codecs: Codecs, options: RouteOptions): RouteHandler {
  const { installDir, cacheDir, commandPath } = options;

  async function state(segments: string[]): Promise<Response> {
    if (segments.length === 2) return Response.json(getAllCategories());
    const snapshot = getCategory(segments[2]!);
    return snapshot ? Response.json(snapshot) : notFound();
  }

  async function action(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = (await request.json().catch(() => null)) as { action?: unknown; params?: Record<string, unknown> } | null;
    if (!body || typeof body.action !== "string") return badRequest("expected { action, params }");

    const id = crypto.randomUUID();
    await writeCommand(files, commandPath, { id, action: body.action, params: body.params ?? {} });
    return Response.json({ ok: true, id });
  }

  async function model(url: URL, kind: string): Promise<Response> {
    if (kind === "figure") {
      const snapshot = getCategory("appearance");
      if (!snapshot) return new Response("No appearance data yet", { status: 404 });
      try {
        const figure = await buildFigure(files, installDir, snapshot.data as Parameters<typeof buildFigure>[2]);
        return Response.json({ ...figure, updatedAt: snapshot.updatedAt });
      } catch (err) {
        return new Response(String(err), { status: 500 });
      }
    }

    const path = url.searchParams.get("path");
    if (!path) return badRequest("expected ?path=");

    if (kind === "mesh") {
      const resolved = await resolveModelPath(files, path, installDir);
      if (!resolved) return new Response("Model not found", { status: 404 });
      const mesh = await loadMesh(files.read, resolved);
      if (!mesh) return new Response("Model could not be parsed", { status: 415 });
      return Response.json(mesh, { headers: IMMUTABLE });
    }

    if (kind === "texture") {
      const resolved = await resolveTexturePath(files, path, installDir);
      if (!resolved) return new Response("Texture not found", { status: 404 });
      return new Response(await files.read(resolved), {
        headers: { "Content-Type": contentType(resolved), ...IMMUTABLE },
      });
    }

    return notFound();
  }

  async function map(url: URL, segments: string[]): Promise<Response> {
    if (segments.length === 3 && segments[2] === "regions") {
      try {
        return Response.json({ regions: await listRegions(files, installDir) });
      } catch (err) {
        return new Response(String(err), { status: 500 });
      }
    }

    const region = decodeURIComponent(segments[2]!);

    if (segments.length === 3) {
      try {
        return Response.json({ region, zoomLevels: await getRegionMeta(files, installDir, region) });
      } catch (err) {
        return new Response(String(err), { status: 404 });
      }
    }

    if (segments.length === 4) {
      if (segments[3] === "locate") {
        const coords = numbers(url, ["x", "y"]);
        if (!coords) return badRequest("expected ?x=&y= world-square coordinates");
        const zoom = Number(url.searchParams.get("zoom") ?? "0");
        try {
          return Response.json(worldToTile(region, coords[0]!, coords[1]!, zoom));
        } catch (err) {
          return new Response(String(err), { status: 404 });
        }
      }

      if (segments[3] === "features") {
        const bounds = numbers(url, ["x1", "y1", "x2", "y2"]);
        if (!bounds) return badRequest("expected ?x1=&y1=&x2=&y2= world-square bounds");
        try {
          return Response.json(await queryVectorMap(files, installDir, region, bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!));
        } catch (err) {
          return new Response(String(err), { status: 404 });
        }
      }

      if (segments[3] === "route") {
        const points = numbers(url, ["fromX", "fromY", "toX", "toY"]);
        if (!points) return badRequest("expected ?fromX=&fromY=&toX=&toY= world-square coordinates");
        try {
          return Response.json(await findRoute(files, installDir, region, { x: points[0]!, y: points[1]! }, { x: points[2]!, y: points[3]! }));
        } catch (err) {
          return new Response(String(err), { status: 404 });
        }
      }

      return notFound();
    }

    if (segments.length === 6) {
      const zoom = Number(segments[3]);
      const x = Number(segments[4]);
      const y = Number(segments[5]!.replace(/\.png$/, ""));
      if (!Number.isInteger(zoom) || !Number.isInteger(x) || !Number.isInteger(y)) {
        return new Response("Bad request: zoom/x/y must be integers", { status: 400 });
      }

      try {
        const path = await getTilePath(files, codecs, installDir, cacheDir, region, zoom, x, y);
        if (!(await files.stat(path))) return notFound();
        return new Response(await files.read(path), { headers: { "Content-Type": "image/png" } });
      } catch (err) {
        return new Response(String(err), { status: 404 });
      }
    }

    return notFound();
  }

  async function icon(segments: string[]): Promise<Response> {
    const name = decodeURIComponent(segments[1]!);
    if (!/^[A-Za-z0-9_]+\.png$/.test(name)) return notFound();

    let png: Uint8Array<ArrayBuffer> | null;
    try {
      png = await renderIcon(files, codecs, installDir, name.slice(0, -".png".length));
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
    if (!png) return notFound();
    return new Response(png, { headers: { "Content-Type": "image/png", ...IMMUTABLE } });
  }

  return async (request) => {
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments[0] === "game-icons" && segments.length === 2) return icon(segments);
    if (segments[0] !== "api" || segments.length < 2) return notFound();

    if (segments[1] === "state" && segments.length <= 3) return state(segments);
    if (segments[1] === "action" && segments.length === 2) return action(request);
    if (segments[1] === "model" && segments.length === 3) return model(url, segments[2]!);
    if (segments[1] === "map" && segments.length >= 3) return map(url, segments);

    return notFound();
  };
}
