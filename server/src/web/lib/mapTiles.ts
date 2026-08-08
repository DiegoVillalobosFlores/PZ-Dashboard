import { apiBase } from './api';

// Only region with a calibrated world-square -> pixel transform so far
// (server/src/map/tiles.ts) - see the pz-mod-server skill for how that was
// derived. It's also the master mosaic for the whole connected default
// world, not just the town of Muldraugh, so it's the right default even
// when the player is elsewhere on the map.
export const DEFAULT_MAP_REGION = 'Muldraugh, KY';
export const TILE_SIZE = 256;

export function tileUrl(region: string, zoom: number, x: number, y: number): string {
  return `${apiBase()}/api/map/${encodeURIComponent(region)}/${zoom}/${x}/${y}`;
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
