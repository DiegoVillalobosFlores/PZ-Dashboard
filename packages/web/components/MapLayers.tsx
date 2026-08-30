import { memo, useMemo } from 'react';
import { Car, Navigation } from 'lucide-react';
import {
  BASE_MAP_COLOR,
  DRAW_ORDER,
  FEATURE_COLOR,
  type FeatureCategory,
  type RoutePoint,
  type VectorMapData,
} from '../lib/vectorMap';
import { annotationColor } from '../lib/annotations';
import { FogOverlay } from './FogOverlay';
import type { AnnotationMarkerSnapshot, MapSnapshot, VehicleSnapshot } from '../lib/liveTypes';

type WorldPoint = { x: number; y: number };

function polygonPoints(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

function polygonPath(points: [number, number][]): string {
  return `M ${polygonPoints(points)} Z`;
}

function midpoint(points: [number, number][]): [number, number] {
  const mid = points[Math.floor(points.length / 2)];
  return mid ?? [0, 0];
}

export const VectorGeometryLayer = memo(function VectorGeometryLayer({ data }: { data: VectorMapData }) {
  const byCategory = useMemo(() => {
    const grouped = new Map<FeatureCategory, string>();
    for (const feature of data.features) {
      const path = polygonPath(feature.points);
      const current = grouped.get(feature.category);
      grouped.set(feature.category, current ? `${current} ${path}` : path);
    }
    return grouped;
  }, [data]);

  return (
    <>
      {DRAW_ORDER.map((category) => (
        <g key={category} fill={FEATURE_COLOR[category]}>
          {byCategory.has(category) && <path d={byCategory.get(category)} />}
        </g>
      ))}
    </>
  );
});

export const VectorLabelsLayer = memo(function VectorLabelsLayer({
  data,
  labelSize,
  placeLabelSize,
}: {
  data: VectorMapData;
  labelSize: number;
  placeLabelSize: number;
}) {
  return (
    <>
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
});

export const MapOverlayLayer = memo(function MapOverlayLayer({
  center,
  zoomSquares,
  fogOfWar,
  annotations,
  vehicle,
  position,
  smoothedCenter,
  headingDeg,
  routePoints,
  routeIsDirect,
  destination,
}: {
  center: WorldPoint;
  zoomSquares: number;
  fogOfWar: boolean;
  annotations?: AnnotationMarkerSnapshot[];
  vehicle: VehicleSnapshot | null;
  position?: MapSnapshot;
  smoothedCenter: WorldPoint | null;
  headingDeg: number;
  routePoints: RoutePoint[] | null;
  routeIsDirect: boolean;
  destination: WorldPoint | null;
}) {
  const labelSize = zoomSquares / 34;
  const placeLabelSize = zoomSquares / 16;

  return (
    <>
      {fogOfWar && (
        <FogOverlay
          x1={center.x - zoomSquares}
          y1={center.y - zoomSquares}
          x2={center.x + zoomSquares}
          y2={center.y + zoomSquares}
        />
      )}

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

      {vehicle && !position?.inVehicle && (
        <g transform={`translate(${vehicle.x} ${vehicle.y}) scale(${zoomSquares / 500})`}>
          <title>{vehicle.name}</title>
          <Car
            width={24}
            height={24}
            x={-12}
            y={-12}
            fill="var(--color-warning)"
            color="white"
            strokeWidth={1.5}
          />
        </g>
      )}

      {routePoints && routePoints.length > 1 && (
        <polyline
          points={polygonPoints(routePoints.map((p) => [p.x, p.y]))}
          fill="none"
          stroke="#000000"
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
          fill="#000000"
          stroke="white"
          strokeWidth={zoomSquares / 900}
        />
      )}

      {smoothedCenter && vehicle && !position?.inVehicle && (
        <g
          transform={`translate(${smoothedCenter.x} ${smoothedCenter.y}) scale(${zoomSquares / 500}) rotate(${(Math.atan2(vehicle.x - smoothedCenter.x, smoothedCenter.y - vehicle.y) * 180) / Math.PI}) translate(0 -20) rotate(-45)`}
        >
          <title>{vehicle.name}</title>
          <Navigation
            width={14}
            height={14}
            x={-7}
            y={-7}
            fill="var(--color-warning)"
            color="white"
            strokeWidth={1.5}
          />
        </g>
      )}

      {smoothedCenter && (
        <g transform={`translate(${smoothedCenter.x} ${smoothedCenter.y}) rotate(${headingDeg}) scale(${zoomSquares / 500})`}>
          <Navigation
            width={24}
            height={24}
            x={-12}
            y={-12}
            fill="var(--color-accent)"
            color="white"
            strokeWidth={1.5}
          />
        </g>
      )}
    </>
  );
});
