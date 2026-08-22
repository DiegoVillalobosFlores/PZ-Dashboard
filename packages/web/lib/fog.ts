import type { FogSnapshot } from './liveTypes';

export type FogRect = { x: number; y: number; w: number; h: number };

// One rect per run of adjacent known units in a cell row, so a fully explored
// cell costs 8 rects instead of 64.
export function knownRects(
  fog: FogSnapshot,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): FogRect[] {
  const { unitSquares, cellSquares } = fog;
  const unitsPerCell = cellSquares / unitSquares;
  const rects: FogRect[] = [];

  for (const [key, hex] of Object.entries(fog.cells)) {
    const [cellX, cellY] = key.split(',').map(Number);
    if (cellX === undefined || cellY === undefined) continue;
    const originX = cellX * cellSquares;
    const originY = cellY * cellSquares;
    if (originX > x2 || originY > y2 || originX + cellSquares < x1 || originY + cellSquares < y1) continue;

    for (let row = 0; row < unitsPerCell; row++) {
      const bits = parseInt(hex.slice(row * 2, row * 2 + 2), 16);
      if (!bits) continue;
      let runStart = -1;
      for (let unit = 0; unit <= unitsPerCell; unit++) {
        const set = unit < unitsPerCell && (bits & (1 << unit)) !== 0;
        if (set && runStart < 0) runStart = unit;
        if (!set && runStart >= 0) {
          rects.push({
            x: originX + runStart * unitSquares,
            y: originY + row * unitSquares,
            w: (unit - runStart) * unitSquares,
            h: unitSquares,
          });
          runStart = -1;
        }
      }
    }
  }
  return rects;
}
