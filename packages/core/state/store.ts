type CategorySnapshot = {
  data: unknown;
  updatedAt: number;
};

type UpdateListener = (id: string, snapshot: CategorySnapshot) => void;

const store = new Map<string, CategorySnapshot>();
const listeners = new Set<UpdateListener>();

export function setCategory(id: string, data: unknown, updatedAt: number) {
  const snapshot: CategorySnapshot = { data, updatedAt };
  store.set(id, snapshot);
  for (const listener of listeners) listener(id, snapshot);
}

export function getCategory(id: string) {
  return store.get(id);
}

export function getAllCategories() {
  return Object.fromEntries(store);
}

// Lets index.ts push live updates over WebSocket without store.ts needing
// to know about Bun.serve/the socket layer.
export function onCategoryUpdate(listener: UpdateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
