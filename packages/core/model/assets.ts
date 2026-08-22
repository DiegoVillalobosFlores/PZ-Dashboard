import type { GameFiles } from "../index";
import { joinPath, normalizePath } from "../path";

// The game's XML records model and texture paths lowercased with Windows
// separators ("x:skinned\clothes\bob_trousers") while the files on disk are
// CamelCase - harmless on Windows, fatal on Linux. Every lookup walks the
// tree a segment at a time, matching case-insensitively against a cached
// listing of each directory.
const listings = new Map<string, Map<string, string>>();

async function listing(files: GameFiles, dir: string): Promise<Map<string, string>> {
  const cached = listings.get(dir);
  if (cached) return cached;

  const entries = new Map<string, string>();
  try {
    for (const name of await files.list(dir)) entries.set(name.toLowerCase(), name);
  } catch {
    // Missing directory caches as empty so a bad path isn't re-stat'd per frame.
  }
  listings.set(dir, entries);
  return entries;
}

async function resolveCaseInsensitive(files: GameFiles, root: string, relative: string): Promise<string | null> {
  let current = root;
  for (const segment of relative.split("/")) {
    if (!segment || segment === ".") continue;
    const entries = await listing(files, current);
    const real = entries.get(segment.toLowerCase());
    if (!real) return null;
    current = joinPath(current, real);
  }
  return current;
}

function sanitize(path: string): string | null {
  const cleaned = path.replace(/\\/g, "/").replace(/^[a-z]:/i, "").replace(/^\/+/, "");
  if (!cleaned) return null;
  const normalized = normalizePath(cleaned);
  if (normalized.startsWith("..") || normalized.includes("../")) return null;
  return normalized;
}

// Clothing XML writes model paths two ways: "x:skinned\clothes\bob_trousers"
// (relative to models_X, no extension) and the fully spelled out
// "media\models_X\Skinned\Clothes\Bob_AmmoStrap.X". Both appear in the
// shipped files, so both have to resolve.
export async function resolveModelPath(files: GameFiles, path: string, installDir: string): Promise<string | null> {
  const cleaned = sanitize(path);
  if (!cleaned || !installDir) return null;
  const withExt = /\.(x|fbx)$/i.test(cleaned) ? cleaned : `${cleaned}.x`;
  if (withExt.toLowerCase().startsWith("media/")) {
    return resolveCaseInsensitive(files, installDir, withExt);
  }
  return resolveCaseInsensitive(files, joinPath(installDir, "media", "models_X"), withExt);
}

export async function resolveTexturePath(files: GameFiles, path: string, installDir: string): Promise<string | null> {
  const cleaned = sanitize(path);
  if (!cleaned || !installDir) return null;
  const withExt = /\.png$/i.test(cleaned) ? cleaned : `${cleaned}.png`;
  return resolveCaseInsensitive(files, joinPath(installDir, "media", "textures"), withExt);
}

export async function resolveMediaPath(files: GameFiles, relative: string, installDir: string): Promise<string | null> {
  const cleaned = sanitize(relative);
  if (!cleaned || !installDir) return null;
  return resolveCaseInsensitive(files, joinPath(installDir, "media"), cleaned);
}
