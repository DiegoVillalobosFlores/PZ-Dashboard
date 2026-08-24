import type { TraitSnapshot } from './liveTypes';

export type TraitEffect =
  | { kind: 'boost'; perk: string; level: number }
  | { kind: 'modifier'; text: string }
  | { kind: 'description'; text: string };

export interface TraitSummaryEffect {
  source: string;
  value: string;
  category: 'combat' | 'other';
}

const COMBAT_PERKS = new Set([
  'axe',
  'blunt',
  'smallblunt',
  'longblade',
  'smallblade',
  'spear',
  'maintenance',
  'aiming',
  'reloading',
]);

const COMBAT_MODIFIERS = [
  'grapple effectiveness',
  'panic gain',
  'panic after gain',
  'aiming delay',
  'weapon unjam time',
  'weapon sight range',
  'critical hit chance',
  'melee damage dealt',
  'melee knockback',
  'combat xp gain',
  'zombie injury protection',
];

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

export function formatTraitEffect(effect: TraitEffect): string {
  return effect.kind === 'boost' ? `${effect.perk} ${signedLevel(effect.level)}` : effect.text;
}

function summaryCategory(effect: TraitEffect): TraitSummaryEffect['category'] {
  if (effect.kind === 'boost') {
    const perk = effect.perk.toLowerCase().replace(/[^a-z]/g, '');
    return COMBAT_PERKS.has(perk) ? 'combat' : 'other';
  }
  if (effect.kind !== 'modifier') return 'other';
  const text = effect.text.toLowerCase();
  return COMBAT_MODIFIERS.some((label) => text.startsWith(`${label} `)) ? 'combat' : 'other';
}

export function summarizeTraitEffects(traits: TraitSnapshot[] | undefined): TraitSummaryEffect[] {
  return sortTraits(traits).flatMap((trait) => {
    const source = trait.label || trait.id || 'Unknown trait';
    return traitEffects(trait).map((effect) => ({
      source,
      value: formatTraitEffect(effect),
      category: summaryCategory(effect),
    }));
  });
}

export function signedLevel(level: number): string {
  return level >= 0 ? `+${level}` : `${level}`;
}
