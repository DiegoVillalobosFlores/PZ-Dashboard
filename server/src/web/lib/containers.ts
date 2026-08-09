import type { ContainerKind, ContainerSnapshot, ContainersSnapshot } from './liveTypes';

const KIND_ICONS: Record<ContainerKind, string> = {
  player: 'person-standing',
  bag: 'backpack',
  object: 'archive',
  deadBody: 'skull',
  floorBag: 'backpack',
  floor: 'footprints',
};

export function containerIcon(kind: ContainerKind): string {
  return KIND_ICONS[kind] ?? 'box';
}

export function playerContainer(snapshot: ContainersSnapshot | null | undefined): ContainerSnapshot | null {
  return snapshot?.containers.find((container) => container.kind === 'player') ?? null;
}

export function containerById(
  snapshot: ContainersSnapshot | null | undefined,
  id: string | null | undefined,
): ContainerSnapshot | null {
  if (!id) return null;
  return snapshot?.containers.find((container) => container.id === id) ?? null;
}

export function selectionWeight(container: ContainerSnapshot | null, ids: number[]): number {
  if (!container) return 0;
  const wanted = new Set(ids);
  return container.items.reduce((total, item) => (wanted.has(item.id) ? total + item.weight : total), 0);
}
