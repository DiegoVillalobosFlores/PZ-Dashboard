import { readFile } from "node:fs/promises";
import { basename } from "node:path";

// One bone's influence over the mesh. None of it is used to animate - the
// figure is drawn in bind pose - but the bone names are the only thing that
// identifies the body model's hidden dress panels, so the renderer needs them.
export type SkinBinding = {
  bone: string;
  indices: number[];
  weights: number[];
};

export type MeshGeometry = {
  name: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  skin: SkinBinding[];
};

type Token =
  | { kind: "sym"; value: "{" | "}" }
  | { kind: "id"; value: string }
  | { kind: "num"; value: number }
  | { kind: "str"; value: string };

// PZ ships its character models as ASCII DirectX .x ("xof 0303txt"). The
// format is a tree of `Type Name { ... }` blocks whose payloads are numbers
// separated by ; and , - the separators carry no information a reader needs,
// because every list is preceded by its own count, so they're tokenized away
// as whitespace and the counts drive how far to read.
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i]!;

    if (c === "#" || (c === "/" && text[i + 1] === "/")) {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "<") {
      while (i < n && text[i] !== ">") i += 1;
      i += 1;
      continue;
    }
    if (c === '"') {
      const start = i + 1;
      i += 1;
      while (i < n && text[i] !== '"') i += 1;
      tokens.push({ kind: "str", value: text.slice(start, i) });
      i += 1;
      continue;
    }
    if (c === "{" || c === "}") {
      tokens.push({ kind: "sym", value: c });
      i += 1;
      continue;
    }
    if (c === ";" || c === "," || c <= " ") {
      i += 1;
      continue;
    }

    if (c === "-" || c === "." || (c >= "0" && c <= "9")) {
      let j = i + 1;
      while (j < n && /[0-9.eE+-]/.test(text[j]!)) j += 1;
      const parsed = Number(text.slice(i, j));
      if (Number.isFinite(parsed)) {
        tokens.push({ kind: "num", value: parsed });
        i = j;
        continue;
      }
    }

    let j = i;
    while (j < n && /[A-Za-z0-9_]/.test(text[j]!)) j += 1;
    if (j === i) {
      i += 1;
      continue;
    }
    tokens.push({ kind: "id", value: text.slice(i, j) });
    i = j;
  }

  return tokens;
}

type Cursor = { tokens: Token[]; i: number };

function num(cur: Cursor): number {
  while (cur.i < cur.tokens.length && cur.tokens[cur.i]!.kind !== "num") cur.i += 1;
  const token = cur.tokens[cur.i];
  cur.i += 1;
  return token && token.kind === "num" ? token.value : 0;
}

function skipBlock(cur: Cursor) {
  let depth = 0;
  while (cur.i < cur.tokens.length) {
    const token = cur.tokens[cur.i]!;
    cur.i += 1;
    if (token.kind === "sym") {
      if (token.value === "{") depth += 1;
      else if (--depth <= 0) return;
    }
  }
}

function readFaceList(cur: Cursor, count: number): number[] {
  const indices: number[] = [];
  for (let f = 0; f < count; f += 1) {
    const size = num(cur);
    const face: number[] = [];
    for (let k = 0; k < size; k += 1) face.push(num(cur));
    for (let k = 2; k < face.length; k += 1) indices.push(face[0]!, face[k - 1]!, face[k]!);
  }
  return indices;
}

function readMatrix(cur: Cursor): number[] | null {
  const matrix: number[] = [];
  for (let i = 0; i < 16; i += 1) {
    if (cur.i >= cur.tokens.length) return null;
    matrix.push(num(cur));
  }
  return matrix;
}

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiplyMatrices(a: number[], b: number[]): number[] {
  const r = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[row * 4 + k]! * b[k * 4 + col]!;
      r[row * 4 + col] = sum;
    }
  }
  return r;
}

function transformPositions(positions: number[], matrix: number[]) {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const y = positions[i + 1]!;
    const z = positions[i + 2]!;
    positions[i] = x * matrix[0]! + y * matrix[4]! + z * matrix[8]! + matrix[12]!;
    positions[i + 1] = x * matrix[1]! + y * matrix[5]! + z * matrix[9]! + matrix[13]!;
    positions[i + 2] = x * matrix[2]! + y * matrix[6]! + z * matrix[10]! + matrix[14]!;
  }
}

