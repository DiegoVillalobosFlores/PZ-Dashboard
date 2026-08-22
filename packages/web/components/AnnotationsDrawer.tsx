import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { CornerBrackets } from './CornerBrackets';
import { Icon } from './Icon';
import { useGameSubscription } from '../lib/gameSocket';
import { focusMap } from '../lib/mapFocus';
import { annotationColor, annotationLabel } from '../lib/annotations';
import { DEFAULT_MAP_REGION } from '../lib/mapTiles';
import {
  BASE_MAP_COLOR,
  DRAW_ORDER,
  FEATURE_COLOR,
  queryVectorMap,
  type FeatureCategory,
  type VectorMapData,
} from '../lib/vectorMap';
import type { AnnotationMarkerSnapshot } from '../lib/liveTypes';

const PREVIEW_SQUARES = 170;
const FOCUS_ZOOM_SQUARES = 120;

type BoundedFeature = {
  category: FeatureCategory;
  points: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function boundFeatures(data: VectorMapData | null): BoundedFeature[] {
  if (!data) return [];
  return data.features.map((feature) => {
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    let points = '';
    for (const [x, y] of feature.points) {
      if (x < x1) x1 = x;
      if (x > x2) x2 = x;
      if (y < y1) y1 = y;
      if (y > y2) y2 = y;
      points += `${x},${y} `;
    }
    return { category: feature.category, points, x1, y1, x2, y2 };
  });
}

function useAnnotationTerrain(
  annotations: AnnotationMarkerSnapshot[] | undefined,
  enabled: boolean,
): { features: BoundedFeature[]; loading: boolean } {
  const [data, setData] = useState<VectorMapData | null>(null);

  const bounds = useMemo(() => {
    if (!annotations?.length) return null;
    const half = PREVIEW_SQUARES / 2;
    const xs = annotations.map((a) => a.x);
    const ys = annotations.map((a) => a.y);
    return {
      x1: Math.min(...xs) - half,
      y1: Math.min(...ys) - half,
      x2: Math.max(...xs) + half,
      y2: Math.max(...ys) + half,
    };
  }, [annotations]);

  const x1 = bounds?.x1;
  const y1 = bounds?.y1;
  const x2 = bounds?.x2;
  const y2 = bounds?.y2;

  useEffect(() => {
    if (!enabled || x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return;
    let cancelled = false;
    queryVectorMap(DEFAULT_MAP_REGION, x1, y1, x2, y2).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, x1, y1, x2, y2]);

  const features = useMemo(() => boundFeatures(data), [data]);
  return { features, loading: enabled && Boolean(bounds) && data === null };
}

function AnnotationPreview({
  annotation,
  features,
  size,
}: {
  annotation: AnnotationMarkerSnapshot;
  features: BoundedFeature[];
  size: number;
}) {
  const { x, y } = annotation;
  const half = PREVIEW_SQUARES / 2;

  const byCategory = useMemo(() => {
    const left = x - half;
    const right = x + half;
    const top = y - half;
    const bottom = y + half;
    const grouped = new Map<FeatureCategory, string[]>();
    for (const feature of features) {
      if (feature.x2 < left || feature.x1 > right || feature.y2 < top || feature.y1 > bottom) continue;
      const bucket = grouped.get(feature.category);
      if (bucket) bucket.push(feature.points);
      else grouped.set(feature.category, [feature.points]);
    }
    return grouped;
  }, [features, x, y, half]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${x - half} ${y - half} ${PREVIEW_SQUARES} ${PREVIEW_SQUARES}`}
      style={{
        display: 'block',
        flexShrink: 0,
        background: BASE_MAP_COLOR,
        border: '1px solid rgba(247, 103, 7, 0.35)',
      }}
      aria-hidden
    >
      {DRAW_ORDER.map((category) => (
        <g key={category} fill={FEATURE_COLOR[category]}>
          {(byCategory.get(category) ?? []).map((points, i) => (
            <polygon key={i} points={points} />
          ))}
        </g>
      ))}
      <circle
        cx={x}
        cy={y}
        r={PREVIEW_SQUARES / 20}
        fill={annotationColor(annotation)}
        stroke="white"
        strokeWidth={PREVIEW_SQUARES / 110}
      />
    </svg>
  );
}

function AnnotationRow({
  annotation,
  features,
  previewSize,
  distance,
  onSelect,
}: {
  annotation: AnnotationMarkerSnapshot;
  features: BoundedFeature[];
  previewSize: number;
  distance: number | null;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      title={`Show ${annotationLabel(annotation)} on the map`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        width: '100%',
        textAlign: 'left',
        background: 'var(--color-tile-bg)',
        border: 'none',
        borderRadius: 'var(--radius-sharp)',
        cursor: 'pointer',
      }}
    >
      <AnnotationPreview annotation={annotation} features={features} size={previewSize} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              width: 10,
              height: 10,
              flexShrink: 0,
              boxSizing: 'border-box',
              borderRadius: '50%',
              background: annotationColor(annotation),
              border: '1px solid rgba(255, 255, 255, 0.7)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              fontSize: 13,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {annotationLabel(annotation)}
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {Math.round(annotation.x)}, {Math.round(annotation.y)}
        </span>
        {distance !== null && (
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            {distance < 1000 ? `${Math.round(distance)} m away` : `${(distance / 1000).toFixed(1)} km away`}
          </span>
        )}
      </div>
    </button>
  );
}

export function AnnotationsDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const isWide = useMediaQuery('(min-width: 900px)');
  const previewSize = isWide ? 88 : 72;
  const navigate = useNavigate();

  const annotations = useGameSubscription('annotations:list', (msg) =>
    msg.category === 'annotations' ? msg.data.markers : undefined,
  );
  const position = useGameSubscription('annotations:position', (msg) =>
    msg.category === 'map' ? msg.data : undefined,
  );

  const { features, loading } = useAnnotationTerrain(annotations, opened);

  const sorted = useMemo(() => {
    if (!annotations) return [];
    const withDistance = annotations.map((annotation) => ({
      annotation,
      distance: position ? Math.hypot(annotation.x - position.x, annotation.y - position.y) : null,
    }));
    if (position) withDistance.sort((a, b) => a.distance! - b.distance!);
    return withDistance;
  }, [annotations, position?.x, position?.y]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={isWide ? 480 : 330}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
      transitionProps={{ transition: 'slide-left', duration: 200 }}
      styles={{
        content: {
          background: 'var(--color-glass-panel)',
          backdropFilter: 'var(--frost-blur)',
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.4)',
        },
        body: { padding: 0, height: '100%', position: 'relative' },
      }}
    >
      <CornerBrackets length={22} thickness={2} inset={8} opacity={0.85} />
      <div
        style={{
          padding: isWide ? '18px' : '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 28 }}>
          <span
            className="pz-label"
            style={{
              fontSize: isWide ? 16 : 15,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--color-text-primary)',
            }}
          >
            Map Notes{sorted.length > 0 ? ` (${sorted.length})` : ''}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
            aria-label="Close"
          >
            <Icon name="close" size={20} color="var(--color-text-secondary)" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '12px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              {annotations === undefined
                ? 'Waiting for the game...'
                : 'No map notes yet. Mark somewhere on the in-game map and it will show up here.'}
            </div>
          ) : (
            <>
              {loading && (
                <div style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>Loading previews...</div>
              )}
              {sorted.map(({ annotation, distance }, i) => (
                <AnnotationRow
                  key={`${annotation.x},${annotation.y},${i}`}
                  annotation={annotation}
                  features={features}
                  previewSize={previewSize}
                  distance={distance}
                  onSelect={() => {
                    focusMap({ x: annotation.x, y: annotation.y, zoomSquares: FOCUS_ZOOM_SQUARES });
                    navigate('/');
                    onClose();
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
