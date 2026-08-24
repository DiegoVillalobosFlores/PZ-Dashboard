import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from '../apps/server/src/png';
import { getVectorMap } from '../packages/core/map/vectorMap';
import { getWorldToPixelTransform, type WorldToPixelTransform } from '../packages/core/map/tiles';
import type { GameFiles } from '../packages/core';

// Measures how well the spawn-screen paper map registers against the vector
// map the overlays are drawn in, by correlating the one feature class both
// assets contain: roads. The paper map draws them in a rust red nothing else
// on the parchment uses, so a red-channel threshold isolates them; worldmap.xml
// supplies the same roads in world squares. The transform that maximises the
// overlap is the map's true registration, and the spread of that transform
// across quadrants is the alignment tolerance a single affine can deliver.

const TILE_SIZE = 256;
const PROBE_ZOOM = Number(process.env.PROBE_ZOOM ?? 1);
const CELL_PIXELS = Number(process.env.CELL_PIXELS ?? 2);
const PIXELS_PER_CELL = 2 ** PROBE_ZOOM * CELL_PIXELS;
const ROAD_CATEGORIES = new Set(['road-primary', 'road-secondary', 'road-tertiary']);
const SCALE_CANDIDATES = [0.4975, 0.499, 0.5, 0.501, 0.5025];

const installDir = process.env.PZ_INSTALL_DIR ?? '';
const cacheDir = process.env.PZ_CACHE_DIR ?? join(import.meta.dir, '..', 'apps', 'server', '.cache', 'maps');

if (!installDir) {
  console.error('PZ_INSTALL_DIR is not set - see apps/server/.env.example');
  process.exit(1);
}

const files: GameFiles = {
  async read(path: string) {
    return new Uint8Array(await Bun.file(path).arrayBuffer());
  },
  async list(path: string) {
    return readdirSync(path);
  },
  async stat(path: string) {
    return existsSync(path) ? { mtimeMs: 0 } : null;
  },
  async write() {
    throw new Error('read-only');
  },
};

type Mask = { width: number; height: number; bits: Uint8Array };
type Area = { minX: number; minY: number; maxX: number; maxY: number };

function emptyMask(width: number, height: number): Mask {
  return { width, height, bits: new Uint8Array(width * height) };
}

async function readRoadInkMask(region: string): Promise<Mask | null> {
  const zoomDir = join(cacheDir, region, String(PROBE_ZOOM));
  if (!existsSync(zoomDir)) return null;

  let maxCol = -1;
  let maxRow = -1;
  for (const name of readdirSync(zoomDir)) {
    const match = /^tile(\d+)x(\d+)\.png$/.exec(name);
    if (!match) continue;
    maxCol = Math.max(maxCol, Number(match[1]));
    maxRow = Math.max(maxRow, Number(match[2]));
  }
  if (maxCol < 0) return null;

  const mask = emptyMask(
    Math.ceil(((maxCol + 1) * TILE_SIZE) / CELL_PIXELS),
    Math.ceil(((maxRow + 1) * TILE_SIZE) / CELL_PIXELS),
  );

  for (let row = 0; row <= maxRow; row++) {
    for (let col = 0; col <= maxCol; col++) {
      const path = join(zoomDir, `tile${col}x${row}.png`);
      if (!existsSync(path)) continue;
      const tile = decodePng(await files.read(path));
      for (let y = 0; y < tile.height; y++) {
        for (let x = 0; x < tile.width; x++) {
          const i = (y * tile.width + x) * 4;
          const r = tile.rgba[i]!;
          const g = tile.rgba[i + 1]!;
          const b = tile.rgba[i + 2]!;
          if (r < 90 || r - g < 40 || r - b < 50) continue;
          const cellX = Math.floor((col * TILE_SIZE + x) / CELL_PIXELS);
          const cellY = Math.floor((row * TILE_SIZE + y) / CELL_PIXELS);
          mask.bits[cellY * mask.width + cellX] = 1;
        }
      }
    }
  }

  return mask;
}

function scoreTransform(ink: Mask, roads: [number, number][][], transform: WorldToPixelTransform, area: Area | null): number {
  const seen = new Set<number>();
  let hit = 0;
  let total = 0;

  for (const points of roads) {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]!;
      const [bx, by] = points[i]!;
      if (area && (ax < area.minX || ax > area.maxX || ay < area.minY || ay > area.maxY)) continue;
      const x0 = (transform.originX + ax * transform.scaleX) / PIXELS_PER_CELL;
      const y0 = (transform.originY + ay * transform.scaleY) / PIXELS_PER_CELL;
      const x1 = (transform.originX + bx * transform.scaleX) / PIXELS_PER_CELL;
      const y1 = (transform.originY + by * transform.scaleY) / PIXELS_PER_CELL;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let step = 0; step <= steps; step++) {
        const x = Math.round(x0 + ((x1 - x0) * step) / steps);
        const y = Math.round(y0 + ((y1 - y0) * step) / steps);
        if (x < 0 || y < 0 || x >= ink.width || y >= ink.height) continue;
        const index = y * ink.width + x;
        if (seen.has(index)) continue;
        seen.add(index);
        total++;
        if (ink.bits[index]) hit++;
      }
    }
  }

  return total === 0 ? 0 : hit / total;
}

