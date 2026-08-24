import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateViewportTileCoverage,
  isValidZoomLevel,
  isTileMapSupported,
  selectTileLevel,
  tileKey,
  tileUrl,
  type MapRegionMeta,
  type TilePlacement,
  type TileViewport,
} from '../lib/mapTiles';

type TileRecord = {
  status: 'pending' | 'loaded' | 'failed';
  src?: string;
  promise?: Promise<string>;
  controller?: AbortController;
  lastUsed: number;
};

type QueuedTile = {
  key: string;
  url: string;
  resolve: (src: string) => void;
  reject: (error: unknown) => void;
};

const MAX_CONCURRENT_TILE_REQUESTS = 8;
const MAX_CACHED_TILES = 128;
const tileRecords = new Map<string, TileRecord>();
const tileQueue: QueuedTile[] = [];
let activeTileRequests = 0;

function runTileQueue(): void {
  while (activeTileRequests < MAX_CONCURRENT_TILE_REQUESTS && tileQueue.length > 0) {
    const request = tileQueue.shift()!;
    const record = tileRecords.get(request.key);
    if (!record || record.status !== 'pending') {
      request.reject(new Error('Tile request was cancelled'));
      continue;
    }

    activeTileRequests += 1;
    const controller = new AbortController();
    record.controller = controller;
    fetch(request.url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Map tile request failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        const src = URL.createObjectURL(blob);
        const current = tileRecords.get(request.key);
        if (!current || current.status !== 'pending') {
          URL.revokeObjectURL(src);
          request.reject(new Error('Tile request was cancelled'));
          return;
        }
        current.status = 'loaded';
        current.src = src;
        current.promise = undefined;
        current.controller = undefined;
        request.resolve(src);
      })
      .catch((error) => {
        const current = tileRecords.get(request.key);
        if (current?.status === 'pending') {
          current.status = 'failed';
          current.promise = undefined;
          current.controller = undefined;
        }
        request.reject(error);
      })
      .finally(() => {
        activeTileRequests -= 1;
        runTileQueue();
      });
  }
}

function requestTile(key: string, url: string): Promise<string> {
  const existing = tileRecords.get(key);
  if (existing?.status === 'loaded' && existing.src) {
    existing.lastUsed = Date.now();
    return Promise.resolve(existing.src);
  }
  if (existing?.status === 'pending') {
    existing.lastUsed = Date.now();
    return existing.promise ?? Promise.reject(new Error('Tile request has no promise'));
  }

  const record: TileRecord = { status: 'pending', lastUsed: Date.now() };
  tileRecords.set(key, record);
  const promise = new Promise<string>((resolve, reject) => {
    tileQueue.push({ key, url, resolve, reject });
  });
  record.promise = promise;
  runTileQueue();
  return promise;
}

function cancelStaleRequests(activeKeys: Set<string>): void {
  for (const [key, record] of tileRecords) {
    if (record.status !== 'pending' || activeKeys.has(key)) continue;
    record.controller?.abort();
    tileRecords.delete(key);
  }
  for (let i = tileQueue.length - 1; i >= 0; i -= 1) {
    if (activeKeys.has(tileQueue[i]!.key)) continue;
    const request = tileQueue.splice(i, 1)[0]!;
    const record = tileRecords.get(request.key);
    if (record?.status === 'pending') tileRecords.delete(request.key);
    request.reject(new Error('Tile request was cancelled'));
  }
}

function pruneTileCache(activeKeys: Set<string>): void {
  const loaded = [...tileRecords.entries()].filter(([key, record]) => record.status === 'loaded' && !activeKeys.has(key));
  loaded.sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
  for (const [key, record] of loaded.slice(0, Math.max(0, loaded.length - MAX_CACHED_TILES))) {
    if (record.src) URL.revokeObjectURL(record.src);
    tileRecords.delete(key);
  }
}

function placementKey(region: string, placement: TilePlacement): string {
  return `${region}:${tileKey(placement.zoom, placement.tileX, placement.tileY)}`;
}

function intersects(a: TilePlacement, b: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return a.x < b.x2 && a.x + a.width > b.x1 && a.y < b.y2 && a.y + a.height > b.y1;
}

