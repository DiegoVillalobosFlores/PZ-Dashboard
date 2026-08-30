export interface MotionPoint {
  x: number;
  y: number;
}

export interface MotionFix {
  point: MotionPoint;
  at: number;
}

export interface MotionTrack {
  previous: MotionFix | null;
  latest: MotionFix;
  intervalMs: number;
}

export interface InterpolatedMotion {
  point: MotionPoint;
  settled: boolean;
}

export const SNAP_DISTANCE_SQUARES = 40;
export const DEFAULT_FIX_INTERVAL_MS = 250;
export const MIN_FIX_INTERVAL_MS = 40;
export const MAX_FIX_INTERVAL_MS = 2000;

const INTERVAL_SMOOTHING = 0.3;
const STALE_GRACE_MS = 250;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function spanOf(a: MotionPoint, b: MotionPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function smoothIntervalMs(current: number | undefined, gapMs: number): number {
  const sample = clamp(gapMs, MIN_FIX_INTERVAL_MS, MAX_FIX_INTERVAL_MS);
  if (current === undefined) return sample;
  return clamp(current + (sample - current) * INTERVAL_SMOOTHING, MIN_FIX_INTERVAL_MS, MAX_FIX_INTERVAL_MS);
}

export function pushFix(track: MotionTrack | null, point: MotionPoint, at: number): MotionTrack {
  const previous = track ? track.latest : null;
  const gapMs = previous ? at - previous.at : undefined;
  const intervalMs =
    gapMs === undefined
      ? (track?.intervalMs ?? DEFAULT_FIX_INTERVAL_MS)
      : smoothIntervalMs(track?.intervalMs, gapMs);
  return { previous, latest: { point, at }, intervalMs };
}

export function interpolateMotion(track: MotionTrack, nowMs: number): InterpolatedMotion {
  const { previous, latest } = track;
  if (!previous) return { point: latest.point, settled: true };
  if (spanOf(previous.point, latest.point) > SNAP_DISTANCE_SQUARES) return { point: latest.point, settled: true };

  const spanMs = latest.at - previous.at;
  if (spanMs <= 0) return { point: latest.point, settled: true };

  const lagMs = clamp(Math.min(track.intervalMs, spanMs), MIN_FIX_INTERVAL_MS, MAX_FIX_INTERVAL_MS);
  const t = (nowMs - lagMs - previous.at) / spanMs;
  if (t <= 0) return { point: previous.point, settled: false };
  if (t >= 1) return { point: latest.point, settled: true };

  return {
    point: {
      x: previous.point.x + (latest.point.x - previous.point.x) * t,
      y: previous.point.y + (latest.point.y - previous.point.y) * t,
    },
    settled: false,
  };
}

export function motionSpeed(track: MotionTrack, nowMs: number): number {
  const { previous, latest } = track;
  if (!previous) return 0;

  const distance = spanOf(previous.point, latest.point);
  if (distance > SNAP_DISTANCE_SQUARES) return 0;

  const spanMs = latest.at - previous.at;
  if (spanMs <= 0) return 0;
  if (nowMs - latest.at > Math.max(spanMs, track.intervalMs) * 2 + STALE_GRACE_MS) return 0;

  return distance / (spanMs / 1000);
}
