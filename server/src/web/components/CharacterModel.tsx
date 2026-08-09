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
  attachBone?: string;
};

type Figure = { female: boolean; parts: FigurePart[]; updatedAt: number };

type MeshData = {
  name: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  skin: { bone: string; indices: number[]; weights: number[]; offsetMatrix: number[] | null }[];
};

const meshCache = new Map<string, Promise<MeshData | null>>();

function fetchMesh(url: string): Promise<MeshData | null> {
  const cached = meshCache.get(url);
  if (cached) return cached;
  const request = fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<MeshData>) : null))
    .catch(() => null);
  request.then((result) => {
    if (result === null) meshCache.delete(url);
  });
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

function invertAffine(matrix: number[]): number[] | null {
  const a = matrix[0]!;
  const b = matrix[1]!;
  const c = matrix[2]!;
  const d = matrix[4]!;
  const e = matrix[5]!;
  const f = matrix[6]!;
  const g = matrix[8]!;
  const h = matrix[9]!;
  const i = matrix[10]!;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!det || !Number.isFinite(det)) return null;
  const r = [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
  const tx = matrix[12]!;
  const ty = matrix[13]!;
  const tz = matrix[14]!;
  return [
    r[0]!, r[1]!, r[2]!, 0,
    r[3]!, r[4]!, r[5]!, 0,
    r[6]!, r[7]!, r[8]!, 0,
    -(tx * r[0]! + ty * r[3]! + tz * r[6]!),
    -(tx * r[1]! + ty * r[4]! + tz * r[7]!),
    -(tx * r[2]! + ty * r[5]! + tz * r[8]!),
    1,
  ];
}

const ARMS_DOWN = new THREE.Vector3(0, -1, 0);
const ARM_ABDUCTION = 0.26;

const ARM_BONE = /^Bip01_[LR]_(?:UpperArm|Forearm|Hand|Finger)/;

function isArmBone(bone: string): boolean {
  return ARM_BONE.test(bone);
}