function parseMesh(cur: Cursor, name: string): MeshGeometry {
  const mesh: MeshGeometry = { name, positions: [], normals: [], uvs: [], indices: [], skin: [] };

  const vertexCount = num(cur);
  for (let v = 0; v < vertexCount * 3; v += 1) mesh.positions.push(num(cur));
  mesh.indices = readFaceList(cur, num(cur));

  while (cur.i < cur.tokens.length) {
    const token = cur.tokens[cur.i]!;
    if (token.kind === "sym" && token.value === "}") {
      cur.i += 1;
      break;
    }
    if (token.kind !== "id") {
      cur.i += 1;
      continue;
    }

    const type = token.value;
    const start = cur.i;
    cur.i += 1;
    if (cur.tokens[cur.i]?.kind === "id") cur.i += 1;
    if (!(cur.tokens[cur.i]?.kind === "sym" && (cur.tokens[cur.i] as Token & { value: string }).value === "{")) {
      cur.i = start + 1;
      continue;
    }
    cur.i += 1;

    if (type === "MeshNormals") {
      const normalCount = num(cur);
      for (let v = 0; v < normalCount * 3; v += 1) mesh.normals.push(num(cur));
      readFaceList(cur, num(cur));
      while (cur.i < cur.tokens.length) {
        const end = cur.tokens[cur.i]!;
        cur.i += 1;
        if (end.kind === "sym" && end.value === "}") break;
        if (end.kind === "sym" && end.value === "{") {
          cur.i -= 1;
          skipBlock(cur);
        }
      }
    } else if (type === "SkinWeights") {
      const boneToken = cur.tokens[cur.i];
      const bone = boneToken?.kind === "str" ? boneToken.value : "";
      if (boneToken?.kind === "str") cur.i += 1;
      const weightCount = num(cur);
      const indices: number[] = [];
      const weights: number[] = [];
      for (let v = 0; v < weightCount; v += 1) indices.push(num(cur));
      for (let v = 0; v < weightCount; v += 1) weights.push(num(cur));
      if (bone) mesh.skin.push({ bone, indices, weights });
      while (cur.i < cur.tokens.length) {
        const end = cur.tokens[cur.i]!;
        cur.i += 1;
        if (end.kind === "sym" && end.value === "}") break;
      }
    } else if (type === "MeshTextureCoords") {
      const uvCount = num(cur);
      for (let v = 0; v < uvCount * 2; v += 1) mesh.uvs.push(num(cur));
      while (cur.i < cur.tokens.length) {
        const end = cur.tokens[cur.i]!;
        cur.i += 1;
        if (end.kind === "sym" && end.value === "}") break;
      }
    } else {
      cur.i -= 1;
      skipBlock(cur);
    }
  }

  if (mesh.normals.length !== mesh.positions.length) mesh.normals = [];
  if (mesh.uvs.length / 2 !== mesh.positions.length / 3) mesh.uvs = [];
  return mesh;
}

function parseChildren(cur: Cursor, meshes: MeshGeometry[], parentTransform: number[]) {
  while (cur.i < cur.tokens.length) {
    const token = cur.tokens[cur.i]!;
    if (token.kind === "sym") {
      if (token.value === "}") {
        cur.i += 1;
        return;
      }
      cur.i += 1;
      continue;
    }
    if (token.kind !== "id") {
      cur.i += 1;
      continue;
    }

    if (token.value === "Frame") {
      cur.i += 1;
      if (cur.tokens[cur.i]?.kind === "id") cur.i += 1;
      if (cur.tokens[cur.i]?.kind === "sym" && (cur.tokens[cur.i] as Token & { value: string }).value === "{") {
        cur.i += 1;
      }

      let frameTransform = identityMatrix();
      const saved = cur.i;
      const maybeId = cur.tokens[cur.i];
      if (maybeId?.kind === "id" && maybeId.value === "FrameTransformMatrix") {
        cur.i += 1;
        if (cur.tokens[cur.i]?.kind === "sym" && (cur.tokens[cur.i] as Token & { value: string }).value === "{") {
          cur.i += 1;
          const matrix = readMatrix(cur);
          if (matrix) frameTransform = matrix;
          while (cur.i < cur.tokens.length) {
            const end = cur.tokens[cur.i]!;
            cur.i += 1;
            if (end.kind === "sym" && end.value === "}") break;
          }
        } else {
          cur.i = saved;
        }
      }

      const childTransform = multiplyMatrices(parentTransform, frameTransform);
      parseChildren(cur, meshes, childTransform);
      continue;
    }

    if (token.value === "Mesh") {
      cur.i += 1;
      const next = cur.tokens[cur.i];
      const name = next?.kind === "id" ? next.value : "";
      if (next?.kind === "id") cur.i += 1;
      if (cur.tokens[cur.i]?.kind === "sym") cur.i += 1;
      const mesh = parseMesh(cur, name);
      if (mesh.positions.length) transformPositions(mesh.positions, parentTransform);
      meshes.push(mesh);
      continue;
    }

    if (token.value === "template") {
      cur.i += 1;
      if (cur.tokens[cur.i]?.kind === "id") cur.i += 1;
      skipBlock(cur);
      continue;
    }

    skipBlock(cur);
  }
}

export function parseXModel(text: string): MeshGeometry[] {
  const cur: Cursor = { tokens: tokenize(text), i: 0 };
  const meshes: MeshGeometry[] = [];
  parseChildren(cur, meshes, identityMatrix());
  return meshes;
}

const cache = new Map<string, MeshGeometry | null>();

// A .x file can hold several variants of the same garment (Bob_Trousers.x
// carries both Bob_Trousers and Bob_LongShorts). The one the clothing item
// refers to is the one named like the file, so match on that and only fall
// back to the first mesh when nothing matches.
export async function loadMesh(absPath: string): Promise<MeshGeometry | null> {
  const cached = cache.get(absPath);
  if (cached !== undefined) return cached;

  let mesh: MeshGeometry | null = null;
  try {
    const meshes = parseXModel(await readFile(absPath, "latin1"));
    const stem = basename(absPath).replace(/\.x$/i, "").toLowerCase();
    mesh = meshes.find((m) => m.name.toLowerCase() === stem) ?? meshes[0] ?? null;
    if (mesh && mesh.indices.length === 0) mesh = null;
  } catch {
    mesh = null;
  }

  cache.set(absPath, mesh);
  return mesh;
}
