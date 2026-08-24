import { expect, test } from 'bun:test';
import { panCenter, screenToWorld, zoomAroundAnchor, type CameraRect } from './mapCamera';

const rect: CameraRect = { left: 40, top: 20, width: 600, height: 400 };

test('keeps a non-center world point under the same screen position while zooming', () => {
  const before = screenToWorld({ x: 1000, y: 800 }, 1000, 180, 160, rect);
  const next = zoomAroundAnchor({ x: 1000, y: 800 }, 1000, 2, 180, 160, rect, 12, 12000);
  expect(screenToWorld(next.center, next.zoomSquares, 180, 160, rect).x).toBeCloseTo(before.x);
  expect(screenToWorld(next.center, next.zoomSquares, 180, 160, rect).y).toBeCloseTo(before.y);
});

test('pans world center by pointer movement at current scale', () => {
  expect(panCenter({ x: 1000, y: 800 }, 100, 100, 160, 130, 600, rect)).toEqual({ x: 940, y: 770 });
});

test('clamps zoom without changing anchor calculation', () => {
  const next = zoomAroundAnchor({ x: 1000, y: 800 }, 1000, 100, 180, 160, rect, 12, 12000);
  expect(next.zoomSquares).toBe(12000);
  const anchor = screenToWorld(next.center, next.zoomSquares, 180, 160, rect);
  const original = screenToWorld({ x: 1000, y: 800 }, 1000, 180, 160, rect);
  expect(anchor.x).toBeCloseTo(original.x);
  expect(anchor.y).toBeCloseTo(original.y);
});
