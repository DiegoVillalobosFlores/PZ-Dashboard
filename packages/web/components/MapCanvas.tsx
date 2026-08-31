import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Icon } from './Icon';
import { HudIconButton } from './HudIconButton';
import {
  BASE_MAP_COLOR,
  queryRoute,
  queryVectorMap,
  type RoutePoint,
  type VectorMapData,
} from '../lib/vectorMap';
import {
  BROAD_VIEW_ZOOM_SQUARES,
  DEFAULT_MAP_REGION,
  queryMapMeta,
  type MapRegionMeta,
} from '../lib/mapTiles';
import { useGameSubscription } from '../lib/gameSocket';
import { useMapFocus } from '../lib/mapFocus';
import { polylineLength, setNavTarget } from '../lib/navTarget';
import { useModalContext } from './ModalContext';
import { useAutoZoomOnSpeed, useFogOfWar } from '../lib/settings';
import { useAssetRevision } from '../lib/assetUrl';
import type { MapPin } from '../mock/gameState';
import type { VehicleSnapshot } from '../lib/liveTypes';
import { MapOverlayLayer, VectorGeometryLayer, VectorLabelsLayer } from './MapLayers';
import { MapTileLayer, useMapTiles } from './MapTileLayer';
import {
  interpolateMotion,
  motionSpeed,
  pushFix,
  type MotionPoint,
  type MotionTrack,
} from '../lib/mapMotion';
import { panCenter, screenToWorld as cameraScreenToWorld, zoomAroundAnchor } from '../lib/mapCamera';

const PIN_COLOR: Record<MapPin['kind'], string> = {
  player: 'var(--color-accent)',
  zombie: 'var(--color-text-secondary)',
  poi: 'var(--color-danger)',
};

// The mod forgets every vehicle when the game restarts, so the browser keeps
// the one that matters - the car you last drove - to find it again next session.
const VEHICLE_STORE_KEY = 'pz-dashboard.vehicle';

function loadStoredVehicle(): VehicleSnapshot | null {
  try {
    const raw = JSON.parse(localStorage.getItem(VEHICLE_STORE_KEY) ?? 'null');
    return raw ? { ...raw, current: false } : null;
  } catch {
    return null;
  }
}
const CLICK_MOVE_THRESHOLD_PX = 6;

type WorldPoint = { x: number; y: number };

const DEFAULT_ZOOM_SQUARES = 320;
const MIN_ZOOM_SQUARES = 12;
const MAX_ZOOM_SQUARES = 12000;

