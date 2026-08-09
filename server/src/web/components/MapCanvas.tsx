import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Car, Navigation } from 'lucide-react';
import { Icon } from './Icon';
import { HudIconButton } from './HudIconButton';
import {
  BASE_MAP_COLOR,
  DRAW_ORDER,
  FEATURE_COLOR,
  queryRoute,
  queryVectorMap,
  type FeatureCategory,
  type RoutePoint,
  type VectorMapData,
} from '../lib/vectorMap';
import { DEFAULT_MAP_REGION } from '../lib/mapTiles';
import { useGameSubscription } from '../lib/gameSocket';
import { useMapFocus } from '../lib/mapFocus';
import { useModalContext } from './ModalContext';
import { annotationColor } from '../lib/annotations';
import type { MapPin } from '../mock/gameState';

const PIN_COLOR: Record<MapPin['kind'], string> = {
  player: 'var(--color-accent)',
  zombie: 'var(--color-text-secondary)',
  poi: 'var(--color-danger)',
};

const ROUTE_COLOR = '#000000';
const CLICK_MOVE_THRESHOLD_PX = 6;

type WorldPoint = { x: number; y: number };

const DEFAULT_ZOOM_SQUARES = 320;
const MIN_ZOOM_SQUARES = 40;
const MAX_ZOOM_SQUARES = 2200;

const SMOOTHING_TIME_CONSTANT_MS = 120;
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

function useSmoothedPoint(target: WorldPoint | null): WorldPoint | null {
  const [point, setPoint] = useState<WorldPoint | null>(target);
  const pointRef = useRef<WorldPoint | null>(target);
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
      const t = 1 - Math.exp(-elapsed / SMOOTHING_TIME_CONSTANT_MS);
      const eased = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };

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
  const position = useGameSubscription('map:position', (msg) =>
    msg.category === 'map' ? msg.data : undefined,
  );
  const annotations = useGameSubscription('map:annotations', (msg) =>
    msg.category === 'annotations' ? msg.data.markers : undefined,
  );
  const vehicles = useGameSubscription('map:vehicles', (msg) =>
    msg.category === 'vehicles' ? msg.data.vehicles : undefined,
  );

  const [data, setData] = useState<VectorMapData | null>(null);
  const [zoomSquares, setZoomSquares] = useState(DEFAULT_ZOOM_SQUARES);
  const [manualCenter, setManualCenter] = useState<WorldPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isWide = useMediaQuery('(min-width: 900px)');
  const { isModalOpen } = useModalContext();
  const showMapButtons = isWide || !isModalOpen;
  const [destination, setDestination] = useState<WorldPoint | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null);
  const [routeIsDirect, setRouteIsDirect] = useState(false);

  const liveCenter = position ? { x: position.x, y: position.y } : null;
  const smoothedCenter = useSmoothedPoint(liveCenter);
  const smoothedDir = useSmoothedPoint(
    position?.dirX !== undefined && position.dirY !== undefined
      ? { x: position.dirX * 100, y: position.dirY * 100 }
      : null,
  );
  const headingDeg = smoothedDir
    ? (Math.atan2(smoothedDir.x, -smoothedDir.y) * 180) / Math.PI - 45
    : 0;
  const center = manualCenter ?? smoothedCenter;
  const fetchCenter = manualCenter ?? liveCenter;

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
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

  function screenToWorld(clientX: number, clientY: number, rect: DOMRect): WorldPoint | null {
    const current = centerRef.current;
    if (!current) return null;
    const span = Math.max(rect.width, rect.height);
    const upp = zoomRef.current / span;
    return {
      x: current.x + (clientX - rect.left - rect.width / 2) * upp,
      y: current.y + (clientY - rect.top - rect.height / 2) * upp,
    };
  }

  useMapFocus((target) => {
    setManualCenter({ x: target.x, y: target.y });
    if (target.zoomSquares !== undefined) {
      setZoomSquares(clamp(target.zoomSquares, MIN_ZOOM_SQUARES, MAX_ZOOM_SQUARES));
    }
  });

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
    const gesture = gestureRef.current;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      if (gesture?.mode === 'pan') {
        const movedPx = Math.hypot(e.clientX - gesture.startClientX, e.clientY - gesture.startClientY);
        if (movedPx < CLICK_MOVE_THRESHOLD_PX) {
          const world = screenToWorld(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
          if (world) setDestination(world);
        }
      }
      gestureRef.current = null;
      setIsDragging(false);
    } else if (pointersRef.current.size === 1 && centerRef.current) {
      const p = pointersRef.current.values().next().value as WorldPoint;
      gestureRef.current = { mode: 'pan', startClientX: p.x, startClientY: p.y, startCenter: centerRef.current };
    }
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (Date.now() - recenterClickedAtRef.current < 500) return;
    zoomAt(e.clientX, e.clientY, 0.5, e.currentTarget.getBoundingClientRect());
  }

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

  useEffect(() => {
    if (!destination || !liveCenter) {
      setRoutePoints(null);
      setRouteIsDirect(false);
      return;
    }
    let cancelled = false;
    queryRoute(region, liveCenter, destination).then((result) => {
      if (cancelled) return;
      if (result) {
        setRoutePoints(result.points);
        setRouteIsDirect(false);
      } else {
        setRoutePoints([liveCenter, destination]);
        setRouteIsDirect(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [region, destination?.x, destination?.y, liveCenter?.x, liveCenter?.y]);

  const labelSize = zoomSquares / 34;
  const placeLabelSize = zoomSquares / 16;

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
        {vehicles?.map((vehicle) => (
          <Car
            key={`vehicle-${vehicle.id}`}
            x={vehicle.x - zoomSquares / 70}
            y={vehicle.y - zoomSquares / 70}
            width={zoomSquares / 35}
            height={zoomSquares / 35}
            color={vehicle.current ? PIN_COLOR.player : 'var(--color-warning)'}
            strokeWidth={2.5}
          >
            <title>{vehicle.name}</title>
          </Car>
        ))}


        {routePoints && routePoints.length > 1 && (
          <polyline
            points={polygonPoints(routePoints.map((p) => [p.x, p.y]))}
            fill="none"
            stroke={ROUTE_COLOR}
            strokeWidth={zoomSquares / 260}
            strokeDasharray={routeIsDirect ? `${zoomSquares / 90} ${zoomSquares / 130}` : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {destination && (
          <circle
            cx={destination.x}
            cy={destination.y}
            r={zoomSquares / 100}
            fill={ROUTE_COLOR}
            stroke="white"
            strokeWidth={zoomSquares / 900}
          />
        )}

        {smoothedCenter && (
          <g
            transform={`translate(${smoothedCenter.x} ${smoothedCenter.y}) rotate(${headingDeg}) scale(${zoomSquares / 500})`}
          >
            <Navigation
              width={24}
              height={24}
              x={-12}
              y={-12}
              fill={PIN_COLOR.player}
              color="white"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>

      {showMapButtons && manualCenter && (
        <div
          style={{ position: 'absolute', right: 20, bottom: 'calc(var(--hud-hotbar-inset) + 68px)' }}
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

      {showMapButtons && destination && (
        <div
          style={{
            position: 'absolute',
            right: 20,
            bottom: `calc(var(--hud-hotbar-inset) + ${manualCenter ? 124 : 68}px)`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <HudIconButton icon="close" label="Clear route" onClick={() => setDestination(null)} />
        </div>
      )}
    </div>
  );
}