export interface LoadedMapTile extends TilePlacement {
  key: string;
  src: string;
  placeholder: boolean;
}

export interface MapTileState {
  supported: boolean;
  loading: boolean;
  failed: boolean;
  tiles: LoadedMapTile[];
}

export function useMapTiles(meta: MapRegionMeta | null, viewport: TileViewport): MapTileState {
  const [revision, setRevision] = useState(0);
  const loadedPlacements = useRef(new Map<string, TilePlacement>());
  const supported = isTileMapSupported(meta);
  const selected = supported ? selectTileLevel(meta.zoomLevels, viewport, meta.worldToPixel) : null;
  const coverage = selected && meta?.worldToPixel ? calculateViewportTileCoverage(selected, viewport, meta.worldToPixel) : null;
  const fallbackLevel = selected && meta ? meta.zoomLevels.filter((level) => isValidZoomLevel(level) && level.zoom > selected.zoom).sort((a, b) => a.zoom - b.zoom)[0] : null;
  const fallbackCoverage = fallbackLevel && meta?.worldToPixel ? calculateViewportTileCoverage(fallbackLevel, viewport, meta.worldToPixel) : null;
  const desired = useMemo(() => {
    const placements = new Map<string, TilePlacement>();
    for (const placement of [...(fallbackCoverage?.tiles ?? []), ...(coverage?.tiles ?? [])]) {
      placements.set(placementKey(meta?.region ?? '', placement), placement);
    }
    return placements;
  }, [coverage, fallbackCoverage]);
  const desiredKey = [...desired.keys()].sort().join('|');

  useEffect(() => {
    if (!supported || !meta || !meta.worldToPixel || !selected) {
      cancelStaleRequests(new Set());
      return;
    }

    const activeKeys = new Set(desired.keys());
    cancelStaleRequests(activeKeys);
    for (const [key, placement] of desired) {
      const record = tileRecords.get(key);
      if (record?.status === 'loaded') {
        record.lastUsed = Date.now();
        loadedPlacements.current.set(key, placement);
        continue;
      }
      if (record?.status === 'failed') continue;
      void requestTile(key, tileUrl(meta.region, placement.zoom, placement.tileX, placement.tileY))
        .then(() => {
          loadedPlacements.current.set(key, placement);
          setRevision((value) => value + 1);
        })
        .catch(() => setRevision((value) => value + 1));
    }
    pruneTileCache(activeKeys);
  }, [desiredKey, meta, selected, supported]);

  useEffect(() => () => cancelStaleRequests(new Set()), []);

  const visibleBounds = coverage?.bounds;
  const currentTiles = useMemo(() => {
    if (!visibleBounds || !selected) return [];
    const next: LoadedMapTile[] = [];
    for (const [key, placement] of loadedPlacements.current) {
      const record = tileRecords.get(key);
      if (!record?.src || !intersects(placement, visibleBounds)) continue;
      next.push({ ...placement, key, src: record.src, placeholder: placement.zoom !== selected.zoom });
    }
    next.sort((a, b) => Number(a.placeholder) - Number(b.placeholder));
    return next;
  }, [desiredKey, revision, selected?.zoom]);

  if (!supported || !meta || !meta.worldToPixel || !selected || !coverage) {
    return { supported: false, loading: false, failed: false, tiles: [] };
  }
  const selectedFailed = coverage.tiles.length === 0 || coverage.tiles.some((placement) => tileRecords.get(placementKey(meta.region, placement))?.status === 'failed');
  const selectedLoading = coverage.tiles.some((placement) => {
    const status = tileRecords.get(placementKey(meta.region, placement))?.status;
    return status === 'pending' || status === undefined;
  });

  void revision;
  return { supported: true, loading: selectedLoading, failed: selectedFailed, tiles: currentTiles };
}

export const MapTileLayer = memo(function MapTileLayer({ tiles }: { tiles: LoadedMapTile[] }) {
  return (
    <>
      {tiles.map((tile) => (
        <image
          key={tile.key}
          href={tile.src}
          x={tile.x}
          y={tile.y}
          width={tile.width}
          height={tile.height}
          preserveAspectRatio="none"
        />
      ))}
    </>
  );
});
