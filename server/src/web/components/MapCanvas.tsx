import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { HudIconButton } from './HudIconButton';
import {
  BASE_MAP_COLOR,
  DRAW_ORDER,
  FEATURE_COLOR,
  queryVectorMap,
  type FeatureCategory,
  type VectorMapData,
} from '../lib/vectorMap';
import { DEFAULT_MAP_REGION } from '../lib/mapTiles';
import { useGameSubscription } from '../lib/gameSocket';
import { useMapFocus } from '../lib/mapFocus';
import { annotationColor } from '../lib/annotations';
import type { MapPin } from '../mock/gameState';

const PIN_COLOR: Record<MapPin['kind'], string> = {
  player: 'var(--color-accent)',
  zombie: 'var(--color-text-secondary)',
  poi: 'var(--color-danger)',
};

type WorldPoint = { x: number; y: number };

// World squares spanning the (square) viewBox - how much of the map is
// visible at once. Roughly matches the in-game map's default zoom, close
// enough to read street names and see individual buildings. Interactive
// zoom (wheel/pinch) moves this between the two bounds below.
const DEFAULT_ZOOM_SQUARES = 320;
const MIN_ZOOM_SQUARES = 40;
const MAX_ZOOM_SQUARES = 2200;

// The mod samples the player's position on a fixed interval (0.5s for the
// "map" category), so raw snapshots make the marker teleport between fixes
// rather than move. These control the easing that fills the gaps - see
// useSmoothedPoint below.
const SMOOTHING_TIME_CONSTANT_MS = 180;
// Past this, the player didn't walk there: fast travel, a respawn, or simply
// the first fix after a reconnect. Jump straight to it instead of gliding the
// marker across the county.
const SNAP_DISTANCE_SQUARES = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function polygonPoints(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

function midpoint(points: [number, number][]): [number, number] {
  const mid = points[Math.floor(points.length / 2)];
  return mid ?? [0, 0];
}

function pointerDistance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a: WorldPoint, b: WorldPoint): WorldPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Eases a point toward each new sample on requestAnimationFrame so discrete
// position fixes render as continuous movement, the same way a GPS map keeps
// the arrow gliding between updates. Exponential (rather than fixed-duration)
// easing means a fix arriving early, late, or not at all just changes how far
// the point has converged - there's no timeline to fall out of sync with.
function useSmoothedPoint(target: WorldPoint | null): WorldPoint | null {
  const [point, setPoint] = useState<WorldPoint | null>(target);
  const pointRef = useRef<WorldPoint | null>(target);
  // Read inside the animation loop so a fix landing mid-flight retargets the
  // in-progress glide instead of being ignored until the loop restarts.
  const targetRef = useRef<WorldPoint | null>(target);
  targetRef.current = target;

  const targetX = target?.x;
  const targetY = target?.y;

  useEffect(() => {
    if (targetX === undefined || targetY === undefined) return;
    const next = { x: targetX, y: targetY };

    if (!pointRef.current || pointerDistance(pointRef.current, next) > SNAP_DISTANCE_SQUARES) {
      pointRef.current = next;
      setPoint(next);
      return;
    }

    let frame = 0;
    let previousMs = performance.now();
    const step = (nowMs: number) => {
      const elapsed = nowMs - previousMs;
      previousMs = nowMs;
      const from = pointRef.current!;
      const to = targetRef.current!;
      // Frame-rate independent: the fraction of the remaining gap closed
      // scales with elapsed time, so a 30Hz display eases at the same speed
      // as a 144Hz one.
      const t = 1 - Math.exp(-elapsed / SMOOTHING_TIME_CONSTANT_MS);
      const eased = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };

      // Sub-tenth-of-a-square is well under a pixel at every zoom level -
      // settle exactly on the target and stop burning frames until the next
      // fix arrives.
      if (pointerDistance(eased, to) < 0.1) {
        pointRef.current = to;
        setPoint(to);
        return;
      }
      pointRef.current = eased;
      setPoint(eased);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [targetX, targetY]);

  return target ? point : null;
}

function PlaceholderGrid({ pins }: { pins: MapPin[] }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-bg-map)',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {pins.map((pin) => (
        <div
          key={pin.id}
          style={{
            position: 'absolute',
            left: `${pin.xPct}%`,
            top: `${pin.yPct}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <Icon name="map-pin" size={pin.kind === 'player' ? 32 : 26} color={PIN_COLOR[pin.kind]} />
        </div>
      ))}
    </div>
  );
}

export function MapCanvas({
  region = DEFAULT_MAP_REGION,
  pins,
}: {
  region?: string;
  pins?: MapPin[];
}) {
  // Position and annotations are read straight off the shared socket rather
  // than passed down, so this component keeps its pan/zoom and easing state
  // for the life of the app instead of resetting whenever a screen changes.
  const position = useGameSubscription('map:position', (msg) =>
    msg.category === 'map' ? msg.data : undefined,
  );
  const annotations = useGameSubscription('map:annotations', (msg) =>
    msg.category === 'annotations' ? msg.data.markers : undefined,
  );

  const [data, setData] = useState<VectorMapData | null>(null);
  const [zoomSquares, setZoomSquares] = useState(DEFAULT_ZOOM_SQUARES);
  // Non-null once the player has panned/zoomed away from live tracking -
  // Google Maps style "you've moved the map" mode. Cleared by the recenter
  // button, which resumes following the live player position.
  const [manualCenter, setManualCenter] = useState<WorldPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const liveCenter = position ? { x: position.x, y: position.y } : null;
  // The drawn position glides between fixes; the marker and (while
  // following) the viewport both ride it.
  const smoothedCenter = useSmoothedPoint(liveCenter);
  const center = manualCenter ?? smoothedCenter;
  // Vector-tile fetching deliberately keys off the *raw* position instead.
  // Its effect is debounced by 150ms, and the smoothed center changes every
  // animation frame while the player walks - which would reset that debounce
  // before it could ever fire, so the map would stop loading new geometry
  // exactly when it's needed most. The raw position changes twice a second.
  const fetchCenter = manualCenter ?? liveCenter;

  // A state (not a plain ref) specifically so the wheel-binding effect
  // below re-runs once this actually mounts - the container is behind the
  // `!center || !data` early return, so on first paint (before live state
  // arrives) there is no DOM node yet for a plain ref to have captured.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  // Mirrors the latest center/zoom into refs so the native wheel listener
  // (bound once) and pointer handlers always read current values without
  // needing to rebind on every state change.
  const centerRef = useRef(center);
  centerRef.current = center;
  const zoomRef = useRef(zoomSquares);
  zoomRef.current = zoomSquares;

  const pointersRef = useRef(new Map<number, WorldPoint>());
  const recenterClickedAtRef = useRef(0);
  const gestureRef = useRef<
    | { mode: 'pan'; startClientX: number; startClientY: number; startCenter: WorldPoint }
    | { mode: 'pinch'; startDistance: number; startMid: WorldPoint; startZoom: number; startCenter: WorldPoint }
    | null
  >(null);

  // Applies a zoom step anchored at a screen point (cursor or pinch
  // midpoint) so that world point stays fixed on screen while the view
  // scales around it - the same feel as Google Maps' scroll-to-zoom.
  function zoomAt(clientX: number, clientY: number, factor: number, rect: DOMRect) {
    const current = centerRef.current;
    if (!current) return;
    const span = Math.max(rect.width, rect.height);
    const upp = zoomRef.current / span;
    const anchorWorldX = current.x + (clientX - rect.left - rect.width / 2) * upp;
    const anchorWorldY = current.y + (clientY - rect.top - rect.height / 2) * upp;

    const nextZoom = clamp(zoomRef.current * factor, MIN_ZOOM_SQUARES, MAX_ZOOM_SQUARES);
    const uppNext = nextZoom / span;
    const nextCenterX = anchorWorldX - (clientX - rect.left - rect.width / 2) * uppNext;
    const nextCenterY = anchorWorldY - (clientY - rect.top - rect.height / 2) * uppNext;

    setZoomSquares(nextZoom);
    setManualCenter({ x: nextCenterX, y: nextCenterY });
  }

  useMapFocus((target) => {
    setManualCenter({ x: target.x, y: target.y });
    if (target.zoomSquares !== undefined) {
      setZoomSquares(clamp(target.zoomSquares, MIN_ZOOM_SQUARES, MAX_ZOOM_SQUARES));
    }
  });

  // Bound once as a native (non-passive) listener - React's synthetic
  // onWheel can end up attached passively, which silently drops
  // preventDefault and lets the page itself scroll while zooming the map.
  useEffect(() => {
    if (!containerEl) return;
    const handler = (e: WheelEvent) => {
      if (!centerRef.current) return;
      e.preventDefault();
      const rect = containerEl.getBoundingClientRect();
      zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015), rect);
    };
    containerEl.addEventListener('wheel', handler, { passive: false });
    return () => containerEl.removeEventListener('wheel', handler);
  }, [containerEl]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!centerRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Keeps pointermove targeted at this element while dragging off its
      // bounds (e.g. over a HUD overlay) - if the browser rejects capture
      // for this id, panning still works for movement that stays over the
      // map itself, so this is safe to no-op rather than break the drag.
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsDragging(true);

    if (pointersRef.current.size === 1) {
      gestureRef.current = {
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCenter: centerRef.current,
      };
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      gestureRef.current = {
        mode: 'pinch',
        startDistance: Math.max(pointerDistance(a!, b!), 1),
        startMid: pointerMidpoint(a!, b!),
        startZoom: zoomRef.current,
        startCenter: centerRef.current,
      };
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const span = Math.max(rect.width, rect.height);

    if (gesture.mode === 'pan' && pointersRef.current.size === 1) {
      const upp = zoomRef.current / span;
      const dx = (e.clientX - gesture.startClientX) * upp;
      const dy = (e.clientY - gesture.startClientY) * upp;
      setManualCenter({ x: gesture.startCenter.x - dx, y: gesture.startCenter.y - dy });
    } else if (gesture.mode === 'pinch' && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.max(pointerDistance(a!, b!), 1);
      const mid = pointerMidpoint(a!, b!);
      const nextZoom = clamp((gesture.startZoom * gesture.startDistance) / distance, MIN_ZOOM_SQUARES, MAX_ZOOM_SQUARES);

      // Keep the world point under the pinch's starting midpoint fixed,
      // then layer on however far the midpoint itself has since moved
      // (so a pinch can pan and zoom in the same gesture).
      const uppStart = gesture.startZoom / span;
      const anchorWorldX = gesture.startCenter.x + (gesture.startMid.x - rect.left - rect.width / 2) * uppStart;
      const anchorWorldY = gesture.startCenter.y + (gesture.startMid.y - rect.top - rect.height / 2) * uppStart;

      const uppNext = nextZoom / span;
      const nextCenterX = anchorWorldX - (mid.x - rect.left - rect.width / 2) * uppNext;
      const nextCenterY = anchorWorldY - (mid.y - rect.top - rect.height / 2) * uppNext;

      setZoomSquares(nextZoom);
      setManualCenter({ x: nextCenterX, y: nextCenterY });
    }
  }

  function endPointer(e: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      setIsDragging(false);
    } else if (pointersRef.current.size === 1 && centerRef.current) {
      // Downgraded from a pinch to one remaining finger - restart the pan
      // from its current position so the view doesn't jump.
      const p = pointersRef.current.values().next().value as WorldPoint;
      gestureRef.current = { mode: 'pan', startClientX: p.x, startClientY: p.y, startCenter: centerRef.current };
    }
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    // The recenter button unmounts the instant it's clicked (its
    // `manualCenter &&` condition goes false), so a quick second click -
    // e.g. someone clicking it again because the first click's effect
    // wasn't obvious - lands on the bare map at the same spot underneath.
    // The browser still pairs that with the first click as a native
    // dblclick *on the map*, since double-click detection is purely
    // time/position based and doesn't care that the first click actually
    // hit a different (now-gone) element. Ignore double-clicks that land
    // right after a recenter click so that stray pairing can't zoom.
    if (Date.now() - recenterClickedAtRef.current < 500) return;
    zoomAt(e.clientX, e.clientY, 0.5, e.currentTarget.getBoundingClientRect());
  }

  // Fetches a generous margin around the current view and reuses it while
  // panning/zooming stays inside that cached window, only re-querying the
  // server once the visible viewport would spill outside what's cached -
  // the same "load once, pan freely" model tiled map apps use.
  const fetchedBoundsRef = useRef<{ region: string; x1: number; y1: number; x2: number; y2: number } | null>(null);

  useEffect(() => {
    if (!fetchCenter) return;
    const half = zoomSquares / 2;
    const bounds = fetchedBoundsRef.current;
    const covered =
      bounds &&
      bounds.region === region &&
      fetchCenter.x - half >= bounds.x1 &&
      fetchCenter.x + half <= bounds.x2 &&
      fetchCenter.y - half >= bounds.y1 &&
      fetchCenter.y + half <= bounds.y2;
    if (covered) return;

    const padding = zoomSquares * 0.75;
    const next = {
      region,
      x1: fetchCenter.x - half - padding,
      y1: fetchCenter.y - half - padding,
      x2: fetchCenter.x + half + padding,
      y2: fetchCenter.y + half + padding,
    };
    let cancelled = false;
    // Debounced so a drag or pinch in progress (many rapid center/zoom
    // changes) doesn't fire a request per frame.
    const timer = setTimeout(() => {
      queryVectorMap(region, next.x1, next.y1, next.x2, next.y2).then((result) => {
        if (cancelled) return;
        setData(result);
        fetchedBoundsRef.current = next;
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [region, fetchCenter?.x, fetchCenter?.y, zoomSquares]);

  const labelSize = zoomSquares / 34;
  const placeLabelSize = zoomSquares / 16;

  // The terrain is thousands of polygons and depends only on the fetched
  // data and the zoom level - neither of which changes while the player
  // walks. Memoizing it keeps the per-frame work of following a moving
  // player down to a viewBox string and one <circle>, instead of rebuilding
  // (and re-filtering, once per draw layer) the whole basemap 60 times a
  // second.
  const basemap = useMemo(() => {
    if (!data) return null;

    const byCategory = new Map<FeatureCategory, string[]>();
    for (const feature of data.features) {
      const points = byCategory.get(feature.category);
      if (points) points.push(polygonPoints(feature.points));
      else byCategory.set(feature.category, [polygonPoints(feature.points)]);
    }

    return (
      <>
        {DRAW_ORDER.map((category) => (
          <g key={category} fill={FEATURE_COLOR[category]}>
            {(byCategory.get(category) ?? []).map((points, i) => (
              <polygon key={i} points={points} />
            ))}
          </g>
        ))}

        {data.streets.map((street, i) => {
          const [x, y] = midpoint(street.points);
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontSize={labelSize}
              fill="rgba(0,0,0,0.65)"
              stroke={BASE_MAP_COLOR}
              strokeWidth={labelSize / 6}
              paintOrder="stroke"
              textAnchor="middle"
              fontStyle="italic"
            >
              {street.name}
            </text>
          );
        })}

        {data.places.map((place, i) => (
          <text
            key={i}
            x={place.x}
            y={place.y}
            fontSize={placeLabelSize}
            fill="rgba(0,0,0,0.85)"
            stroke={BASE_MAP_COLOR}
            strokeWidth={placeLabelSize / 5}
            paintOrder="stroke"
            textAnchor="middle"
            fontWeight="bold"
          >
            {place.name}
          </text>
        ))}
      </>
    );
  }, [data, labelSize, placeLabelSize]);

  // No live position and no manual pan yet (server hasn't sent a "map"
  // snapshot) - keep the HUD from looking broken while connecting, same
  // fallback pattern used for vitals/hotbar in HomeScreen.
  if (!center || !data) return <PlaceholderGrid pins={pins ?? []} />;

  const half = zoomSquares / 2;

  return (
    <div
      ref={setContainerEl}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: BASE_MAP_COLOR,
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${center.x - half} ${center.y - half} ${zoomSquares} ${zoomSquares}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {basemap}

        {annotations
          ?.filter((a) => !a.isText)
          .map((a, i) => (
            <circle
              key={`marker-${i}`}
              cx={a.x}
              cy={a.y}
              r={zoomSquares / 90}
              fill={annotationColor(a)}
              stroke="white"
              strokeWidth={zoomSquares / 900}
            >
              <title>{a.symbolId}</title>
            </circle>
          ))}

        {annotations
          ?.filter((a) => a.isText)
          .map((a, i) => (
            <text
              key={`note-${i}`}
              x={a.x}
              y={a.y}
              transform={a.rotation ? `rotate(${a.rotation} ${a.x} ${a.y})` : undefined}
              fontSize={placeLabelSize * 0.8}
              fill={annotationColor(a)}
              stroke={BASE_MAP_COLOR}
              strokeWidth={labelSize / 5}
              paintOrder="stroke"
              textAnchor="middle"
              fontWeight="bold"
            >
              {a.text}
            </text>
          ))}

        {smoothedCenter && (
          <circle
            cx={smoothedCenter.x}
            cy={smoothedCenter.y}
            r={zoomSquares / 55}
            fill={PIN_COLOR.player}
            stroke="white"
            strokeWidth={zoomSquares / 500}
          />
        )}
      </svg>

      {manualCenter && (
        // Stops every pointer/click event type here from bubbling into the
        // map container's own pan/zoom handlers - without this, a real
        // click's pointerdown/up (which still bubble even though React's
        // onClick fires afterward) register as a zero-movement pan, and
        // since this button unmounts the instant it's clicked, a quick
        // second click lands on the bare map underneath and reads as a
        // double-click there - triggering double-click-to-zoom instead of
        // (or in addition to) recentering.
        <div
          style={{ position: 'absolute', right: 20, bottom: 186 }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <HudIconButton
            icon="crosshair"
            label="Recenter on player"
            onClick={() => {
              recenterClickedAtRef.current = Date.now();
              setManualCenter(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
