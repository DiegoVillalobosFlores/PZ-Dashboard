import { useSyncExternalStore } from 'react';

export interface NavTarget {
  remainingSquares: number;
  isDirect: boolean;
}

export function polylineLength(points: { x: number; y: number }[]): number {
  let total = 0;
  let previous = points[0];
  for (const point of points.slice(1)) {
    if (previous) total += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return total;
}

let current: NavTarget | null = null;
const listeners = new Set<() => void>();

export function setNavTarget(next: NavTarget | null) {
  if (current === next) return;
  if (current && next && current.remainingSquares === next.remainingSquares && current.isDirect === next.isDirect) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNavTarget(): NavTarget | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
