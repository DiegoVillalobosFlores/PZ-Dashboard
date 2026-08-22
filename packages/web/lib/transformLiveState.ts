import type { Vitals, Conditions } from '../mock/gameState';
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

// The mod reports raw need-stats and conditions. Conditions are status effects
// (stress, panic, pain, infected, bleeding) — higher is always worse, so no
// inversion needed. Boredom is included but typically shown as a mild status.
export function statusToConditions(status: StatusSnapshot): Conditions {
  return {
    stress: pct(status.stress),
    panic: pct(status.panic),
    panicResistance: status.panicResistance ?? 1,
    boredom: pct(status.boredom),
    pain: pct(status.pain),
    infected: status.infected,
    bleeding: status.bleeding,
  };
}

// Equipped items — hands, hotbar and worn clothing — are transformed in
// lib/equipment.ts, which owns the slot model all three share.
