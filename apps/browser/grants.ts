import { FILE_PREFIX } from "../../packages/core/config";
import { makeBrowserFiles, restoreHandles, saveHandles, type DirectoryHandle } from "./files";

export type BrowserAccess = {
  data: DirectoryHandle;
  dataWritable: boolean;
  dataNeedsConfirmation?: boolean;
  install?: DirectoryHandle;
  installNeedsConfirmation?: boolean;
  installError?: string;
};

async function permission(handle: DirectoryHandle, mode: "read" | "readwrite", prompt: boolean): Promise<boolean> {
  if ((await handle.queryPermission({ mode })) === "granted") return true;
  return prompt && (await handle.requestPermission({ mode })) === "granted";
}

async function directory(handle: DirectoryHandle, parts: string[]): Promise<DirectoryHandle> {
  let current = handle;
  for (const part of parts) current = await current.getDirectoryHandle(part);
  return current;
}

export async function validateInstall(handle: DirectoryHandle): Promise<string | null> {
  try {
    const media = await directory(handle, ["media"]);
    const maps = await media.getDirectoryHandle("maps");
    const packs = await media.getDirectoryHandle("texturepacks");
    const mapNames: string[] = [];
    const packNames: string[] = [];
    for await (const [name] of maps.entries()) mapNames.push(name);
    for await (const [name] of packs.entries()) packNames.push(name);
    if (!mapNames.length || !packNames.some((name) => name.endsWith(".pack"))) {
      return `Expected game install directory containing media/maps and media/texturepacks/*.pack, but "${handle.name}" did not contain both.`;
    }
    return null;
  } catch {
    return `Expected game install directory containing media/maps and media/texturepacks/*.pack, but "${handle.name}" was not a Project Zomboid install.`;
  }
}

// The two directories are easy to confuse, and picking the install folder
// here looks exactly like a game that has not started yet. An empty Lua
// folder is legitimate though - the mod has not written a snapshot until the
// game runs once - so the absence of snapshots alone is never an error.
export async function validateData(handle: DirectoryHandle): Promise<string | null> {
  let snapshots = 0;
  let settings = 0;
  let looksLikeInstall = false;

  try {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === "directory") {
        if (name === "media" || name === "steamapps") looksLikeInstall = true;
        continue;
      }
      if (name.startsWith(FILE_PREFIX) && name.endsWith(".json")) snapshots++;
      else if (name.endsWith(".ini")) settings++;
    }
  } catch {
    return `Could not read "${handle.name}".`;
  }

  if (snapshots) return null;
  if (looksLikeInstall) {
    return `"${handle.name}" looks like the game install directory. This step wants the Zomboid data directory instead - the Lua folder holding ${FILE_PREFIX}*.json. The install directory is asked for separately, once a screen needs map or icon assets.`;
  }
  if (settings || handle.name.toLowerCase() === "lua") return null;
  return `Expected the Zomboid data directory - the Lua folder holding ${FILE_PREFIX}*.json - but "${handle.name}" contained neither those snapshots nor any Zomboid settings files.`;
}

export async function requestData(): Promise<BrowserAccess> {
  const data = await window.showDirectoryPicker({ mode: "readwrite" });
  const readable = await permission(data, "read", true);
  if (!readable) throw new Error("Read access to Zomboid data directory is required.");
  const invalid = await validateData(data);
  if (invalid) throw new Error(invalid);
  const dataWritable = await permission(data, "readwrite", false);
  await saveHandles(data);
  return { data, dataWritable };
}

export async function restoreAccess(): Promise<BrowserAccess | null> {
  const handles = await restoreHandles();
  if (!handles.data) return null;

  const readable = await permission(handles.data, "read", false);
  if (!readable) return { data: handles.data, dataWritable: false, dataNeedsConfirmation: true };

  const dataWritable = await permission(handles.data, "readwrite", false);
  if (!handles.install) return { data: handles.data, dataWritable };

  const installReadable = await permission(handles.install, "read", false);
  if (!installReadable) return { data: handles.data, dataWritable, install: handles.install, installNeedsConfirmation: true };

  const installError = await validateInstall(handles.install);
  return { data: handles.data, dataWritable, install: handles.install, installError: installError ?? undefined };
}

export async function confirmData(access: BrowserAccess): Promise<BrowserAccess> {
  if (!(await permission(access.data, "read", true))) throw new Error("Read access to Zomboid data directory was denied.");
  const dataWritable = await permission(access.data, "readwrite", true);
  await saveHandles(access.data, access.install);
  return { ...access, dataWritable, dataNeedsConfirmation: false };
}

export async function requestInstall(access: BrowserAccess): Promise<BrowserAccess> {
  const install = await window.showDirectoryPicker({ mode: "read" });
  if (!(await permission(install, "read", true))) throw new Error("Read access to game install directory was denied.");
  const installError = await validateInstall(install);
  if (installError) throw new Error(installError);
  await saveHandles(access.data, install);
  return { ...access, install, installNeedsConfirmation: false, installError: undefined };
}

export async function confirmInstall(access: BrowserAccess): Promise<BrowserAccess> {
  if (!access.install) return requestInstall(access);
  if (!(await permission(access.install, "read", true))) throw new Error("Read access to game install directory was denied.");
  const installError = await validateInstall(access.install);
  if (installError) throw new Error(installError);
  return { ...access, installNeedsConfirmation: false, installError: undefined };
}

export { makeBrowserFiles };
