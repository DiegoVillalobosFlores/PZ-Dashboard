import type { TraitSnapshot } from './liveTypes';

export type TraitEffect =
  | { kind: 'boost'; perk: string; level: number }
  | { kind: 'description'; text: string };

export function sortTraits(traits: TraitSnapshot[] | undefined): TraitSnapshot[] {
  return [...(traits ?? [])].sort((a, b) => b.cost - a.cost || a.label.localeCompare(b.label));
}

export function traitEffects(trait: TraitSnapshot): TraitEffect[] {
  if (trait.xpBoosts.length > 0) {
    return trait.xpBoosts.map((boost) => ({
      kind: 'boost' as const,
      perk: boost.perkName || boost.perk,
      level: boost.level,
    }));
  }
  return [{ kind: 'description', text: trait.description }];
}

export function signedLevel(level: number): string {
  return level >= 0 ? `+${level}` : `${level}`;
}
