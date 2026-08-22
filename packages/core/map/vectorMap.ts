import type { GameFiles } from "../index";
import { join } from "node:path";

// Renders the SAME data source the game's own "M" map screen uses
// (worldmap.xml cell features + streets.xml road labels), styled with the
// exact vanilla color palette from ISMapDefinitions.lua - not the artistic
// "Knox Country" paper map (spawnSelectImagePyramid.zip), which is a
// different, decorative asset only used for the spawn-point screen.
//
// worldmap.xml stores polygons/lines/points per 300x300-world-square
// "cell", in coordinates LOCAL to that cell (0-300) - absolute world-square
// coordinates are cellX*300+localX, cellY*300+localY. streets.xml stores
// named road centerlines in absolute coordinates already, used here only
// for street-name labels (the actual road surfaces are polygons in
// worldmap.xml).
//
// forest (worldmap-forest.xml, ~65MB) is deliberately NOT parsed - PZ
// itself renders forest from a pre-rasterized "forest.pyramid.zip" instead
// of live vector data for performance, and we skip forest fill entirely
// for now rather than pay that parse cost. Buildings/roads/water/labels
// cover the vast majority of what's visually on the in-game map.

const CELL_SIZE = 300;

export type FeatureCategory =
  | "water"
  | "railway"
  | "road-primary"
  | "road-secondary"
  | "road-tertiary"
  | "road-trail"
  | "building"
  | "building-Residential"
  | "building-CommunityServices"
  | "building-Hospitality"
  | "building-Industrial"
  | "building-Medical"
  | "building-RestaurantsAndEntertainment"
  | "building-RetailAndCommercial";

export interface PolygonFeature {
  category: FeatureCategory;
  points: [number, number][]; // absolute world-square coordinates
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

function categoryFromProperties(props: Record<string, string>): FeatureCategory | null {
  if (props.water === "river") return "water";
  if (props.railway) return "railway";
  if (props.highway === "primary") return "road-primary";
  if (props.highway === "secondary") return "road-secondary";
  if (props.highway === "tertiary") return "road-tertiary";
  if (props.highway === "trail") return "road-trail";
  if (props.building === "yes") return "building";
  if (props.building) {
    const known: FeatureCategory[] = [
      "building-Residential",
      "building-CommunityServices",
      "building-Hospitality",
      "building-Industrial",
      "building-Medical",
      "building-RestaurantsAndEntertainment",
      "building-RetailAndCommercial",
    ];
    const candidate = `building-${props.building}` as FeatureCategory;
    if (known.includes(candidate)) return candidate;
  }
  return null;
}

function parseWorldMap(xml: string): { features: PolygonFeature[]; places: PlaceLabel[] } {
  const features: PolygonFeature[] = [];
  const places: PlaceLabel[] = [];

  const cellPattern = /<cell x="(-?\d+)" y="(-?\d+)">([\s\S]*?)<\/cell>/g;
  const featurePattern = /<feature>([\s\S]*?)<\/feature>/g;
  const geometryPattern = /<geometry type="(\w+)">([\s\S]*?)<\/geometry>/;
  const pointPattern = /<point x="(-?[\d.]+)" y="(-?[\d.]+)"\/>/g;
  const propertyPattern = /<property name="([^"]*)" value="([^"]*)"\/>/g;

  let cellMatch: RegExpExecArray | null;
  while ((cellMatch = cellPattern.exec(xml))) {
    const cellX = Number(cellMatch[1]);
    const cellY = Number(cellMatch[2]);
    const body = cellMatch[3] ?? "";

    featurePattern.lastIndex = 0;
    let featureMatch: RegExpExecArray | null;
    while ((featureMatch = featurePattern.exec(body))) {
      const featureBody = featureMatch[1] ?? "";
      const geomMatch = geometryPattern.exec(featureBody);
      if (!geomMatch) continue;
      const geomType = geomMatch[1];
      const coordsBody = geomMatch[2] ?? "";

      const points: [number, number][] = [];
      pointPattern.lastIndex = 0;
      let pointMatch: RegExpExecArray | null;
      while ((pointMatch = pointPattern.exec(coordsBody))) {
        points.push([cellX * CELL_SIZE + Number(pointMatch[1]), cellY * CELL_SIZE + Number(pointMatch[2])]);
      }
      if (points.length === 0) continue;

      const props: Record<string, string> = {};
      propertyPattern.lastIndex = 0;
      let propMatch: RegExpExecArray | null;
      while ((propMatch = propertyPattern.exec(featureBody))) {
        props[propMatch[1] as string] = propMatch[2] as string;
      }

      if (geomType === "Polygon") {
        const category = categoryFromProperties(props);
        if (category) features.push({ category, points });
      } else if (geomType === "Point" && props.place === "town") {
        const [x, y] = points[0] as [number, number];
        places.push({ name: props.name_en ?? "", x, y });
      }
      // LineString geometries (a handful, unlabeled in practice) are skipped.
    }
  }

  return { features, places };
}

function parseStreets(xml: string): StreetLabel[] {
  const streets: StreetLabel[] = [];

  const streetPattern = /<street name="([^"]*)" width="[^"]*">([\s\S]*?)<\/street>/g;
  const pointPattern = /<point x="(-?[\d.]+)" y="(-?[\d.]+)"\/>/g;

  let match: RegExpExecArray | null;
  while ((match = streetPattern.exec(xml))) {
    const name = match[1] ?? "";
    const body = match[2] ?? "";
    const points: [number, number][] = [];
    pointPattern.lastIndex = 0;
    let pointMatch: RegExpExecArray | null;
    while ((pointMatch = pointPattern.exec(body))) {
      points.push([Number(pointMatch[1]), Number(pointMatch[2])]);
    }
    if (name && points.length > 0) streets.push({ name, points });
  }

  return streets;
}

const cache = new Map<string, VectorMapData>();

export async function getVectorMap(files: GameFiles, region: string, installDir: string): Promise<VectorMapData> {
  const cached = cache.get(region);
  if (cached) return cached;

  if (!installDir) {
    throw new Error("PZ_INSTALL_DIR is not set - see .env.example");
  }
  const dir = join(installDir, "media", "maps", region);
  const worldMapPath = join(dir, "worldmap.xml");
  const streetsPath = join(dir, "streets.xml");
  if (!(await files.stat(worldMapPath))) {
    throw new Error(`No worldmap.xml for region "${region}"`);
  }

  const { features, places } = parseWorldMap(new TextDecoder().decode(await files.read(worldMapPath)));
  const streets = (await files.stat(streetsPath)) ? parseStreets(new TextDecoder().decode(await files.read(streetsPath))) : [];
  const data: VectorMapData = { features, places, streets };
  cache.set(region, data);
  return data;
}

function polygonBoundsOverlap(points: [number, number][], x1: number, y1: number, x2: number, y2: number): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return minX <= x2 && maxX >= x1 && minY <= y2 && maxY >= y1;
}

// Filters the parsed data to what's relevant for a viewport, so the
// response stays small - the full parsed dataset is ~14k features.
export async function queryVectorMap(
  files: GameFiles,
  installDir: string,
  region: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Promise<VectorMapData> {
  const data = await getVectorMap(files, region, installDir);
  return {
    features: data.features.filter((f) => polygonBoundsOverlap(f.points, x1, y1, x2, y2)),
    places: data.places.filter((p) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2),
    streets: data.streets.filter((s) => polygonBoundsOverlap(s.points, x1, y1, x2, y2)),
  };
}
