import { readFile } from "node:fs/promises";
import { resolveMediaPath, resolveModelPath, resolveTexturePath } from "./assets";
import { bindPose, loadMesh } from "./xModel";

export type FigurePart = {
  id: string;
  label: string;
  model: string;
  texture: string | null;
  tint: [number, number, number] | null;
  layer: number;
  offset?: number[];
  attachBone?: string;
};

export type Figure = {
  female: boolean;
  parts: FigurePart[];
  missing: string[];
};

type Appearance = {
  female?: boolean;
  skinTexture?: string;
  skinTextureIndex?: number;
  hairModel?: string;
  hairColor?: { r: number; g: number; b: number };
  beardModel?: string;
  beardColor?: { r: number; g: number; b: number };
  worn?: {
    clothingItem?: string;
    name?: string;
    location?: string;
    hasModel?: boolean;
    textureChoice?: number;
    baseTexture?: number;
    tint?: { r: number; g: number; b: number };
  }[];
};

function tagValues(xml: string, tag: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`<${tag}>([^<]*)</${tag}>`, "g");
  for (const match of xml.matchAll(pattern)) values.push(match[1]!.trim());
  return values;
}

function tagValue(xml: string, tag: string): string {
  return tagValues(xml, tag)[0] ?? "";
}

const clothingCache = new Map<string, ClothingDef | null>();

type ClothingDef = {
  maleModel: string;
  femaleModel: string;
  textureChoices: string[];
  baseTextures: string[];
  attachments: string[];
  attachBone: string;
  hatCategory: string;
};

async function clothingDef(name: string): Promise<ClothingDef | null> {
  const cached = clothingCache.get(name);
  if (cached !== undefined) return cached;

  let def: ClothingDef | null = null;
  const path = await resolveMediaPath(`clothing/clothingItems/${name}.xml`);
  if (path) {
    try {
      const xml = await readFile(path, "utf8");
      const attachments = tagValues(xml, "m_Attachments")
        .flatMap((v) => v.split(",").map((s) => s.trim()))
        .filter(Boolean);
      def = {
        maleModel: tagValue(xml, "m_MaleModel"),
        femaleModel: tagValue(xml, "m_FemaleModel"),
        textureChoices: tagValues(xml, "textureChoices").filter(Boolean),
        baseTextures: tagValues(xml, "m_BaseTextures").filter(Boolean),
        attachments,
        attachBone: tagValue(xml, "m_AttachBone"),
        hatCategory: tagValue(xml, "m_HatCategory"),
      };
    } catch {
      def = null;
    }
  }

  clothingCache.set(name, def);
  return def;
}

type Style = { model: string; texture: string; alternates: Map<string, string> };
let hairStyles: Map<string, Style> | null = null;
let beardStyles: Map<string, Style> | null = null;

// hairStyles.xml keys styles by <male>/<female> element rather than by an
// attribute, and the same style name can appear under both with different
// models, so male entries are keyed "m:<name>" and female "f:<name>".
async function loadHairStyles(): Promise<Map<string, Style>> {
  if (hairStyles) return hairStyles;
  const styles = new Map<string, Style>();
  const path = await resolveMediaPath("hairStyles/hairStyles.xml");
  if (path) {
    const xml = await readFile(path, "utf8").catch(() => "");
    for (const match of xml.matchAll(/<(male|female)>([\s\S]*?)<\/\1>/g)) {
      const prefix = match[1] === "male" ? "m:" : "f:";
      const body = match[2]!;
      const name = tagValue(body, "name");
      if (!name) continue;
      // <alternate category="Group01" style="Hat" /> is how the game swaps a
      // style for one that fits under a hat of that category - which is also
      // the only thing that stops long hair spearing through the crown.
      const alternates = new Map<string, string>();
      for (const alt of body.matchAll(/<alternate\s+category="([^"]*)"\s+style="([^"]*)"/g)) {
        alternates.set(alt[1]!, alt[2]!);
      }
      styles.set(prefix + name.toLowerCase(), {
        model: tagValue(body, "model"),
        texture: tagValue(body, "texture"),
        alternates,
      });
    }
  }
  hairStyles = styles;
  return styles;
}

