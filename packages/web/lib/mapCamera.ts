export interface CameraPoint {
  x: number;
  y: number;
}

export interface CameraRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ZoomedCamera {
  center: CameraPoint;
  zoomSquares: number;
}

export function zoomAroundAnchor(
  center: CameraPoint,
  zoomSquares: number,
  factor: number,
  clientX: number,
  clientY: number,
  rect: CameraRect,
  minZoom: number,
  maxZoom: number,
): ZoomedCamera {
  const span = Math.max(rect.width, rect.height);
  const anchorWorld = screenToWorld(center, zoomSquares, clientX, clientY, rect);
  const nextZoom = Math.min(maxZoom, Math.max(minZoom, zoomSquares * factor));
  const nextUpp = nextZoom / span;
  return {
    zoomSquares: nextZoom,
    center: {
      x: anchorWorld.x - (clientX - rect.left - rect.width / 2) * nextUpp,
      y: anchorWorld.y - (clientY - rect.top - rect.height / 2) * nextUpp,
    },
  };
}

export function screenToWorld(center: CameraPoint, zoomSquares: number, clientX: number, clientY: number, rect: CameraRect): CameraPoint {
  const span = Math.max(rect.width, rect.height);
  const upp = zoomSquares / span;
  return {
    x: center.x + (clientX - rect.left - rect.width / 2) * upp,
    y: center.y + (clientY - rect.top - rect.height / 2) * upp,
  };
}

export function panCenter(startCenter: CameraPoint, startClientX: number, startClientY: number, clientX: number, clientY: number, zoomSquares: number, rect: CameraRect): CameraPoint {
  const span = Math.max(rect.width, rect.height);
  const upp = zoomSquares / span;
  return {
    x: startCenter.x - (clientX - startClientX) * upp,
    y: startCenter.y - (clientY - startClientY) * upp,
  };
}
