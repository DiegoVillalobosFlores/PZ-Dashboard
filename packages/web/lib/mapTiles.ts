import { apiBase } from './api';

// Only region with a calibrated world-square -> pixel transform so far
// (server/src/map/tiles.ts) - see the pz-mod-server skill for how that was
// derived. It's also the master mosaic for the whole connected default
// world, not just the town of Muldraugh, so it's the right default even
// when the player is elsewhere on the map.
export const DEFAULT_MAP_REGION = 'Muldraugh, KY';
export const TILE_SIZE = 256;
export const BROAD_VIEW_ZOOM_SQUARES = 5120;
export const TILE_PREFETCH_RATIO = 0.15;

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldToPixelTransform {
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
}

export interface ZoomLevelMeta {
  zoom: number;
  tileSize: number;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

export interface MapRegionMeta {
  region: string;
  zoomLevels: ZoomLevelMeta[];
  worldToPixel?: WorldToPixelTransform | null;
}

export interface TileViewport {
  center: WorldPoint;
  zoomSquares: number;
  width: number;
  height: number;
}

export interface WorldBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TilePlacement {
  zoom: number;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TileCoverage {
  level: ZoomLevelMeta;
  bounds: WorldBounds;
  tiles: TilePlacement[];
}

export function tileUrl(region: string, zoom: number, x: number, y: number): string {
  return `${apiBase()}/api/map/${encodeURIComponent(region)}/${zoom}/${x}/${y}`;
}

export async function queryMapMeta(region: string): Promise<MapRegionMeta | null> {
  const url = `${apiBase()}/api/map/${encodeURIComponent(region)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const meta = (await res.json()) as MapRegionMeta;
  if (!meta || !Array.isArray(meta.zoomLevels)) return null;
  return meta;
}

export function isTileMapSupported(meta: MapRegionMeta | null): meta is MapRegionMeta & { worldToPixel: WorldToPixelTransform } {
  const transform = meta?.worldToPixel;
  if (!meta || !transform || typeof transform !== 'object') return false;
  return (
    Number.isFinite(transform.originX) &&
    Number.isFinite(transform.originY) &&
    Number.isFinite(transform.scaleX) &&
    Number.isFinite(transform.scaleY) &&
    transform.scaleX > 0 &&
    transform.scaleY > 0 &&
    meta.zoomLevels.some((level) => isValidZoomLevel(level))
  );
}

export function isValidZoomLevel(level: unknown): level is ZoomLevelMeta {
  if (!level || typeof level !== 'object') return false;
  const candidate = level as ZoomLevelMeta;
  return (
    Number.isInteger(candidate.zoom) &&
    candidate.zoom >= 0 &&
    Number.isInteger(candidate.tileSize) &&
    candidate.tileSize > 0 &&
    Number.isInteger(candidate.minCol) &&
    Number.isInteger(candidate.maxCol) &&
    Number.isInteger(candidate.minRow) &&
    Number.isInteger(candidate.maxRow) &&
    candidate.minCol <= candidate.maxCol &&
    candidate.minRow <= candidate.maxRow
  );
}

export function selectTileLevel(
  levels: readonly ZoomLevelMeta[],
  viewport: Pick<TileViewport, 'zoomSquares' | 'width' | 'height'>,
  transform: WorldToPixelTransform,
): ZoomLevelMeta | null {
  const scale = Math.sqrt(transform.scaleX * transform.scaleY);
  if (!Number.isFinite(scale) || scale <= 0 || viewport.zoomSquares <= 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const targetPixelsPerWorld = Math.max(viewport.width, viewport.height) / viewport.zoomSquares;
  let selected: ZoomLevelMeta | null = null;
  let selectedDistance = Infinity;

  for (const level of levels) {
    if (!isValidZoomLevel(level)) continue;
    const pixelsPerWorld = scale / 2 ** level.zoom;
    const distance = Math.abs(Math.log2(pixelsPerWorld / targetPixelsPerWorld));
    if (distance < selectedDistance || (distance === selectedDistance && level.zoom < (selected?.zoom ?? Infinity))) {
      selected = level;
      selectedDistance = distance;
    }
  }

  return selected;
}

export function viewportWorldBounds(viewport: TileViewport, marginWorld = 0): WorldBounds {
  const span = Math.max(viewport.width, viewport.height);
  if (span <= 0 || viewport.zoomSquares <= 0) {
    return { x1: viewport.center.x, y1: viewport.center.y, x2: viewport.center.x, y2: viewport.center.y };
  }
  const halfWidth = (viewport.zoomSquares * viewport.width) / span / 2;
  const halfHeight = (viewport.zoomSquares * viewport.height) / span / 2;
  return {
    x1: viewport.center.x - halfWidth - marginWorld,
    y1: viewport.center.y - halfHeight - marginWorld,
    x2: viewport.center.x + halfWidth + marginWorld,
    y2: viewport.center.y + halfHeight + marginWorld,
  };
}

// A zoom level halves pixel density, so the transform's origin offset scales
// with it exactly like its scale does - leaving the origin at zoom-0 pixels
// here shifts every tile by originX * (2^zoom - 1) world squares.
function levelTransform(level: ZoomLevelMeta, transform: WorldToPixelTransform): WorldToPixelTransform {
  const divisor = 2 ** level.zoom;
  return {
    originX: transform.originX / divisor,
    originY: transform.originY / divisor,
    scaleX: transform.scaleX / divisor,
    scaleY: transform.scaleY / divisor,
  };
}

export function tileWorldRect(level: ZoomLevelMeta, transform: WorldToPixelTransform, tileX: number, tileY: number): TilePlacement {
  const { originX, originY, scaleX, scaleY } = levelTransform(level, transform);
  return {
    zoom: level.zoom,
    tileX,
    tileY,
    x: (tileX * level.tileSize - originX) / scaleX,
    y: (tileY * level.tileSize - originY) / scaleY,
    width: level.tileSize / scaleX,
    height: level.tileSize / scaleY,
  };
}

export function calculateViewportTileCoverage(
  level: ZoomLevelMeta,
  viewport: TileViewport,
  transform: WorldToPixelTransform,
  prefetchRatio = TILE_PREFETCH_RATIO,
): TileCoverage {
  const bounds = viewportWorldBounds(viewport, Math.max(viewport.zoomSquares, 0) * Math.max(prefetchRatio, 0));
  const { originX, originY, scaleX, scaleY } = levelTransform(level, transform);
  const minTileX = Math.max(level.minCol, Math.floor((bounds.x1 * scaleX + originX) / level.tileSize));
  const maxTileX = Math.min(level.maxCol, Math.ceil((bounds.x2 * scaleX + originX) / level.tileSize) - 1);
  const minTileY = Math.max(level.minRow, Math.floor((bounds.y1 * scaleY + originY) / level.tileSize));
  const maxTileY = Math.min(level.maxRow, Math.ceil((bounds.y2 * scaleY + originY) / level.tileSize) - 1);
  const tiles: TilePlacement[] = [];

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      tiles.push(tileWorldRect(level, transform, tileX, tileY));
    }
  }

  return { level, bounds, tiles };
}

export function tileKey(zoom: number, tileX: number, tileY: number): string {
  return `${zoom}/${tileX}/${tileY}`;
}

export interface TileLocation {
  zoom: number;
  tileX: number;
  tileY: number;
  pixelXInTile: number;
  pixelYInTile: number;
}

export async function locate(region: string, worldX: number, worldY: number, zoom: number): Promise<TileLocation | null> {
  const url = `${apiBase()}/api/map/${encodeURIComponent(region)}/locate?x=${worldX}&y=${worldY}&zoom=${zoom}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as TileLocation;
}