async function loadBeardStyles(): Promise<Map<string, Style>> {
  if (beardStyles) return beardStyles;
  const styles = new Map<string, Style>();
  // Not a typo: beardStyles.xml sits in the hairStyles folder alongside it.
  const path = await resolveMediaPath("hairStyles/beardStyles.xml");
  if (path) {
    const xml = await readFile(path, "utf8").catch(() => "");
    for (const match of xml.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      const body = match[1]!;
      const name = tagValue(body, "name");
      if (name) {
        styles.set(name.toLowerCase(), {
          model: tagValue(body, "model"),
          texture: tagValue(body, "texture"),
          alternates: new Map(),
        });
      }
    }
  }
  beardStyles = styles;
  return styles;
}

// Build 42's skin tones live in textures/Body as MaleBody01..05 and
// FemaleBody01..05 - not the Male_N_Body.png still sitting in the textures
// root, which are the legacy build's and are not what the game picks. The mod
// reports the name outright where getSkinTexture() exists; the index is only
// a fallback, and it is 0-based (index 0 is ...Body01).
function bodyTexture(appearance: Appearance, female: boolean): string {
  if (appearance.skinTexture) return appearance.skinTexture;
  const index = Math.min(Math.max((appearance.skinTextureIndex ?? 0) + 1, 1), 5);
  return `${female ? "Female" : "Male"}Body0${index}`;
}

// Skin textures are addressed bare ("FemaleBody01") but live one directory
// down, so try Body/ before falling back to the textures root.
async function resolveBodyTexture(name: string): Promise<string | null> {
  return (await resolveTexturePath(`Body/${name}`)) ? `Body/${name}` : (await resolveTexturePath(name)) ? name : null;
}

function rgb(color: { r: number; g: number; b: number } | undefined): [number, number, number] | null {
  if (!color) return null;
  return [color.r ?? 1, color.g ?? 1, color.b ?? 1];
}

function modelUrl(path: string) {
  return `/api/model/mesh?path=${encodeURIComponent(path)}`;
}

function textureUrl(path: string) {
  return `/api/model/texture?path=${encodeURIComponent(path)}`;
}

// Draw order matters: the body first, then anything painted onto the body
// (base-texture-only garments render as a slightly inflated copy of the body
// shell, which is how the game composites them), then real garment meshes,
// then hair and beard on top.
const LAYER = { body: 0, painted: 1, clothing: 2, hair: 3 } as const;

const ATTACHMENT_BONE: Record<string, string> = {
  "base:eyes": "Bip01_Head",
  "base:head": "Bip01_Head",
  "base:hat": "Bip01_Head",
  "base:mask": "Bip01_Head",
  "base:fullhat": "Bip01_Head",
  "base:ears": "Bip01_Head",
  "base:belt": "Bip01_Pelvis",
  "base:beltextra": "Bip01_Pelvis",
  "base:holster": "Bip01_Spine",
  "base:holsterleft": "Bip01_Spine",
  "base:holsterright": "Bip01_Spine",
  "base:shoulderholster": "Bip01_Spine1",
  "base:back": "Bip01_BackPack",
  "base:satchel": "Bip01_BackPack",
  "base:fannypackfront": "Bip01_Pelvis",
  "base:fannypackback": "Bip01_BackPack",
  "base:leftwrist": "Bip01_L_Forearm",
  "base:rightwrist": "Bip01_R_Forearm",
  "base:ankles": "Bip01_L_Foot",
};

const bodySkeletons = new Map<string, Map<string, number[]>>();

async function loadBodySkeleton(female: boolean): Promise<Map<string, number[]> | null> {
  const key = female ? 'f' : 'm';
  const cached = bodySkeletons.get(key);
  if (cached) return cached;
  const bodyModel = female ? "skinned/FemaleBody" : "skinned/MaleBody";
  const absPath = await resolveModelPath(bodyModel);
  if (!absPath) return null;
  const mesh = await loadMesh(absPath);
  if (!mesh) return null;
  const skeleton = bindPose(mesh);
  bodySkeletons.set(key, skeleton);
  return skeleton;
}

