import type { GameFiles, Codecs } from "../index";
import { listZip } from "../zip";
import { joinPath } from "../path";

const PYRAMID_FILE = "spawnSelectImagePyramid.zip";
const TILE_SIZE = 256;

function mapsDir(installDir: string): string {
  if (!installDir) {
    throw new Error("PZ_INSTALL_DIR is not set - see .env.example");
  }
  return joinPath(installDir, "media", "maps");
}

// Each named map region (Muldraugh, KY / West Point, KY / ...) ships its own
// pre-rendered zoomable tile pyramid, used by the game's own spawn-point
// map screen. It's real map art, not something we generate ourselves.
export async function listRegions(files: GameFiles, installDir: string): Promise<string[]> {
  const root = mapsDir(installDir);
  const entries = await files.list(root);
  const regions: string[] = [];
  for (const entry of entries) {
    if (await files.stat(joinPath(root, entry, PYRAMID_FILE))) regions.push(entry);
  }
  return regions.sort();
}

const extractions = new Map<string, Promise<string>>();
const repaired = new Set<string>();

// Extracts a region's tile pyramid into a disk cache on first request, then
// reuses it - a few thousand small PNGs per region, cheap to keep around,
// expensive-ish (a couple of seconds) to unzip on every request.
function ensureExtracted(files: GameFiles, codecs: Codecs, installDir: string, cacheDir: string, region: string, force = false): Promise<string> {
  const key = `${installDir}\0${cacheDir}\0${region}`;
  const cached = extractions.get(key);
  // The memo alone is not enough: a browser can evict the OPFS cache after
  // we extracted into it, so re-check the marker still exists on disk
  // before handing back a directory we only remember writing.
  if (cached && !force) {
    return cached.then(async (dir) => {
      if (await files.stat(joinPath(dir, ".extracted"))) return dir;
      extractions.delete(key);
      return ensureExtracted(files, codecs, installDir, cacheDir, region);
    });
  }

  const promise = (async () => {
    const destDir = joinPath(cacheDir, region);
    const marker = joinPath(destDir, ".extracted");
    if (!force && await files.stat(marker)) return destDir;

    const zipPath = joinPath(mapsDir(installDir), region, PYRAMID_FILE);
    if (!(await files.stat(zipPath))) {
      throw new Error(`No map imagery for region "${region}"`);
    }

    const filesByName = await codecs.inflateZip(await files.read(zipPath));
    for (const [name, data] of filesByName) await files.write(joinPath(destDir, name), data);
    await files.write(marker, "");
    return destDir;
  })();

  extractions.set(key, promise.catch((error) => {
    extractions.delete(key);
    throw error;
  }));
  return extractions.get(key)!;
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
export async function getRegionMeta(files: GameFiles, installDir: string, region: string): Promise<ZoomLevelMeta[]> {
  const zipPath = joinPath(mapsDir(installDir), region, PYRAMID_FILE);
  if (!(await files.stat(zipPath))) {
    throw new Error(`No map imagery for region "${region}"`);
  }

  const output = listZip(await files.read(zipPath)).join("\n");

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

export async function getTilePath(files: GameFiles, codecs: Codecs, installDir: string, cacheDir: string, region: string, zoom: number, x: number, y: number): Promise<string> {
  const key = `${installDir}\0${cacheDir}\0${region}`;
  let dir = await ensureExtracted(files, codecs, installDir, cacheDir, region);
  let path = joinPath(dir, String(zoom), `tile${x}x${y}.png`);
  // A missing tile under an intact marker means the cache was partially
  // evicted - but it also means the coordinate was never in the pyramid,
  // and we can't tell those apart without the zip listing. Repair the
  // region at most once so a genuinely absent tile can't make every
  // request for it re-extract the whole pyramid.
  if (!(await files.stat(path)) && !repaired.has(key) && await files.stat(joinPath(dir, ".extracted"))) {
    repaired.add(key);
    extractions.delete(key);
    dir = await ensureExtracted(files, codecs, installDir, cacheDir, region, true);
    path = joinPath(dir, String(zoom), `tile${x}x${y}.png`);
  }
  return path;
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
