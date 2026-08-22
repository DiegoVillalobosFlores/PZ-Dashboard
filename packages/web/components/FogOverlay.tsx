import { useMemo } from 'react';
import { useGameSubscription } from '../lib/gameSocket';
import { knownRects } from '../lib/fog';

const FOG_COLOR = '#6b747c';

// Hides everything the player hasn't put on their in-game map yet: a dark
// sheet over the viewport, punched through by the units the mod reports as
// known. Renders nothing until the mod sends a fog snapshot, so a dashboard
// talking to an older mod isn't left staring at a black rectangle.
export function FogOverlay({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const fog = useGameSubscription('map:fog', (msg) => (msg.category === 'fog' ? msg.data : undefined));

  // Snapped out to whole cells so panning inside a cell reuses the last
  // result instead of rebuilding the rects on every eased frame.
  const cell = fog?.cellSquares ?? 256;
  const bx1 = Math.floor(x1 / cell) * cell;
  const by1 = Math.floor(y1 / cell) * cell;
  const bx2 = Math.ceil(x2 / cell) * cell;
  const by2 = Math.ceil(y2 / cell) * cell;

  const rects = useMemo(
    () => (fog ? knownRects(fog, bx1, by1, bx2, by2) : []),
    [fog, bx1, by1, bx2, by2],
  );

  if (!fog) return null;

  const blur = fog.unitSquares * 0.6;

  return (
    <>
      {/* Blurring the punched-out holes turns the 32-square grid into a soft
          edge that fades into the fog instead of a staircase of squares. The
          blur eats about one sigma off each hole, so the rects are grown by
          that much first. */}
      <filter id="pz-fog-edge" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={blur} />
      </filter>
      <mask id="pz-fog" maskUnits="userSpaceOnUse" x={x1} y={y1} width={x2 - x1} height={y2 - y1}>
        <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="white" />
        <g filter="url(#pz-fog-edge)">
          {rects.map((r, i) => (
            <rect
              key={i}
              x={r.x - blur}
              y={r.y - blur}
              width={r.w + blur * 2}
              height={r.h + blur * 2}
              fill="black"
            />
          ))}
        </g>
      </mask>
      <rect
        x={x1}
        y={y1}
        width={x2 - x1}
        height={y2 - y1}
        fill={FOG_COLOR}
        mask="url(#pz-fog)"
      />
    </>
  );
}
