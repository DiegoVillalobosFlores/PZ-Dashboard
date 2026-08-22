import { apiBase } from './api';

// Mirrors server/src/map/vectorMap.ts's FeatureCategory - the polygon
// categories parsed out of the vanilla worldmap.xml (same source the
// in-game "M" map screen renders from).
export type FeatureCategory =
  | 'water'
  | 'railway'
  | 'road-primary'
  | 'road-secondary'
  | 'road-tertiary'
  | 'road-trail'
  | 'building'
  | 'building-Residential'
  | 'building-CommunityServices'
  | 'building-Hospitality'
  | 'building-Industrial'
  | 'building-Medical'
  | 'building-RestaurantsAndEntertainment'
  | 'building-RetailAndCommercial';

export interface PolygonFeature {
  category: FeatureCategory;
  points: [number, number][];
}

export interface PlaceLabel {
  name: string;
  x: number;
  y: number;
}

export interface StreetLabel {
  name: string;
  points: [number, number][];
}

export interface VectorMapData {
  features: PolygonFeature[];
  places: PlaceLabel[];
  streets: StreetLabel[];
}

// Exact vanilla palette, straight from ISMapDefinitions.lua's
// initDefaultStyleV1 fill colors (0-255 RGB, alpha channel dropped since we
// render fully opaque here rather than fading in by zoom like the game does).
export const BASE_MAP_COLOR = 'rgb(219, 215, 192)';
export const FEATURE_COLOR: Record<FeatureCategory, string> = {
  water: 'rgb(59, 141, 149)',
  railway: 'rgb(200, 191, 231)',
  'road-primary': 'rgb(134, 125, 113)',
  'road-secondary': 'rgb(134, 125, 113)',
  'road-tertiary': 'rgb(171, 158, 143)',
  'road-trail': 'rgb(185, 122, 87)',
  building: 'rgb(210, 158, 105)',
  'building-Residential': 'rgb(210, 158, 105)',
  'building-CommunityServices': 'rgb(139, 117, 235)',
  'building-Hospitality': 'rgb(127, 206, 225)',
  'building-Industrial': 'rgb(56, 54, 53)',
  'building-Medical': 'rgb(229, 128, 151)',
  'building-RestaurantsAndEntertainment': 'rgb(245, 225, 60)',
  'building-RetailAndCommercial': 'rgb(184, 205, 84)',
};

// Drawn bottom to top: base ground, water, roads (widest/least important
// first), railway, buildings, then labels on top of everything.
export const DRAW_ORDER: FeatureCategory[] = [
  'water',
  'road-trail',
  'road-tertiary',
  'road-secondary',
  'road-primary',
  'railway',
  'building',
  'building-Residential',
  'building-CommunityServices',
  'building-Hospitality',
  'building-Industrial',
  'building-Medical',
  'building-RestaurantsAndEntertainment',
  'building-RetailAndCommercial',
];

export async function queryVectorMap(
  region: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Promise<VectorMapData | null> {
  const url = `${apiBase()}/api/map/${encodeURIComponent(region)}/features?x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as VectorMapData;
}

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RouteResult {
  points: RoutePoint[];
  distanceSquares: number;
}

// Null return covers both a network/server error and a genuine "no road
// path exists" - the graph is streets-only, so a destination on an island
// of dead-end trails can be unreachable even though it's a valid click.
export async function queryRoute(region: string, from: RoutePoint, to: RoutePoint): Promise<RouteResult | null> {
  const url = `${apiBase()}/api/map/${encodeURIComponent(region)}/route?fromX=${from.x}&fromY=${from.y}&toX=${to.x}&toY=${to.y}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as RouteResult | null;
}
