import { expect, test } from 'bun:test';
import type { TraitSnapshot } from './liveTypes';
import { signedLevel, sortTraits, summarizeTraitEffects, traitEffects } from './traits';

function trait(overrides: Partial<TraitSnapshot> = {}): TraitSnapshot {
  return {
    id: 'trait',
    label: 'Trait',
    description: 'Trait description',
    cost: 0,
    profession: false,
    icon: '',
    xpBoosts: [],
    modifiers: [],
    ...overrides,
  };
}

test('returns boost effects with signed levels', () => {
  expect(
    traitEffects(
      trait({
        xpBoosts: [
          { perk: 'Axe', perkName: 'Axe', level: 2 },
          { perk: 'Fitness', perkName: 'Fitness', level: -1 },
        ],
      }),
    ),
  ).toEqual([
    { kind: 'boost', perk: 'Axe', level: 2 },
    { kind: 'boost', perk: 'Fitness', level: -1 },
  ]);
  expect(signedLevel(2)).toBe('+2');
  expect(signedLevel(-1)).toBe('-1');
});

test('returns description when no boosts exist', () => {
  expect(traitEffects(trait({ description: 'First line of effect' }))).toEqual([
    { kind: 'description', text: 'First line of effect' },
  ]);
});

test('returns game modifiers before boost effects', () => {
  expect(
    traitEffects(
      trait({
        modifiers: [{ label: 'Panic gain', value: '+100%' }],
        xpBoosts: [{ perk: 'Fitness', perkName: 'Fitness', level: 4 }],
      }),
    ),
  ).toEqual([
    { kind: 'modifier', text: 'Panic gain +100%' },
    { kind: 'boost', perk: 'Fitness', level: 4 },
  ]);
});

test('summarizes every trait effect with its source', () => {
  expect(
    summarizeTraitEffects([
      trait({
        label: 'Brave',
        modifiers: [{ label: 'Panic gain', value: '-70%' }],
        xpBoosts: [{ perk: 'Axe', perkName: 'Axe', level: 2 }],
      }),
    ]),
  ).toEqual([
    { source: 'Brave', value: 'Panic gain -70%', category: 'combat' },
    { source: 'Brave', value: 'Axe +2', category: 'combat' },
  ]);
});

test('sorts positive costs first and labels ties', () => {
  const sorted = sortTraits([
    trait({ id: 'bad', label: 'Zed', cost: -4 }),
    trait({ id: 'good-b', label: 'Bravo', cost: 2 }),
    trait({ id: 'good-a', label: 'Alpha', cost: 2 }),
    trait({ id: 'free', label: 'Free', cost: 0 }),
  ]);

  expect(sorted.map(({ id }) => id)).toEqual(['good-a', 'good-b', 'free', 'bad']);
});