export async function buildFigure(appearance: Appearance): Promise<Figure> {
  const female = Boolean(appearance.female);
  const parts: FigurePart[] = [];
  const missing: string[] = [];

  const bodyModel = female ? "skinned/FemaleBody" : "skinned/MaleBody";
  const skeleton = await loadBodySkeleton(female);
  const bodyPath = await resolveModelPath(bodyModel);
  if (bodyPath) {
    const skin = await resolveBodyTexture(bodyTexture(appearance, female));
    if (!skin) missing.push(bodyTexture(appearance, female));
    parts.push({
      id: "body",
      label: "Body",
      model: modelUrl(bodyModel),
      texture: skin ? textureUrl(skin) : null,
      tint: null,
      layer: LAYER.body,
    });
  } else {
    missing.push(bodyModel);
  }

  let hatCategory = "";

  for (const [index, worn] of (appearance.worn ?? []).entries()) {
    const itemName = worn.clothingItem;
    if (!itemName) continue;
    const def = await clothingDef(itemName);
    if (!def) {
      missing.push(`clothingItems/${itemName}.xml`);
      continue;
    }
    if (def.hatCategory) hatCategory = def.hatCategory;

    const modelPath = female ? def.femaleModel || def.maleModel : def.maleModel || def.femaleModel;
    const hasModel = Boolean(modelPath);
    const choices = hasModel ? def.textureChoices : def.baseTextures;
    // The game reports -1 for whichever of the two indices doesn't apply to
    // this garment, so a raw lookup would miss and silently pick nothing.
    const raw = hasModel ? (worn.textureChoice ?? 0) : (worn.baseTexture ?? 0);
    const texture = choices[raw >= 0 ? raw : 0] ?? choices[0] ?? null;

    const resolvedModel = hasModel ? modelPath : bodyModel;
    if (hasModel && !(await resolveModelPath(modelPath))) {
      missing.push(modelPath);
      continue;
    }
    if (!hasModel && !texture) continue;

    let offset: number[] | undefined;
    let attachBone: string | undefined;
    const isStatic = hasModel && /(?:^|[\/\\])static(?:[\/\\]|$)/i.test(modelPath);
    if (isStatic && skeleton) {
      const boneName =
        def.attachBone ||
        (worn.location && ATTACHMENT_BONE[worn.location]) ||
        def.attachments.map((a) => ATTACHMENT_BONE[a]).find(Boolean) ||
        undefined;
      const bone = boneName ? skeleton.get(boneName) : undefined;
      if (bone) {
        offset = bone;
        attachBone = boneName;
      }
    }

    parts.push({
      id: `worn:${index}:${itemName}`,
      label: worn.name || itemName,
      model: modelUrl(resolvedModel),
      texture: texture && (await resolveTexturePath(texture)) ? textureUrl(texture) : null,
      tint: rgb(worn.tint),
      layer: hasModel ? LAYER.clothing : LAYER.painted,
      offset,
      attachBone,
    });
  }

  const hairName = appearance.hairModel?.trim();
  if (hairName) {
    const prefix = female ? "f:" : "m:";
    const styles = await loadHairStyles();
    let style = styles.get(prefix + hairName.toLowerCase());
    if (style && hatCategory) {
      const alternate = style.alternates.get(hatCategory) ?? style.alternates.get("default");
      style = (alternate && styles.get(prefix + alternate.toLowerCase())) || style;
    }
    if (style?.model && (await resolveModelPath(style.model))) {
      parts.push({
        id: "hair",
        label: `Hair (${hairName})`,
        model: modelUrl(style.model),
        texture: style.texture && (await resolveTexturePath(style.texture)) ? textureUrl(style.texture) : null,
        tint: rgb(appearance.hairColor),
        layer: LAYER.hair,
      });
    }
  }

  const beardName = appearance.beardModel?.trim();
  if (beardName) {
    const style = (await loadBeardStyles()).get(beardName.toLowerCase());
    if (style?.model && (await resolveModelPath(style.model))) {
      parts.push({
        id: "beard",
        label: `Beard (${beardName})`,
        model: modelUrl(style.model),
        texture: style.texture && (await resolveTexturePath(style.texture)) ? textureUrl(style.texture) : null,
        tint: rgb(appearance.beardColor),
        layer: LAYER.hair,
      });
    }
  }

  parts.sort((a, b) => a.layer - b.layer);
  return { female, parts, missing };
}