const FAST_TRAVEL_SQUARES_PER_SECOND = 8;
const SLOW_TRAVEL_SQUARES_PER_SECOND = 4;
const SPEED_SMOOTHING = 0.12;
const ZOOM_ANIMATION_MS = 700;
const TRAVEL_ZOOM_SQUARES = 720;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pointerDistance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a: WorldPoint, b: WorldPoint): WorldPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function useFixMotion(target: WorldPoint | null): { point: WorldPoint | null; speed: number } {
  const [point, setPoint] = useState<WorldPoint | null>(target);
  const [speed, setSpeed] = useState(0);
  const trackRef = useRef<MotionTrack | null>(null);
  const pointRef = useRef<MotionPoint | null>(target);
  const speedRef = useRef(0);
  const frameRef = useRef(0);

  const targetX = target?.x;
  const targetY = target?.y;

  useEffect(() => {
    if (targetX === undefined || targetY === undefined) return;
    trackRef.current = pushFix(trackRef.current, { x: targetX, y: targetY }, performance.now());
    if (frameRef.current) return;

    const step = (nowMs: number) => {
      const track = trackRef.current;
      if (!track) {
        frameRef.current = 0;
        return;
      }

      const { point: next, settled } = interpolateMotion(track, nowMs);
      const nextSpeed = speedRef.current + (motionSpeed(track, nowMs) - speedRef.current) * SPEED_SMOOTHING;

      if (!pointRef.current || pointRef.current.x !== next.x || pointRef.current.y !== next.y) {
        pointRef.current = next;
        setPoint(next);
      }
      if (speedRef.current !== nextSpeed) {
        speedRef.current = nextSpeed;
        setSpeed(nextSpeed);
      }

      if (settled && nextSpeed < 0.05) {
        frameRef.current = 0;
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
  }, [targetX, targetY]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  return { point: target ? point : null, speed };
}

function useSmoothedPoint(target: WorldPoint | null): WorldPoint | null {
  return useFixMotion(target).point;
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
  const liveVehicles = useGameSubscription('map:vehicles', (msg) =>
    msg.category === 'vehicles' ? msg.data.vehicles : undefined,
  );
  const [vehicle, setVehicle] = useState<VehicleSnapshot | null>(loadStoredVehicle);

  useEffect(() => {
    if (!liveVehicles) return;
    setVehicle((prev) => {
      // Whichever car is being driven becomes the pin; otherwise keep the last
      // one, refreshed from the mod in case it has moved since.
      const next = liveVehicles.find((v) => v.current) ?? liveVehicles.find((v) => v.id === prev?.id) ?? prev;
      if (!next) return prev;
      const serialized = JSON.stringify(next);
      if (serialized === JSON.stringify(prev)) return prev;
      localStorage.setItem(VEHICLE_STORE_KEY, serialized);
      return next;
    });
  }, [liveVehicles]);

  const [data, setData] = useState<VectorMapData | null>(null);
  const [mapMeta, setMapMeta] = useState<MapRegionMeta | null>(null);
  const [mapMetaStatus, setMapMetaStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [zoomSquares, setZoomSquares] = useState(DEFAULT_ZOOM_SQUARES);
  const [manualCenter, setManualCenter] = useState<WorldPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isWide = useMediaQuery('(min-width: 900px)');
  const { isModalOpen } = useModalContext();
  const [fogOfWar] = useFogOfWar();
  const assetRevision = useAssetRevision();
  const showMapButtons = isWide || !isModalOpen;
  const [destination, setDestination] = useState<WorldPoint | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[] | null>(null);
  const [routeIsDirect, setRouteIsDirect] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [vectorLoading, setVectorLoading] = useState(false);

  const liveCenter = position ? { x: position.x, y: position.y } : null;
  const motion = useFixMotion(liveCenter);
  const smoothedCenter = motion.point;
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
  const wantsRaster = zoomSquares >= BROAD_VIEW_ZOOM_SQUARES - 1;

  const [autoZoomOnSpeed] = useAutoZoomOnSpeed();
  const [isTravellingFast, setIsTravellingFast] = useState(false);

  useEffect(() => {
    setIsTravellingFast((wasFast) =>
      motion.speed >= (wasFast ? SLOW_TRAVEL_SQUARES_PER_SECOND : FAST_TRAVEL_SQUARES_PER_SECOND),
    );
  }, [motion.speed]);

  useEffect(() => {
    if (autoZoomOnSpeed && isTravellingFast) {
      if (autoZoomActiveRef.current || autoZoomSuppressedRef.current) return;
      autoZoomActiveRef.current = true;
      preAutoZoomRef.current = zoomRef.current;
      animateZoomTo(Math.max(zoomRef.current, TRAVEL_ZOOM_SQUARES));
      return;
    }

    if (!autoZoomActiveRef.current) {
      autoZoomSuppressedRef.current = false;
      return;
    }

    autoZoomActiveRef.current = false;
    autoZoomSuppressedRef.current = false;
    const restore = preAutoZoomRef.current;
    preAutoZoomRef.current = null;
    if (restore !== null) animateZoomTo(restore);
  }, [autoZoomOnSpeed, isTravellingFast]);

  useEffect(() => () => stopZoomAnimation(), []);

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const centerRef = useRef(center);
  centerRef.current = center;
  const manualCenterRef = useRef(manualCenter);
  manualCenterRef.current = manualCenter;
  const zoomRef = useRef(zoomSquares);
  zoomRef.current = zoomSquares;
  const preAutoZoomRef = useRef<number | null>(null);
  const autoZoomActiveRef = useRef(false);
  const autoZoomSuppressedRef = useRef(false);
  const zoomAnimRef = useRef(0);
  const fetchedBoundsRef = useRef<{ region: string; x1: number; y1: number; x2: number; y2: number } | null>(null);

  const tileState = useMapTiles(mapMeta, {
    center: center ?? { x: 0, y: 0 },
    zoomSquares,
    width: viewportSize.width,
    height: viewportSize.height,
  });
  const useRaster = wantsRaster && tileState.supported && !tileState.failed;

  const pointersRef = useRef(new Map<number, WorldPoint>());
  const recenterClickedAtRef = useRef(0);
  const gestureRef = useRef<
    | { mode: 'pan'; startClientX: number; startClientY: number; startCenter: WorldPoint }
    | { mode: 'pinch'; startDistance: number; startMid: WorldPoint; startZoom: number; startCenter: WorldPoint }
    | null
  >(null);

  useEffect(() => {
    if (!containerEl) return;
    const update = () => {
      const rect = containerEl.getBoundingClientRect();
      setViewportSize((current) => (current.width === rect.width && current.height === rect.height ? current : { width: rect.width, height: rect.height }));
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [containerEl]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchedBoundsRef.current = null;
    setMapMeta(null);
    setMapMetaStatus('loading');
    queryMapMeta(region)
      .then((result) => {
        if (cancelled) return;
        setMapMeta(result);
        setMapMetaStatus(result ? 'ready' : 'failed');
      })
      .catch(() => {
        if (cancelled) return;
        setMapMeta(null);
        setMapMetaStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [region, assetRevision]);

  function stopZoomAnimation() {
    if (!zoomAnimRef.current) return;
    cancelAnimationFrame(zoomAnimRef.current);
    zoomAnimRef.current = 0;
  }

  function animateZoomTo(target: number) {
    stopZoomAnimation();
    const from = zoomRef.current;
    const to = clamp(target, MIN_ZOOM_SQUARES, MAX_ZOOM_SQUARES);
    if (Math.abs(Math.log(to / from)) < 0.02) {
      setZoomSquares(to);
      return;
    }
    const startedAt = performance.now();
    const step = (nowMs: number) => {
      const t = Math.min(1, (nowMs - startedAt) / ZOOM_ANIMATION_MS);
      const eased = t * t * (3 - 2 * t);
      setZoomSquares(t >= 1 ? to : from * Math.pow(to / from, eased));
      if (t >= 1) {
        zoomAnimRef.current = 0;
        return;
      }
      zoomAnimRef.current = requestAnimationFrame(step);
    };
    zoomAnimRef.current = requestAnimationFrame(step);
  }

  function suppressAutoZoom() {
    stopZoomAnimation();
    if (!autoZoomActiveRef.current) return;
    autoZoomActiveRef.current = false;
    preAutoZoomRef.current = null;
    autoZoomSuppressedRef.current = true;
  }

  function zoomAt(clientX: number, clientY: number, factor: number, rect: DOMRect) {
    const current = centerRef.current;
    if (!current) return;
    suppressAutoZoom();
    const next = zoomAroundAnchor(current, zoomRef.current, factor, clientX, clientY, rect, MIN_ZOOM_SQUARES, MAX_ZOOM_SQUARES);
    setZoomSquares(next.zoomSquares);
    const offsetX = clientX - rect.left - rect.width / 2;
    const offsetY = clientY - rect.top - rect.height / 2;
    if (manualCenterRef.current || Math.abs(offsetX) > 1 || Math.abs(offsetY) > 1) setManualCenter(next.center);
  }

  useMapFocus((target) => {
    suppressAutoZoom();
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
      suppressAutoZoom();
      setManualCenter(panCenter(gesture.startCenter, gesture.startClientX, gesture.startClientY, e.clientX, e.clientY, zoomRef.current, rect));
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

      suppressAutoZoom();
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
          const world = centerRef.current && cameraScreenToWorld(centerRef.current, zoomRef.current, e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
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

  useEffect(() => {
    const tileViewportReady = viewportSize.width > 0 && viewportSize.height > 0;
    const needVector = !useRaster && (!wantsRaster || (tileViewportReady && (mapMetaStatus === 'failed' || (mapMetaStatus === 'ready' && !tileState.supported) || tileState.failed)));
    if (!needVector || !fetchCenter) {
      setVectorLoading(false);
      return;
    }
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
    setVectorLoading(true);
    const timer = setTimeout(() => {
      queryVectorMap(region, next.x1, next.y1, next.x2, next.y2).then((result) => {
        if (cancelled) return;
        if (result) {
          setData(result);
          fetchedBoundsRef.current = next;
        }
      }).catch(() => undefined).finally(() => {
        if (!cancelled) setVectorLoading(false);
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setVectorLoading(false);
    };
  }, [region, fetchCenter?.x, fetchCenter?.y, zoomSquares, assetRevision, mapMetaStatus, tileState.failed, tileState.supported, useRaster, wantsRaster, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    if (!destination || !liveCenter) {
      setRoutePoints(null);
      setRouteIsDirect(false);
      setNavTarget(null);
      return;
    }
    let cancelled = false;
    queryRoute(region, liveCenter, destination).then((result) => {
      if (cancelled) return;
      if (result) {
        setRoutePoints(result.points);
        setRouteIsDirect(false);
        setNavTarget({ remainingSquares: result.distanceSquares, isDirect: false });
      } else {
        const direct = [liveCenter, destination];
        setRoutePoints(direct);
        setRouteIsDirect(true);
        setNavTarget({ remainingSquares: polylineLength(direct), isDirect: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [region, destination?.x, destination?.y, liveCenter?.x, liveCenter?.y]);

  if (!center || (!data && !useRaster)) return <PlaceholderGrid pins={pins ?? []} />;

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
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      data-map-root="true"
      data-map-zoom-squares={zoomSquares}
      data-map-base={useRaster ? 'raster' : 'vector'}
      data-map-loading={String(useRaster ? tileState.loading : vectorLoading || !data)}
      data-map-tile-count={useRaster ? tileState.tiles.length : 0}
      data-map-feature-count={data?.features.length ?? 0}
      data-map-label-count={data ? data.streets.length + data.places.length : 0}
      data-map-fallback={String(wantsRaster && !useRaster)}
      data-map-fog={String(fogOfWar)}
      data-map-annotation-count={annotations?.length ?? 0}
      data-map-vehicle={String(Boolean(vehicle && !position?.inVehicle))}
      data-map-route={String(Boolean(routePoints && routePoints.length > 1))}
      data-map-destination={String(Boolean(destination))}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${center.x - half} ${center.y - half} ${zoomSquares} ${zoomSquares}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {useRaster ? (
          <MapTileLayer tiles={tileState.tiles} />
        ) : data ? (
          <>
            <VectorGeometryLayer data={data} />
            <VectorLabelsLayer data={data} labelSize={zoomSquares / 34} placeLabelSize={zoomSquares / 16} />
          </>
        ) : null}

        <MapOverlayLayer
          center={center}
          zoomSquares={zoomSquares}
          fogOfWar={fogOfWar}
          annotations={annotations}
          vehicle={vehicle}
          position={position}
          smoothedCenter={smoothedCenter}
          headingDeg={headingDeg}
          routePoints={routePoints}
          routeIsDirect={routeIsDirect}
          destination={destination}
        />
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
