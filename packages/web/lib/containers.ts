import type { ContainerKind, ContainerSnapshot, ContainersSnapshot } from './liveTypes';

const KIND_ICONS: Record<ContainerKind, string> = {
  player: 'person-standing',
  bag: 'backpack',
  vehicle: 'car',
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

export const ALL_TYPE = 'all';

export function allContainer(
  containers: ContainerSnapshot[],
  id: string,
  name: string,
): ContainerSnapshot | null {
  const [first] = containers;
  if (!first || containers.length < 2) return null;
  return {
    id,
    kind: first.kind,
    name,
    type: ALL_TYPE,
    icon: '',
    x: first.x,
    y: first.y,
    z: first.z,
    locked: false,
    weight: containers.reduce((total, container) => total + container.weight, 0),
    capacity: -1,
    items: containers.flatMap((container) => container.items),
  };
}

export function itemWeightColor(weight: number): string {
  if (weight < 0.8) return 'var(--color-success)';
  if (weight <= 2) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function capacityColor(weight: number, capacity: number): string {
  if (capacity <= 0) return 'var(--color-text-tertiary)';
  const fill = weight / capacity;
  if (fill < 0.5) return 'var(--color-success)';
  if (fill < 0.9) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function selectionWeight(container: ContainerSnapshot | null, ids: number[]): number {
  if (!container) return 0;
  const wanted = new Set(ids);
  return container.items.reduce((total, item) => (wanted.has(item.id) ? total + item.weight : total), 0);
}