type ArmPose = {
  side: 'L' | 'R';
  pivot: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

function armPosesFrom(mesh: MeshData): ArmPose[] {
  const world = new Map<string, THREE.Matrix4>();
  for (const binding of mesh.skin) {
    if (!binding.offsetMatrix) continue;
    const inverse = invertAffine(binding.offsetMatrix);
    if (inverse) world.set(binding.bone, new THREE.Matrix4().fromArray(inverse));
  }

  const arms: ArmPose[] = [];
  for (const side of ['L', 'R'] as const) {
    const upper = world.get(`Bip01_${side}_UpperArm`);
    const hand = world.get(`Bip01_${side}_Hand`);
    if (!upper || !hand) continue;
    const pivot = new THREE.Vector3().setFromMatrixPosition(upper);
    const direction = new THREE.Vector3().setFromMatrixPosition(hand).sub(pivot).normalize();
    if (!direction.lengthSq()) continue;
    const target = ARMS_DOWN.clone().addScaledVector(direction, ARM_ABDUCTION).normalize();
    arms.push({ side, pivot, quaternion: new THREE.Quaternion().setFromUnitVectors(direction, target) });
  }
  return arms;
}

function poseArmsDown(mesh: MeshData, arms: ArmPose[], attachBone?: string): MeshData {
  if (!mesh.skin.length) {
    if (!attachBone || !isArmBone(attachBone)) return mesh;
    const arm = arms.find((candidate) => attachBone.startsWith(`Bip01_${candidate.side}_`));
    if (!arm) return mesh;
    const positions = [...mesh.positions];
    const normals = mesh.normals.length === positions.length ? [...mesh.normals] : [];
    const point = new THREE.Vector3();
    const rotated = new THREE.Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      point
        .set(positions[i]!, positions[i + 1]!, positions[i + 2]!)
        .sub(arm.pivot)
        .applyQuaternion(arm.quaternion)
        .add(arm.pivot);
      positions[i] = point.x;
      positions[i + 1] = point.y;
      positions[i + 2] = point.z;
      if (normals.length) {
        rotated.set(normals[i]!, normals[i + 1]!, normals[i + 2]!).applyQuaternion(arm.quaternion);
        normals[i] = rotated.x;
        normals[i + 1] = rotated.y;
        normals[i + 2] = rotated.z;
      }
    }
    return { ...mesh, positions, normals };
  }

  const chain = new Set(mesh.skin.filter((binding) => isArmBone(binding.bone)).map((binding) => binding.bone));
  if (!chain.size || !arms.length) return mesh;

  const positions = [...mesh.positions];
  const vertexCount = positions.length / 3;
  const weight = new Float64Array(vertexCount);
  const moved = new Float64Array(positions.length);
  const point = new THREE.Vector3();
  const normals = mesh.normals.length === positions.length ? [...mesh.normals] : [];
  const movedNormals = normals.length ? new Float64Array(normals.length) : null;
  const rotatedNormal = new THREE.Vector3();

  for (const binding of mesh.skin) {
    if (!chain.has(binding.bone)) continue;
    const arm = arms.find((candidate) => binding.bone.startsWith(`Bip01_${candidate.side}_`));
    if (!arm) continue;
    const { indices, weights } = binding;
    for (let v = 0; v < indices.length; v += 1) {
      const vertex = indices[v]!;
      const w = weights[v] ?? 0;
      if (!w) continue;
      const o = vertex * 3;
      point
        .set(positions[o]!, positions[o + 1]!, positions[o + 2]!)
        .sub(arm.pivot)
        .applyQuaternion(arm.quaternion)
        .add(arm.pivot);
      weight[vertex]! += w;
      moved[o]! += w * point.x;
      moved[o + 1]! += w * point.y;
      moved[o + 2]! += w * point.z;
      if (movedNormals) {
        rotatedNormal.set(normals[o]!, normals[o + 1]!, normals[o + 2]!).applyQuaternion(arm.quaternion);
        movedNormals[o]! += w * rotatedNormal.x;
        movedNormals[o + 1]! += w * rotatedNormal.y;
        movedNormals[o + 2]! += w * rotatedNormal.z;
      }
    }
  }

  for (let v = 0; v < vertexCount; v += 1) {
    const rest = 1 - weight[v]!;
    const o = v * 3;
    positions[o] = rest * positions[o]! + moved[o]!;
    positions[o + 1] = rest * positions[o + 1]! + moved[o + 1]!;
    positions[o + 2] = rest * positions[o + 2]! + moved[o + 2]!;
  }

  if (movedNormals) {
    for (let v = 0; v < vertexCount; v += 1) {
      const w = weight[v]!;
      if (!w) continue;
      const o = v * 3;
      const x = (1 - w) * normals[o]! + movedNormals[o]!;
      const y = (1 - w) * normals[o + 1]! + movedNormals[o + 1]!;
      const z = (1 - w) * normals[o + 2]! + movedNormals[o + 2]!;
      const length = Math.hypot(x, y, z) || 1;
      normals[o] = x / length;
      normals[o + 1] = y / length;
      normals[o + 2] = z / length;
    }
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
const AUTO_YAW_SPEED = 0.3;
const AUTO_YAW_RESUME_MS = 3000;
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
  fallback,
}: {
  fallback?: React.ReactNode;
}) {
  const figure = useFigure();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef(0);
  const zoomRef = useRef(ZOOM_DEFAULT);
  const panRef = useRef(0);
  const interactingRef = useRef(false);
  const resumeAtRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const boxRef = useRef({ width: 1, height: 1 });
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

    const rect = mount.getBoundingClientRect();
    boxRef.current = { width: rect.width || 1, height: rect.height || 1 };

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(boxRef.current.width, boxRef.current.height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      boxRef.current.width / boxRef.current.height,
      0.1,
      20,
    );

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
    lastTickRef.current = null;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const previous = lastTickRef.current;
      lastTickRef.current = now;
      if (previous !== null && !interactingRef.current && now >= resumeAtRef.current) {
        yawRef.current += ((now - previous) / 1000) * AUTO_YAW_SPEED;
      }
      if (groupRef.current) {
        groupRef.current.rotation.y = yawRef.current;
      }
      renderer.render(scene, camera);
    };
    tick(performance.now());

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
      resumeAtRef.current = performance.now() + AUTO_YAW_RESUME_MS;
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
        panRef.current =
          gesture.pan + ((middle.y - gesture.y) / boxRef.current.height) * halfViewHeight(zoomRef.current) * 2;
      }
      applyCamera();
    };

    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      rebase();
      if (!pointers.size) {
        interactingRef.current = false;
        resumeAtRef.current = performance.now() + AUTO_YAW_RESUME_MS;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomRef.current *= Math.exp(event.deltaY * 0.0015);
      resumeAtRef.current = performance.now() + AUTO_YAW_RESUME_MS;
      applyCamera();
    };

    const onDoubleClick = () => {
      zoomRef.current = ZOOM_DEFAULT;
      panRef.current = 0;
      resumeAtRef.current = performance.now() + AUTO_YAW_RESUME_MS;
      applyCamera();
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('dblclick', onDoubleClick);

    const resizeObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width <= 0 || box.height <= 0) return;
      boxRef.current = { width: box.width, height: box.height };
      renderer.setSize(box.width, box.height);
      camera.aspect = box.width / box.height;
      camera.updateProjectionMatrix();
      applyCamera();
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [scene]);

  useEffect(() => {
    if (!figure) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    const group = new THREE.Group();
    group.position.y = -0.48;

    const build = async () => {
      const fetched = await Promise.all(figure.parts.map((part) => fetchMesh(part.model)));
      const skeletonMesh = fetched.find((mesh) => mesh && mesh.skin.length) ?? null;
      const posedArms = skeletonMesh ? armPosesFrom(skeletonMesh) : [];
      const meshes = fetched.map((mesh, index) => {
        const part = figure.parts[index];
        const offset = part?.offset;
        const transformed = mesh && offset ? transformMesh(mesh, offset) : mesh;
        return transformed ? poseArmsDown(transformed, posedArms, part?.attachBone) : transformed;
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
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
      }}
    >
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
