import type { AnnotationMarkerSnapshot } from './liveTypes';

export function annotationColor({ r, g, b }: Pick<AnnotationMarkerSnapshot, 'r' | 'g' | 'b'>): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

export function annotationLabel(a: AnnotationMarkerSnapshot): string {
  const text = a.text?.trim();
  if (text) return text;
  const symbolId = a.symbolId?.trim();
  if (symbolId) return symbolId;
  return 'Marker';
}
