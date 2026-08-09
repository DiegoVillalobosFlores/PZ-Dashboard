import { getVectorMap, type StreetLabel } from "./vectorMap";

// Turns streets.xml's named road centerlines into a routable graph for
// click-to-navigate. streets.xml segments almost never share an exact
// endpoint with the street they cross - real intersections land mid-polyline
// - so an endpoint-to-endpoint graph leaves most of the county disconnected.
// Instead: weld near-duplicate vertices from different streets into one
// node, then for every street's dangling tip, snap it onto the nearest
// *other* street's segment within tolerance and split that segment there.

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RouteResult {
  points: RoutePoint[];
  distanceSquares: number;
}

interface GraphNode {
  x: number;
  y: number;
  edges: Map<number, number>;
}

interface FlatEdge {
  a: number;
  b: number;
}

interface RouteGraph {
  nodes: GraphNode[];
}

// Coordinates carry at most one decimal place, so two vertices meant to
// coincide land within a fraction of a world unit of each other.
const WELD_TOLERANCE = 1.5;
// How far a street's dangling tip may be from another street's line before
// we give up on it being a real intersection (vs. a genuine dead end).
const JUNCTION_TOLERANCE = 5;
const GRID_CELL_SIZE = 12;

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { x: ax + t * dx, y: ay + t * dy };
}

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / GRID_CELL_SIZE)},${Math.floor(y / GRID_CELL_SIZE)}`;
}

function buildGraph(streets: StreetLabel[]): RouteGraph {
  const nodes: GraphNode[] = [];
  const grid = new Map<string, number[]>();

  function registerInGrid(id: number) {
    const key = cellKey(nodes[id]!.x, nodes[id]!.y);
    const bucket = grid.get(key);
    if (bucket) bucket.push(id);
    else grid.set(key, [id]);
  }

  function findOrCreateNode(x: number, y: number): number {
    const cx = Math.floor(x / GRID_CELL_SIZE);
    const cy = Math.floor(y / GRID_CELL_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const id of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (distance(nodes[id]!.x, nodes[id]!.y, x, y) <= WELD_TOLERANCE) return id;
        }
      }
    }
    const id = nodes.length;
    nodes.push({ x, y, edges: new Map() });
    registerInGrid(id);
    return id;
  }

  function addEdge(a: number, b: number, weight: number) {
    if (a === b) return;
    const na = nodes[a]!;
    const nb = nodes[b]!;
    if ((na.edges.get(b) ?? Infinity) > weight) na.edges.set(b, weight);
    if ((nb.edges.get(a) ?? Infinity) > weight) nb.edges.set(a, weight);
  }

  // Pass 1: lay down each street's own polyline as a chain of nodes/edges.
  const edges: FlatEdge[] = [];
  const endpointIds = new Set<number>();
  for (const street of streets) {
    if (street.points.length === 0) continue;
    let prevId: number | null = null;
    let prevPoint: [number, number] | null = null;
    for (const point of street.points) {
      const id = findOrCreateNode(point[0], point[1]);
      if (prevId !== null && prevPoint) {
        const weight = distance(prevPoint[0], prevPoint[1], point[0], point[1]);
        addEdge(prevId, id, weight);
        edges.push({ a: prevId, b: id });
      }
      prevId = id;
      prevPoint = point;
    }
    endpointIds.add(findOrCreateNode(street.points[0]![0], street.points[0]![1]));
    const last = street.points[street.points.length - 1]!;
    endpointIds.add(findOrCreateNode(last[0], last[1]));
  }

  // Pass 2: snap dangling tips onto the nearest other street's segment.
  for (const nodeId of endpointIds) {
    const node = nodes[nodeId]!;
    if (node.edges.size > 1) continue;

    let best: { edgeIndex: number; point: { x: number; y: number }; dist: number } | null = null;
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i]!;
      if (edge.a === nodeId || edge.b === nodeId) continue;
      const a = nodes[edge.a]!;
      const b = nodes[edge.b]!;
      const proj = closestPointOnSegment(node.x, node.y, a.x, a.y, b.x, b.y);
      const dist = distance(node.x, node.y, proj.x, proj.y);
      if (dist <= JUNCTION_TOLERANCE && (!best || dist < best.dist)) {
        best = { edgeIndex: i, point: proj, dist };
      }
    }
    if (!best) continue;

    const edge = edges[best.edgeIndex]!;
    const a = nodes[edge.a]!;
    const b = nodes[edge.b]!;
    if (distance(best.point.x, best.point.y, a.x, a.y) <= WELD_TOLERANCE) {
      addEdge(nodeId, edge.a, distance(node.x, node.y, a.x, a.y));
    } else if (distance(best.point.x, best.point.y, b.x, b.y) <= WELD_TOLERANCE) {
      addEdge(nodeId, edge.b, distance(node.x, node.y, b.x, b.y));
    } else {
      const splitId = nodes.length;
      nodes.push({ x: best.point.x, y: best.point.y, edges: new Map() });
      registerInGrid(splitId);
      // Rewire through the split point instead of leaving the original
      // edge in place, so the route can't cut straight through a corner.
      a.edges.delete(edge.b);
      b.edges.delete(edge.a);
      addEdge(edge.a, splitId, distance(a.x, a.y, best.point.x, best.point.y));
      addEdge(splitId, edge.b, distance(best.point.x, best.point.y, b.x, b.y));
      addEdge(nodeId, splitId, distance(node.x, node.y, best.point.x, best.point.y));
    }
  }

  return { nodes };
}

function nearestNode(graph: RouteGraph, x: number, y: number): number | null {
  let bestId: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = distance(x, y, graph.nodes[i]!.x, graph.nodes[i]!.y);
    if (d < bestDist) {
      bestDist = d;
      bestId = i;
    }
  }
  return bestId;
}

// Binary-heap Dijkstra - the graph tops out around a few thousand nodes per
// region, so this runs in low single-digit milliseconds per route request.
function shortestPath(graph: RouteGraph, startId: number, endId: number): number[] | null {
  const dist = new Array<number>(graph.nodes.length).fill(Infinity);
  const prev = new Array<number>(graph.nodes.length).fill(-1);
  const visited = new Uint8Array(graph.nodes.length);
  dist[startId] = 0;

  const heap: [number, number][] = [[0, startId]];
  function push(item: [number, number]) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]![0] <= heap[i]![0]) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  }
  function pop(): [number, number] | undefined {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        let smallest = i;
        if (l < heap.length && heap[l]![0] < heap[smallest]![0]) smallest = l;
        if (r < heap.length && heap[r]![0] < heap[smallest]![0]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i]!, heap[smallest]!];
        i = smallest;
      }
    }
    return top;
  }

  while (heap.length > 0) {
    const next = pop()!;
    const [d, id] = next;
    if (visited[id]) continue;
    visited[id] = 1;
    if (id === endId) break;
    if (d > dist[id]!) continue;
    for (const [neighbor, weight] of graph.nodes[id]!.edges) {
      const nextDist = d + weight;
      if (nextDist < dist[neighbor]!) {
        dist[neighbor] = nextDist;
        prev[neighbor] = id;
        push([nextDist, neighbor]);
      }
    }
  }

  if (dist[endId] === Infinity) return null;
  const path: number[] = [];
  let cur = endId;
  while (cur !== -1) {
    path.push(cur);
    cur = prev[cur]!;
  }
  path.reverse();
  return path;
}

const graphCache = new Map<string, RouteGraph>();

function getGraph(region: string): RouteGraph {
  let graph = graphCache.get(region);
  if (!graph) {
    graph = buildGraph(getVectorMap(region).streets);
    graphCache.set(region, graph);
  }
  return graph;
}

export function findRoute(region: string, from: RoutePoint, to: RoutePoint): RouteResult | null {
  const graph = getGraph(region);
  if (graph.nodes.length === 0) return null;

  const startId = nearestNode(graph, from.x, from.y);
  const endId = nearestNode(graph, to.x, to.y);
  if (startId === null || endId === null) return null;

  const path = shortestPath(graph, startId, endId);
  if (!path) return null;

  const points: RoutePoint[] = [from, ...path.map((id) => ({ x: graph.nodes[id]!.x, y: graph.nodes[id]!.y })), to];
  let distanceSquares = 0;
  for (let i = 1; i < points.length; i++) {
    distanceSquares += distance(points[i - 1]!.x, points[i - 1]!.y, points[i]!.x, points[i]!.y);
  }

  return { points, distanceSquares };
}
