import type { Vitals } from '../mock/gameState';
import type { StatusSnapshot } from './liveTypes';

const pct = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100);

// The mod reports raw need-stats (0-1, higher = worse). The HUD reads as
// "how full/rested/energized am I" (higher = better), so invert the ones
// where the game's scale runs the opposite way.
export function statusToVitals(status: StatusSnapshot): Vitals {
  return {
    health: Math.round(status.health),
    hunger: pct(1 - status.hunger),
    thirst: pct(1 - status.thirst),
    fatigue: pct(1 - status.fatigue),
    stamina: pct(status.endurance),
  };
}

// Equipped items — hands, hotbar and worn clothing — are transformed in
// lib/equipment.ts, which owns the slot model all three share.
