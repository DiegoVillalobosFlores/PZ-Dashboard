import type { GameFiles } from "../../packages/core";

export type DirectoryHandle = FileSystemDirectoryHandle;

async function file(handle: DirectoryHandle, path: string, create = false) {
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error("Invalid path");
  let current = handle;
  for (const part of parts) current = await current.getDirectoryHandle(part, { create });
  return current.getFileHandle(name, { create });
}

export function makeBrowserFiles(data: DirectoryHandle, install: DirectoryHandle): GameFiles {
  return {
    async read(path) {
      const handle = await file(install, path);
      return new Uint8Array(await (await handle.getFile()).arrayBuffer());
    },
    async list(path) {
      const handle = path ? await data.getDirectoryHandle(path) : data;
      const names: string[] = [];
      for await (const [name] of handle.entries()) names.push(name);
      return names;
    },
    async stat(path) {
      try {
        const entry = await file(data, path);
        return { mtimeMs: (await (await entry.getFile()).lastModified) };
      } catch { return null; }
    },
    async write(path, content) {
      const handle = await file(data, path, true);
      const writer = await handle.createWritable();
      await writer.write(content);
      await writer.close();
    },
  };
}

const DB = "pz-dashboard";
const STORE = "handles";

export async function saveHandles(data: DirectoryHandle, install?: DirectoryHandle) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(data, "data");
  if (install) tx.objectStore(STORE).put(install, "install");
  await transactionDone(tx);
}

export async function restoreHandles(): Promise<{ data?: DirectoryHandle; install?: DirectoryHandle }> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const [data, install] = await Promise.all([request(store.get("data")), request(store.get("install"))]);
  return { data, install };
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
  });
}
