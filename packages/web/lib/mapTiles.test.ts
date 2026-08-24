import { expect, test } from 'bun:test';
import {
  calculateViewportTileCoverage,
  isTileMapSupported,
  selectTileLevel,
  tileKey,
  tileWorldRect,
  viewportWorldBounds,
  type MapRegionMeta,
  type TileViewport,
  type WorldToPixelTransform,
  type ZoomLevelMeta,
} from './mapTiles';

const transform: WorldToPixelTransform = { originX: 0, originY: 0, scaleX: 1, scaleY: 1 };
const levels: ZoomLevelMeta[] = [
  { zoom: 0, tileSize: 100, minCol: 0, maxCol: 20, minRow: 0, maxRow: 20 },
  { zoom: 1, tileSize: 100, minCol: 0, maxCol: 10, minRow: 0, maxRow: 10 },
  { zoom: 2, tileSize: 100, minCol: 0, maxCol: 5, minRow: 0, maxRow: 5 },
];

const viewport: TileViewport = { center: { x: 550, y: 550 }, zoomSquares: 4000, width: 1000, height: 800 };

test('selects tile density nearest to viewport density', () => {
  expect(selectTileLevel(levels, viewport, transform)?.zoom).toBe(2);
  expect(selectTileLevel(levels, { ...viewport, zoomSquares: 1000 }, transform)?.zoom).toBe(0);
});

test('calculates viewport bounds using the same square camera span as the map', () => {
  expect(viewportWorldBounds({ center: { x: 100, y: 200 }, zoomSquares: 100, width: 200, height: 100 })).toEqual({
    x1: 50,
    y1: 175,
    x2: 150,
    y2: 225,
  });
});

test('places tiles in world coordinates and clamps coverage to metadata', () => {
  const level = levels[1]!;
  expect(tileWorldRect(level, transform, 2, 3)).toEqual({ zoom: 1, tileX: 2, tileY: 3, x: 400, y: 600, width: 200, height: 200 });
  const coverage = calculateViewportTileCoverage(levels[0]!, { ...viewport, zoomSquares: 200, width: 200, height: 200 }, transform, 0);
  expect(coverage.tiles.map((tile) => tileKey(tile.zoom, tile.tileX, tile.tileY))).toEqual([
    '0/4/4',
    '0/5/4',
    '0/6/4',
    '0/4/5',
    '0/5/5',
    '0/6/5',
    '0/4/6',
    '0/5/6',
    '0/6/6',
  ]);
});

test('scales the transform origin with the zoom level', () => {
  const offset: WorldToPixelTransform = { originX: 122, originY: 123, scaleX: 0.5, scaleY: 0.5 };
  // Inverse of the forward transform the server applies: a level's pixel
  // grid is the zoom-0 grid divided by 2^zoom, origin included.
  for (const level of levels) {
    const divisor = 2 ** level.zoom;
    const rect = tileWorldRect(level, offset, 3, 4);
    expect(rect.x).toBeCloseTo((3 * level.tileSize * divisor - offset.originX) / offset.scaleX, 6);
    expect(rect.y).toBeCloseTo((4 * level.tileSize * divisor - offset.originY) / offset.scaleY, 6);
  }

  const centered = tileWorldRect(levels[2]!, offset, 3, 4);
  const coverage = calculateViewportTileCoverage(
    levels[2]!,
    { center: { x: centered.x + centered.width / 2, y: centered.y + centered.height / 2 }, zoomSquares: 10, width: 100, height: 100 },
    offset,
    0,
  );
  expect(coverage.tiles.map((tile) => tileKey(tile.zoom, tile.tileX, tile.tileY))).toEqual(['2/3/4']);
});

test('reports missing transforms and empty tile extents as unsupported coverage', () => {
  const meta: MapRegionMeta = { region: 'Unknown', zoomLevels: [], worldToPixel: null };
  expect(isTileMapSupported(meta)).toBe(false);
  const coverage = calculateViewportTileCoverage(
    { zoom: 0, tileSize: 256, minCol: 10, maxCol: 10, minRow: 10, maxRow: 10 },
    { center: { x: 0, y: 0 }, zoomSquares: 10, width: 100, height: 100 },
    transform,
    0,
  );
  expect(coverage.tiles).toEqual([]);
});
