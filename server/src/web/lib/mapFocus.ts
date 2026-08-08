import { useEffect, useRef } from 'react';

export interface MapFocusTarget {
  x: number;
  y: number;
  zoomSquares?: number;
}

type FocusListener = (target: MapFocusTarget) => void;

const listeners = new Set<FocusListener>();

export function focusMap(target: MapFocusTarget): void {
  for (const listener of [...listeners]) listener(target);
}

export function useMapFocus(onFocus: FocusListener): void {
  const handlerRef = useRef(onFocus);
  handlerRef.current = onFocus;

  useEffect(() => {
    const listener: FocusListener = (target) => handlerRef.current(target);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
