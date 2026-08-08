import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameSubscription } from '../lib/gameSocket';

type FigurePart = {
  id: string;
  label: string;
  model: string;
  texture: string | null;
  tint: [number, number, number] | null;
  layer: number;
  offset?: number[];
};

type Figure = { female: boolean; parts: FigurePart[]; updatedAt: number };

type MeshData = {
  name: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  skin: { bone: string; indices: number[]; weights: number[] }[];
};

const meshCache = new Map<string, Promise<MeshData | null>>();

function fetchMesh(url: string): Promise<MeshData | null> {
  const cached = meshCache.get(url);
  if (cached) return cached;
  const request = fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<MeshData>) : null))
    .catch(() => null);
  meshCache.set(url, request);
  return request;
}

function transformMesh(mesh: MeshData, matrix: number[]): MeshData {
  const positions = [...mesh.positions];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const y = positions[i + 1]!;
    const z = positions[i + 2]!;
    positions[i] = x * matrix[0]! + y * matrix[4]! + z * matrix[8]! + matrix[12]!;
    positions[i + 1] = x * matrix[1]! + y * matrix[5]! + z * matrix[9]! + matrix[13]!;
    positions[i + 2] = x * matrix[2]! + y * matrix[6]! + z * matrix[10]! + matrix[14]!;
  }

  const normals = [...mesh.normals];
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i]!;
    const y = normals[i + 1]!;
    const z = normals[i + 2]!;
    const nx = x * matrix[0]! + y * matrix[4]! + z * matrix[8]!;
    const ny = x * matrix[1]! + y * matrix[5]! + z * matrix[9]!;
    const nz = x * matrix[2]! + y * matrix[6]! + z * matrix[10]!;
    const length = Math.hypot(nx, ny, nz) || 1;
    normals[i] = nx / length;
    normals[i + 1] = ny / length;
    normals[i + 2] = nz / length;
  }

  return { ...mesh, positions, normals };
}

function toGeometry(mesh: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const positions = Float32Array.from(mesh.positions);
  for (let i = 2; i < positions.length; i += 3) positions[i] = -positions[i]!;
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  if (mesh.normals.length === mesh.positions.length) {
    const normals = Float32Array.from(mesh.normals);
    for (let i = 2; i < normals.length; i += 3) normals[i] = -normals[i]!;
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  }

  if (mesh.uvs.length) {
    const uvs = Float32Array.from(mesh.uvs);
    for (let i = 1; i < uvs.length; i += 2) uvs[i] = 1 - uvs[i]!;
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  geometry.setIndex(Array.from(mesh.indices));
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  return geometry;
}

const LAYER_BODY = 0;
const LAYER_CLOTHING = 2;

const COVER_MARGIN = 0.02;

function isInsideGarment(
  point: THREE.Vector3,
  garments: THREE.Mesh[],
  raycaster: THREE.Raycaster,
): boolean {
  for (const garment of garments) {
    raycaster.set(point, PARITY_RAY);
    if (raycaster.intersectObject(garment, false).length % 2 === 1) return true;
  }
  return false;
}

const PARITY_RAY = new THREE.Vector3(0.51, 0.63, 0.58).normalize();

function dressPanelVertices(mesh: MeshData): Set<number> {
  const vertices = new Set<number>();
  for (const binding of mesh.skin ?? []) {
    if (!binding.bone.includes('Dress')) continue;
    for (const vertex of binding.indices) vertices.add(vertex);
  }
  return vertices;
}

function clothedBodyIndices(mesh: MeshData, geometry: THREE.BufferGeometry, garments: THREE.Mesh[]): number[] {
  const dress = dressPanelVertices(mesh);
  if (!garments.length && !dress.size) return mesh.indices;

  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const raycaster = new THREE.Raycaster();
  const probe = new THREE.Vector3();
  const covered: boolean[] = [];

  for (let v = 0; garments.length && v < positions.count; v += 1) {
    probe.fromBufferAttribute(positions, v);
    if (normals) {
      probe.x -= normals.getX(v) * COVER_MARGIN;
      probe.y -= normals.getY(v) * COVER_MARGIN;
      probe.z -= normals.getZ(v) * COVER_MARGIN;
    }
    covered[v] = isInsideGarment(probe, garments, raycaster);
  }

  const kept: number[] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i]!;
    const b = mesh.indices[i + 1]!;
    const c = mesh.indices[i + 2]!;
    if (dress.has(a) || dress.has(b) || dress.has(c)) continue;
    if (covered[a] && covered[b] && covered[c]) continue;
    kept.push(a, b, c);
  }
  return kept;
}

