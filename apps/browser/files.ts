import type { GameFiles } from "../../packages/core";

export type DirectoryHandle = FileSystemDirectoryHandle;

type Root = "data" | "install" | "cache";

function pathParts(path: string): { root: Root; parts: string[] } {
  const normalized = path.replaceAll("\\", "/");
  const match = /^\/(data|install|cache)(?:\/(.*))?$/.exec(normalized);
  if (!match) throw new Error(`Browser file path must start with /data, /install, or /cache: ${path}`);
  return { root: match[1] as Root, parts: (match[2] ?? "").split("/").filter(Boolean) };
}

async function directory(handle: DirectoryHandle, parts: string[], create = false): Promise<DirectoryHandle> {
  let current = handle;
  for (const part of parts) current = await current.getDirectoryHandle(part, { create });
  return current;
}

async function file(handle: DirectoryHandle, parts: string[], create = false): Promise<FileSystemFileHandle> {
  const name = parts.at(-1);
  if (!name) throw new Error("Invalid file path");
  return (await directory(handle, parts.slice(0, -1), create)).getFileHandle(name, { create });
}

export function makeBrowserFiles(data: DirectoryHandle, install?: DirectoryHandle, cache?: DirectoryHandle): GameFiles {
  function handleFor(root: Root): DirectoryHandle {
    if (root === "data") return data;
    if (root === "install") {
      if (!install) throw new Error("Install directory access is required for game assets.");
      return install;
    }
    if (!cache) throw new Error("Browser cache is unavailable.");
    return cache;
  }

  return {
    async read(path) {
      const { root, parts } = pathParts(path);
      const entry = await file(handleFor(root), parts);
      return new Uint8Array(await (await entry.getFile()).arrayBuffer());
    },
    async list(path) {
      const { root, parts } = pathParts(path);
      const handle = await directory(handleFor(root), parts);
      const names: string[] = [];
      for await (const [name] of handle.entries()) names.push(name);
      return names;
    },
    async stat(path) {
      try {
        const { root, parts } = pathParts(path);
        const entry = await file(handleFor(root), parts);
        return { mtimeMs: (await entry.getFile()).lastModified };
      } catch {
        return null;
      }
    },
    async write(path, content) {
      const { root, parts } = pathParts(path);
      if (root === "install") throw new Error("Game install directory is read-only.");
      const entry = await file(handleFor(root), parts, true);
      const writer = await entry.createWritable();
      await writer.write(content as unknown as FileSystemWriteChunkType);
      await writer.close();
    },
  };
}

const DB = "pz-dashboard";
const STORE = "handles";

export async function saveHandles(data: DirectoryHandle, install?: DirectoryHandle): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  store.put(data, "data");
  if (install) store.put(install, "install");
  await transactionDone(tx);
}

export async function restoreHandles(): Promise<{ data?: DirectoryHandle; install?: DirectoryHandle }> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const [data, install] = await Promise.all([request(store.get("data")), request(store.get("install"))]);
  return { data, install };
}

export async function getCacheDirectory(): Promise<DirectoryHandle> {
  return navigator.storage.getDirectory();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function request<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}
