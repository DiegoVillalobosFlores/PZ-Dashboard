import { readdir } from "node:fs/promises";
import { join, normalize } from "node:path";
import { PZ_INSTALL_DIR } from "../config";

const MEDIA = () => join(PZ_INSTALL_DIR, "media");

// The game's XML records model and texture paths lowercased with Windows
// separators ("x:skinned\clothes\bob_trousers") while the files on disk are
// CamelCase - harmless on Windows, fatal on Linux. Every lookup walks the
// tree a segment at a time, matching case-insensitively against a cached
// listing of each directory.
const listings = new Map<string, Map<string, string>>();

async function listing(dir: string): Promise<Map<string, string>> {
  const cached = listings.get(dir);
  if (cached) return cached;

  const entries = new Map<string, string>();
  try {
    for (const name of await readdir(dir)) entries.set(name.toLowerCase(), name);
  } catch {
    // Missing directory caches as empty so a bad path isn't re-stat'd per frame.
  }
  listings.set(dir, entries);
  return entries;
}

async function resolveCaseInsensitive(root: string, relative: string): Promise<string | null> {
  let current = root;
  for (const segment of relative.split("/")) {
    if (!segment || segment === ".") continue;
    const entries = await listing(current);
    const real = entries.get(segment.toLowerCase());
    if (!real) return null;
    current = join(current, real);
  }
  return current;
}

function sanitize(path: string): string | null {
  const cleaned = path.replace(/\\/g, "/").replace(/^[a-z]:/i, "").replace(/^\/+/, "");
  if (!cleaned) return null;
  const normalized = normalize(cleaned);
  if (normalized.startsWith("..") || normalized.includes("../")) return null;
  return normalized;
}

// Clothing XML writes model paths two ways: "x:skinned\clothes\bob_trousers"
// (relative to models_X, no extension) and the fully spelled out
// "media\models_X\Skinned\Clothes\Bob_AmmoStrap.X". Both appear in the
// shipped files, so both have to resolve.
export async function resolveModelPath(path: string): Promise<string | null> {
  const cleaned = sanitize(path);
  if (!cleaned || !PZ_INSTALL_DIR) return null;
  const withExt = /\.(x|fbx)$/i.test(cleaned) ? cleaned : `${cleaned}.x`;
  if (withExt.toLowerCase().startsWith("media/")) {
    return resolveCaseInsensitive(PZ_INSTALL_DIR, withExt);
  }
  return resolveCaseInsensitive(join(MEDIA(), "models_X"), withExt);
}

export async function resolveTexturePath(path: string): Promise<string | null> {
  const cleaned = sanitize(path);
  if (!cleaned || !PZ_INSTALL_DIR) return null;
  const withExt = /\.png$/i.test(cleaned) ? cleaned : `${cleaned}.png`;
  return resolveCaseInsensitive(join(MEDIA(), "textures"), withExt);
}

export async function resolveMediaPath(relative: string): Promise<string | null> {
  const cleaned = sanitize(relative);
  if (!cleaned || !PZ_INSTALL_DIR) return null;
  return resolveCaseInsensitive(MEDIA(), cleaned);
}