function fitOrigin(
  ink: Mask,
  roads: [number, number][][],
  scale: number,
  area: Area | null,
  start: { originX: number; originY: number },
): { transform: WorldToPixelTransform; overlap: number } {
  let best: WorldToPixelTransform = { originX: start.originX, originY: start.originY, scaleX: scale, scaleY: scale };
  let bestScore = scoreTransform(ink, roads, best, area);

  for (let step = 128; step >= 1; step /= 2) {
    let improved = true;
    while (improved) {
      improved = false;
      for (const candidate of [
        { ...best, originX: best.originX + step },
        { ...best, originX: best.originX - step },
        { ...best, originY: best.originY + step },
        { ...best, originY: best.originY - step },
      ]) {
        const value = scoreTransform(ink, roads, candidate, area);
        if (value > bestScore + 1e-6) {
          best = candidate;
          bestScore = value;
          improved = true;
        }
      }
    }
  }

  return { transform: best, overlap: bestScore };
}

function inkDensity(mask: Mask): number {
  let set = 0;
  for (const bit of mask.bits) if (bit) set++;
  return set / mask.bits.length;
}

async function main(): Promise<void> {
  const mapsRoot = join(installDir, 'media', 'maps');
  const regions = readdirSync(mapsRoot).filter((region) =>
    existsSync(join(mapsRoot, region, 'spawnSelectImagePyramid.zip')),
  );

  for (const region of regions) {
    const ink = await readRoadInkMask(region);
    if (!ink) {
      console.log(`\n${region}: no extracted tiles under ${cacheDir} - start the server and open the map once to populate the cache`);
      continue;
    }

    const vector = await getVectorMap(files, region, installDir);
    const roads = vector.features.filter((feature) => ROAD_CATEGORIES.has(feature.category)).map((feature) => feature.points);
    if (roads.length === 0) {
      console.log(`\n${region}: no vector roads to correlate against - region cannot be alignment-checked`);
      continue;
    }

    let bounds: Area = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const points of roads) {
      for (const [x, y] of points) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
    }

    let global = { transform: { originX: 0, originY: 0, scaleX: 0.5, scaleY: 0.5 }, overlap: 0 };
    for (const scale of SCALE_CANDIDATES) {
      const fit = fitOrigin(ink, roads, scale, null, { originX: 0, originY: 0 });
      if (fit.overlap > global.overlap) global = fit;
    }

    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;
    const quadrants: [string, Area][] = [
      ['NW', { minX: bounds.minX, minY: bounds.minY, maxX: midX, maxY: midY }],
      ['NE', { minX: midX, minY: bounds.minY, maxX: bounds.maxX, maxY: midY }],
      ['SW', { minX: bounds.minX, minY: midY, maxX: midX, maxY: bounds.maxY }],
      ['SE', { minX: midX, minY: midY, maxX: bounds.maxX, maxY: bounds.maxY }],
    ];

    const shipped = getWorldToPixelTransform(region);
    console.log(`\n${region}`);
    console.log(`  probe grid ${ink.width}x${ink.height} cells at ${PIXELS_PER_CELL} zoom-0 px per cell; road ink covers ${(inkDensity(ink) * 100).toFixed(1)}% of it (chance-overlap floor)`);
    console.log(`  vector road features: ${roads.length}`);
    console.log(
      shipped
        ? `  shipped  scaleX ${shipped.scaleX.toFixed(5)} scaleY ${shipped.scaleY.toFixed(5)} origin ${shipped.originX},${shipped.originY} -> overlap ${(scoreTransform(ink, roads, shipped, null) * 100).toFixed(1)}%`
        : '  shipped  none - region falls back to vector rendering',
    );
    console.log(`  best fit scaleX ${global.transform.scaleX.toFixed(5)} scaleY ${global.transform.scaleY.toFixed(5)} origin ${global.transform.originX},${global.transform.originY} -> overlap ${(global.overlap * 100).toFixed(1)}%`);

    let worst = 0;
    for (const [name, area] of quadrants) {
      const fit = fitOrigin(ink, roads, global.transform.scaleX, area, global.transform);
      const dx = fit.transform.originX - global.transform.originX;
      const dy = fit.transform.originY - global.transform.originY;
      worst = Math.max(worst, Math.abs(dx), Math.abs(dy));
      console.log(`  ${name} local offset ${dx},${dy} zoom-0 px = ${Math.round(Math.abs(dx) / global.transform.scaleX)},${Math.round(Math.abs(dy) / global.transform.scaleY)} world squares, overlap ${(fit.overlap * 100).toFixed(1)}%`);
    }
    console.log(`  alignment tolerance: +/-${worst} zoom-0 px = +/-${Math.round(worst / global.transform.scaleX)} world squares`);
  }
}

await main();
