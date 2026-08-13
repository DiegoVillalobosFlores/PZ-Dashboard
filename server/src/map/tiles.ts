import { existsSync, mkdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { MAP_CACHE_DIR, PZ_INSTALL_DIR } from "../config";

const PYRAMID_FILE = "spawnSelectImagePyramid.zip";
const TILE_SIZE = 256;

function mapsDir(): string {
  if (!PZ_INSTALL_DIR) {
    throw new Error("PZ_INSTALL_DIR is not set - see .env.example");
  }
  return join(PZ_INSTALL_DIR, "media", "maps");
}

// Each named map region (Muldraugh, KY / West Point, KY / ...) ships its own
// pre-rendered zoomable tile pyramid, used by the game's own spawn-point
// map screen. It's real map art, not something we generate ourselves.
export async function listRegions(): Promise<string[]> {
  const entries = await readdir(mapsDir(), { withFileTypes: true });
  const regions: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (existsSync(join(mapsDir(), entry.name, PYRAMID_FILE))) {
      regions.push(entry.name);
    }
  }
  return regions.sort();
}

const extractions = new Map<string, Promise<string>>();

// Extracts a region's tile pyramid into a disk cache on first request, then
// reuses it - a few thousand small PNGs per region, cheap to keep around,
// expensive-ish (a couple of seconds) to unzip on every request.
function ensureExtracted(region: string): Promise<string> {
  const cached = extractions.get(region);
  if (cached) return cached;

  const promise = (async () => {
    const destDir = join(MAP_CACHE_DIR, region);
    const marker = join(destDir, ".extracted");
    if (existsSync(marker)) return destDir;

    const zipPath = join(mapsDir(), region, PYRAMID_FILE);
    if (!existsSync(zipPath)) {
      throw new Error(`No map imagery for region "${region}"`);
    }

    mkdirSync(destDir, { recursive: true });
    const commands = [
      ["unzip", "-o", "-q", zipPath, "-d", destDir],
      ["tar", "-xf", zipPath, "-C", destDir],
    ];
    let extracted = false;
    let lastError = "";
    for (const command of commands) {
      try {
        const proc = Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
        const exitCode = await proc.exited;
        if (exitCode === 0) {
          extracted = true;
          break;
        }
        lastError = `${command[0]} exit ${exitCode}`;
      } catch {
        lastError = `${command[0]} unavailable`;
      }
    }
    if (!extracted) {
      throw new Error(`Failed to extract map tiles for "${region}" (${lastError})`);
    }

    await Bun.write(marker, "");
    return destDir;
  })();

  extractions.set(region, promise);
  return promise;
}

export type ZoomLevelMeta = {
  zoom: number;
  tileSize: number;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
};

// Reads tile extents straight from the zip listing (no extraction needed)
// so metadata is cheap to query even before a region's tiles are cached.
export async function getRegionMeta(region: string): Promise<ZoomLevelMeta[]> {
  const zipPath = join(mapsDir(), region, PYRAMID_FILE);
  if (!existsSync(zipPath)) {
    throw new Error(`No map imagery for region "${region}"`);
  }

  const proc = Bun.spawn(["unzip", "-l", zipPath]);
  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const byZoom = new Map<number, { cols: number[]; rows: number[] }>();
  const tilePattern = /(\d+)\/tile(\d+)x(\d+)\.png/g;
  for (const match of output.matchAll(tilePattern)) {
    const zoom = Number(match[1]);
    const col = Number(match[2]);
    const row = Number(match[3]);
    let entry = byZoom.get(zoom);
    if (!entry) {
      entry = { cols: [], rows: [] };
      byZoom.set(zoom, entry);
    }
    entry.cols.push(col);
    entry.rows.push(row);
  }

  return Array.from(byZoom.entries())
    .map(([zoom, { cols, rows }]) => ({
      zoom,
      tileSize: TILE_SIZE,
      minCol: Math.min(...cols),
      maxCol: Math.max(...cols),
      minRow: Math.min(...rows),
      maxRow: Math.max(...rows),
    }))
    .sort((a, b) => a.zoom - b.zoom);
}

export async function getTilePath(region: string, zoom: number, x: number, y: number): Promise<string> {
  const dir = await ensureExtracted(region);
  return join(dir, String(zoom), `tile${x}x${y}.png`);
}

// World-square -> zoom-0 pixel scale, per region. Not derived from an
// official formula (no decompiled Java available) - empirically calibrated
// by locating the "Muldraugh" star marker on the actual tile art (measured
// centroid, pixel 5524.4/4619.5 at zoom 0) against the town's suggested
// view center from its map info file (zoomX/zoomY 11181/9725 world
// squares), then cross-checked by converting a live player position near
// Riverside and confirming it lands inside the "Riverside" label area on
// the tile art. Origin (0,0 world square = 0,0 pixel) is confirmed by
// vanilla source (MapSpawnSelect.lua: setBoundsInSquares(0, 0, ...)).
// ~5% axis-to-axis discrepancy in the calibration fit - good enough to
// locate the right neighborhood, not pixel-exact.
const WORLD_TO_PIXEL_SCALE: Record<string, { scaleX: number; scaleY: number }> = {
  "Muldraugh, KY": { scaleX: 5524.4 / 11181, scaleY: 4619.5 / 9725 },
};

export type TileLocation = {
  zoom: number;
  tileX: number;
  tileY: number;
  pixelXInTile: number;
  pixelYInTile: number;
};

// Converts a live player world-square position (from /api/state/map) into
// a tile + pixel-within-tile at the given zoom, so a frontend can center
// the map view on the player.
export function worldToTile(region: string, worldX: number, worldY: number, zoom: number): TileLocation {
  const calibration = WORLD_TO_PIXEL_SCALE[region];
  if (!calibration) {
    throw new Error(`No coordinate calibration for region "${region}"`);
  }

  const zoomScale = 2 ** zoom; // each zoom level halves pixel density vs. zoom 0
  const pixelX = (worldX * calibration.scaleX) / zoomScale;
  const pixelY = (worldY * calibration.scaleY) / zoomScale;

  return {
    zoom,
    tileX: Math.floor(pixelX / TILE_SIZE),
    tileY: Math.floor(pixelY / TILE_SIZE),
    pixelXInTile: pixelX % TILE_SIZE,
    pixelYInTile: pixelY % TILE_SIZE,
  };
}
