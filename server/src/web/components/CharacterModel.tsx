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

// DirectX .x is left-handed with a top-left texture origin; three.js is
// right-handed with a bottom-left one. Negating Z and flipping V at buffer
// build time is what stops the character coming out mirrored and with its
// textures upside down.
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
  return { ...mesh, positions, normals: [] };
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

// The body and its garments are separate closed shells that interpenetrate:
// measured against MaleBody.x, bare legs sit up to ~0.014 model units proud of
// Bob_Trousers.x, and the body's inner thighs are simply wider than the gap
// between the trouser legs. No amount of nudging fixes that, which is why the
// game doesn't try - it masks the covered body regions out (each
// ClothingItem's <m_Masks>). This does the same thing, deciding what's covered
// geometrically instead of from a mask table that only exists in the engine.
//
// A body vertex counts as covered if pulling it this far back along its own
// normal puts it inside a garment. Has to exceed the worst poke-through so
// proud skin is caught, and stay well under the clearance around a hand
// sticking out of a sleeve so bare skin survives.
const COVER_MARGIN = 0.02;

function isInsideGarment(
  point: THREE.Vector3,
  garments: THREE.Mesh[],
  raycaster: THREE.Raycaster,
): boolean {
  for (const garment of garments) {
    // Parity test: an odd number of crossings along any ray means the point
    // is enclosed. The direction is deliberately off-axis, since a ray running
    // along the grain of these mostly axis-aligned meshes grazes faces and
    // miscounts.
    raycaster.set(point, PARITY_RAY);
    if (raycaster.intersectObject(garment, false).length % 2 === 1) return true;
  }
  return false;
}

const PARITY_RAY = new THREE.Vector3(0.51, 0.63, 0.58).normalize();

// MaleBody.x and FemaleBody.x both carry a pair of flat panels hanging from
// the waist to the shin, front and back, weighted to Bip01_Dress* and used to
// drape a skirt. The game only draws them for a character actually wearing
// one; drawn unconditionally they read as a solid slab between the legs, in
// front of any trousers.
function dressPanelVertices(mesh: MeshData): Set<number> {
  const vertices = new Set<number>();
  for (const binding of mesh.skin ?? []) {
    if (!binding.bone.includes('Dress')) continue;
    for (const vertex of binding.indices) vertices.add(vertex);
  }
  return vertices;
}

// Drops body triangles the clothes have completely hidden, along with the
// dress panels. Only fully covered triangles go, so a band of skin survives
// under every hem and cuff - which is what keeps the open edge of the body
// shell out of sight.
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
    // A triangle only has to touch one dress-panel vertex to be part of a
    // panel, but has to be covered at all three corners to count as hidden.
    if (dress.has(a) || dress.has(b) || dress.has(c)) continue;
    if (covered[a] && covered[b] && covered[c]) continue;
    kept.push(a, b, c);
  }
  return kept;
}

function useFigure(): Figure | null {
  const [figure, setFigure] = useState<Figure | null>(null);
  const signatureRef = useRef<string>('');

  // The snapshot itself is never rendered - it's the change signal that tells
  // us to re-resolve the figure server-side, so a coat put on in-game shows up
  // here without polling.
  const appearance = useGameSubscription('appearance', (msg) =>
    msg.category === 'appearance' ? msg.updatedAt : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/model/figure')
      .then((res) => (res.ok ? (res.json() as Promise<Figure>) : null))
      .then((next) => {
        if (cancelled || !next) return;
        // The mod re-reports appearance every couple of seconds whether or not
        // anything changed, and rebuilding means re-running the coverage
        // raycasts over every body vertex. Only a genuinely different set of
        // parts is worth that.
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
// Distance at which a ~1-unit-tall figure fills most of a square viewport.
const ZOOM_DEFAULT = 2.2;
const ZOOM_NEAR = 0.6;
const ZOOM_FAR = 3.2;

// Half the figure's height about its centre, which is what bounds panning:
// there's only somewhere to pan to once the zoom has pushed part of the body
// outside the viewport.
const MODEL_HALF_HEIGHT = 0.49;

function halfViewHeight(distance: number): number {
  return distance * Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// A live 3D render of the character built from the game's own model and
// texture files: the mod says which ClothingItem and which texture choice,
// the server resolves those to meshes, and this stacks them in the same order
// the game layers them. Everything is bind pose - no skinning - which is why
// the figure stands in a T-pose rather than being animated.
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
  // Camera state lives in refs, not state: it changes every frame during a
  // gesture, and it has to survive the render effect re-running when `size`
  // changes so a layout switch doesn't throw away the user's zoom.
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

    // Panning is only allowed as far as the zoom has pushed the body out of
    // frame, so at the default zoom - where the whole figure fits - a vertical
    // drag does nothing at all rather than sliding the character into space.
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
        if (!interactingRef.current) yawRef.current += 0.004;
        groupRef.current.rotation.y = yawRef.current;
      }
      renderer.render(scene, camera);
    };
    tick();

    // One map for every active pointer, rather than a single drag: it's what
    // lets the same handlers serve a one-finger spin and a two-finger pinch,
    // which matters because the wide layout is a handheld with a touchscreen.
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
    // Re-baselined whenever a finger lands or lifts, so the model doesn't jump
    // when a pinch becomes a drag mid-gesture.
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
        // Dragging down should walk the camera up the body, so the figure
        // follows the finger.
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
      // Without this the gesture scrolls the page behind the panel instead.
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
    // The models are ~1 unit tall standing on y=0, so drop the group by half
    // its height to spin around the character's middle rather than its feet.
    group.position.y = -0.48;

    // Every mesh is fetched up front rather than built as it arrives, because
    // which parts of the body to cull can only be worked out once all the
    // garments covering it are known.
    const build = async () => {
      const meshes = await Promise.all(figure.parts.map((part) => fetchMesh(part.model)));

      const garments: THREE.Mesh[] = [];
      figure.parts.forEach((part, index) => {
        const mesh = meshes[index];
        if (part.layer !== LAYER_CLOTHING || !mesh) return;
        // DoubleSide is load-bearing, not cosmetic: the raycaster skips
        // back-facing hits on a FrontSide material, which halves the crossing
        // count and makes every parity test come back "outside".
        const probe = new THREE.Mesh(toGeometry(mesh), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        probe.updateMatrixWorld();
        garments.push(probe);
      });

      return Promise.all(figure.parts.map(async (part, index) => {
        const mesh = meshes[index];
        if (!mesh) return null;

        const material = new THREE.MeshLambertMaterial({
          // Every garment is a separate closed shell rather than a cutaway of
          // the body, and PZ's winding doesn't survive the handedness flip
          // cleanly, so both faces are drawn.
          side: THREE.DoubleSide,
          // alphaTest without `transparent` gives cutout edges (hair strands,
          // strap gaps) while still writing depth, so the shells behind a
          // cutout stay correctly occluded - blended transparency here would
          // sort them wrong.
          alphaTest: 0.35,
        });
        if (part.tint) material.color.setRGB(...part.tint);
        // Layered shells sit right on top of each other; nudging each one
        // depth-wise by its layer is what keeps a shirt from z-fighting the
        // torso underneath it.
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

        const effectiveMesh = part.offset ? transformMesh(mesh, part.offset) : mesh;
        const geometry = toGeometry(effectiveMesh);
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
      {/* Crossfaded rather than swapped: the panel keeps its shape while the
          meshes stream in, and an unreachable game install just leaves the
          paperdoll silhouette standing. */}
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
