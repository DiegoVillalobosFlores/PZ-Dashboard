import type { TraitSnapshot } from './liveTypes';

export type TraitEffect =
  | { kind: 'boost'; perk: string; level: number }
  | { kind: 'modifier'; text: string }
  | { kind: 'description'; text: string };

export function sortTraits(traits: TraitSnapshot[] | undefined): TraitSnapshot[] {
  return [...(traits ?? [])].sort((a, b) => b.cost - a.cost || a.label.localeCompare(b.label));
}

export function traitEffects(trait: TraitSnapshot): TraitEffect[] {
  const modifiers = (trait.modifiers ?? []).map((modifier) => ({
    kind: 'modifier' as const,
    text: `${modifier.label} ${modifier.value}`,
  }));
  const boosts = trait.xpBoosts.map((boost) => ({
      kind: 'boost' as const,
      perk: boost.perkName || boost.perk,
      level: boost.level,
    }));
  if (modifiers.length > 0 || boosts.length > 0) return [...modifiers, ...boosts];
  return [{ kind: 'description', text: trait.description }];
}

export function signedLevel(level: number): string {
  return level >= 0 ? `+${level}` : `${level}`;
}
