import { expect, test } from 'bun:test';
import { knownRects } from './fog';
import type { FogSnapshot } from './liveTypes';

const fog: FogSnapshot = {
  unitSquares: 32,
  cellSquares: 256,
  // Row 0: units 0-2 and 7 known. Row 2: every unit known. Rest unknown.
  cells: { '1,1': '87' + '00' + 'ff' + '00'.repeat(5) },
};

test('merges runs of known units and places them in world squares', () => {
  const rects = knownRects(fog, 0, 0, 4096, 4096);
  expect(rects).toEqual([
    { x: 256, y: 256, w: 96, h: 32 },
    { x: 480, y: 256, w: 32, h: 32 },
    { x: 256, y: 320, w: 256, h: 32 },
  ]);
});

test('skips cells outside the viewport', () => {
  expect(knownRects(fog, 2000, 2000, 3000, 3000)).toEqual([]);
});
