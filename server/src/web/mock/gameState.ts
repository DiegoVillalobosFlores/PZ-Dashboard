export interface Vitals {
  health: number;
  hunger: number;
  thirst: number;
  fatigue: number;
  stamina: number;
}

export interface MapPin {
  id: string;
  xPct: number;
  yPct: number;
  kind: 'player' | 'zombie' | 'poi';
}

// Equipped items (hands, hotbar, worn clothing) are live from the mod and
// modelled in lib/equipment.ts — there are no mock fixtures for them any
// more, since a HUD showing a Fire Axe the player doesn't own is worse than
// one showing an empty slot.

export const mockVitals: Vitals = {
  health: 88,
  hunger: 64,
  thirst: 71,
  fatigue: 40,
  stamina: 78,
};

export const mockMapPins: MapPin[] = [
  { id: 'player', xPct: 50, yPct: 45, kind: 'player' },
  { id: 'z1', xPct: 78, yPct: 60, kind: 'zombie' },
  { id: 'z2', xPct: 40, yPct: 70, kind: 'zombie' },
  { id: 'poi1', xPct: 85, yPct: 30, kind: 'poi' },
  { id: 'z3', xPct: 60, yPct: 88, kind: 'zombie' },
  { id: 'z4', xPct: 30, yPct: 20, kind: 'zombie' },
];

// Skills are live from the mod and modelled in lib/skills.ts — like equipped
// items, there are no mock fixtures for them any more.