function useFigure(): Figure | null {
  const [figure, setFigure] = useState<Figure | null>(null);
  const signatureRef = useRef<string>('');

  const appearance = useGameSubscription('appearance', (msg) =>
    msg.category === 'appearance' ? msg.updatedAt : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/model/figure')
      .then((res) => (res.ok ? (res.json() as Promise<Figure>) : null))
      .then((next) => {
        if (cancelled || !next) return;
        const signature = JSON.stringify(next.parts);
        if (signature === signatureRef.current) return;
        signatureRef.current = signature;
        setFigure(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [appearance]);

  return figure;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const material = object.material as THREE.MeshLambertMaterial;
    material.map?.dispose();
    material.dispose();
  });
}

const CAMERA_FOV = 30;
const ZOOM_DEFAULT = 2.2;
const ZOOM_NEAR = 0.6;
const ZOOM_FAR = 3.2;

const MODEL_HALF_HEIGHT = 0.49;

function halfViewHeight(distance: number): number {
  return distance * Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function CharacterModel({
  size,
  fallback,
}: {
  size: number;
  fallback?: React.ReactNode;
}) {
  const figure = useFigure();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef(0);
  const zoomRef = useRef(ZOOM_DEFAULT);
  const panRef = useRef(0);
  const interactingRef = useRef(false);
  const [ready, setReady] = useState(false);

  const scene = useMemo(() => {
    const created = new THREE.Scene();
    created.add(new THREE.AmbientLight(0xffffff, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(0.6, 1.2, 1.4);
    created.add(key);
    const rim = new THREE.DirectionalLight(0x8fd6ff, 0.6);
    rim.position.set(-1.2, 0.6, -1);
    created.add(rim);
    return created;
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 20);

    const applyCamera = () => {
      const distance = clamp(zoomRef.current, ZOOM_NEAR, ZOOM_FAR);
      zoomRef.current = distance;
      const reach = Math.max(0, MODEL_HALF_HEIGHT - halfViewHeight(distance));
      panRef.current = clamp(panRef.current, -reach, reach);
      camera.position.set(0, panRef.current, distance);
      camera.lookAt(0, panRef.current, 0);
    };
    applyCamera();

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (groupRef.current) {
        groupRef.current.rotation.y = yawRef.current;
      }
      renderer.render(scene, camera);
    };
    tick();

    const pointers = new Map<number, { x: number; y: number }>();
    let gesture: { yaw: number; pan: number; x: number; y: number; spread: number; zoom: number } | null = null;

    const spread = () => {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return 0;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const centroid = () => {
      let x = 0;
      let y = 0;
      for (const point of pointers.values()) {
        x += point.x;
        y += point.y;
      }
      return { x: x / pointers.size, y: y / pointers.size };
    };
    const rebase = () => {
      if (!pointers.size) {
        gesture = null;
        return;
      }
      const middle = centroid();
      gesture = {
        yaw: yawRef.current,
        pan: panRef.current,
        x: middle.x,
        y: middle.y,
        spread: spread(),
        zoom: zoomRef.current,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      renderer.domElement.setPointerCapture(event.pointerId);
      interactingRef.current = true;
      renderer.domElement.style.cursor = 'grabbing';
      rebase();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId) || !gesture) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size >= 2 && gesture.spread > 0) {
        zoomRef.current = gesture.zoom * (gesture.spread / Math.max(spread(), 1));
      } else {
        const middle = centroid();
        yawRef.current = gesture.yaw + (middle.x - gesture.x) * 0.012;
        panRef.current = gesture.pan + ((middle.y - gesture.y) / size) * halfViewHeight(zoomRef.current) * 2;
      }
      applyCamera();
    };

    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      rebase();
      if (!pointers.size) {
        interactingRef.current = false;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomRef.current *= Math.exp(event.deltaY * 0.0015);
      applyCamera();
    };

    const onDoubleClick = () => {
      zoomRef.current = ZOOM_DEFAULT;
      panRef.current = 0;
      applyCamera();
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('dblclick', onDoubleClick);

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [scene, size]);

  useEffect(() => {
    if (!figure) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    const group = new THREE.Group();
    group.position.y = -0.48;

    const build = async () => {
      const fetched = await Promise.all(figure.parts.map((part) => fetchMesh(part.model)));
      const meshes = fetched.map((mesh, index) => {
        const offset = figure.parts[index]?.offset;
        return mesh && offset ? transformMesh(mesh, offset) : mesh;
      });

      const garments: THREE.Mesh[] = [];
      figure.parts.forEach((part, index) => {
        const mesh = meshes[index];
        if (part.layer !== LAYER_CLOTHING || !mesh) return;
        const probe = new THREE.Mesh(toGeometry(mesh), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        probe.updateMatrixWorld();
        garments.push(probe);
      });

      return Promise.all(figure.parts.map(async (part, index) => {
        const mesh = meshes[index];
        if (!mesh) return null;

        const material = new THREE.MeshLambertMaterial({
          side: THREE.DoubleSide,
          alphaTest: 0.35,
        });
        if (part.tint) material.color.setRGB(...part.tint);
        material.polygonOffset = true;
        material.polygonOffsetFactor = -part.layer;
        material.polygonOffsetUnits = -part.layer;

        if (part.texture) {
          const texture = await loader.loadAsync(part.texture).catch(() => null);
          if (texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.needsUpdate = true;
          }
        }

        const geometry = toGeometry(mesh);
        if (part.layer === LAYER_BODY) {
          geometry.setIndex(clothedBodyIndices(mesh, geometry, garments));
        }

        const object = new THREE.Mesh(geometry, material);
        object.renderOrder = part.layer;
        return object;
      }));
    };

    build().then((objects) => {
      objects.forEach((object) => object && group.add(object));
      if (cancelled) {
        disposeGroup(group);
        return;
      }
      const previous = groupRef.current;
      if (previous) {
        scene.remove(previous);
        disposeGroup(previous);
      }
      groupRef.current = group;
      scene.add(group);
      setReady(objects.some(Boolean));
    });

    return () => {
      cancelled = true;
    };
  }, [figure, scene]);

  useEffect(
    () => () => {
      const group = groupRef.current;
      if (group) {
        scene.remove(group);
        disposeGroup(group);
        groupRef.current = null;
      }
    },
    [scene],
  );

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: ready ? 0 : 1,
          transition: 'opacity 240ms ease',
        }}
      >
        {fallback}
      </div>
      <div
        ref={mountRef}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: ready ? 1 : 0,
          transition: 'opacity 240ms ease',
        }}
      />
    </div>
  );
}
