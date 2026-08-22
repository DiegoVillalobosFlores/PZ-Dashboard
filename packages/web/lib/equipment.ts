// The dashboard shows equipped items in three places — the numbered hotbar
// tray, the primary/secondary hand widget, and the worn-clothing paperdoll.
// They used to be three components with three unrelated data shapes (and
// three ideas of what "equipped" meant); this module is the single model all
// of them share, so a change to how a slot looks or reads happens once.
//
// The two flags are deliberately orthogonal, and they're what every tile's
// appearance keys off:
//   filled — there's an item in this slot (draws the corner brackets)
//   active — that item is in the player's hands right now (highlight fill)
// A hand slot with an item is both. A worn coat is filled but not active. An
// empty slot is neither.

import type {
  ContainerItemSnapshot,
  ContainerSnapshot,
  EquippedItemSnapshot,
  EquipmentSnapshot,
  ToolbarSnapshot,
} from './liveTypes';
import { iconForItem } from './itemIcon';

export type ItemCondition = 'Good condition' | 'Worn' | 'Damaged';

export interface EquipSlotState {
  // Stable per slot, not per item: 'primary', 'head', 'hotbar-2'. Used as
  // the React key and to route a click back to the right equip action.
  id: string;
  // Slot caption ('Primary', 'Head'). The hotbar shows `badge` instead.
  label: string;
  badge?: string;
  itemName?: string;
  // PZ's fully-qualified type ('Base.Axe'), needed to act on the item.
  itemType?: string;
  icon: string; // lucide fallback, used when there's no sprite or it 404s
  spriteIcon?: string; // real in-game sprite name from the mod
  condition?: ItemCondition;
  conditionRatio?: number;
  ammo?: string; // "5/6", firearms only
  filled: boolean;
  active: boolean;
}

export function conditionColor(condition?: ItemCondition): string {
  if (condition === 'Worn') return 'var(--color-warning)';
  if (condition === 'Damaged') return 'var(--color-danger)';
  return 'var(--color-success)';
}

// PZ reports condition on a per-item scale (a knife maxes at 10, a shirt at
// 40), so the thirds below are of the item's own max rather than absolute.
export function conditionFrom(condition: number, conditionMax: number): ItemCondition | undefined {
  const ratio = conditionRatioFrom(condition, conditionMax);
  if (ratio === undefined) return undefined;
  if (ratio >= 0.66) return 'Good condition';
  if (ratio >= 0.33) return 'Worn';
  return 'Damaged';
}

export function conditionRatioFrom(condition: number, conditionMax: number): number | undefined {
  if (conditionMax <= 0 || condition < 0) return undefined;
  return Math.min(condition / conditionMax, 1);
}

function ammoLabel(item: EquippedItemSnapshot): string | undefined {
  if (item.ammo === undefined || item.ammoMax === undefined) return undefined;
  return `${item.ammo}/${item.ammoMax}`;
}

export function slotFromItem(
  id: string,
  label: string,
  item: EquippedItemSnapshot | null | undefined,
  { active = false, badge }: { active?: boolean; badge?: string } = {},
): EquipSlotState {
  if (!item) {
    return { id, label, badge, icon: 'box', filled: false, active: false };
  }
  return {
    id,
    label,
    badge,
    itemName: item.name,
    itemType: item.type,
    icon: iconForItem(item.name, item.type),
    spriteIcon: item.icon || undefined,
    condition: conditionFrom(item.condition, item.conditionMax),
    conditionRatio: conditionRatioFrom(item.condition, item.conditionMax),
    ammo: ammoLabel(item),
    filled: true,
    active,
  };
}

// ---------------------------------------------------------------------------
// Paperdoll slots
// ---------------------------------------------------------------------------

export type PaperdollSlotId = 'head' | 'torso' | 'hands' | 'face' | 'back' | 'belt' | 'holster' | 'wrist' | 'legs' | 'feet';

// PZ has ~110 body locations and the paperdoll has seven boxes, so each box
// claims a list of them. Order within a list is priority: the first location
// the player is actually wearing something in wins the box, which is why the
// outer layers (jacket, full-body suits) come before the base ones — a
// paperdoll showing "T-Shirt" while the character is visibly in a raincoat
// would be reporting the wrong thing.
export const PAPERDOLL_SLOTS: {
  id: PaperdollSlotId;
  label: string;
  icon: string;
  locations: string[];
}[] = [
  {
    id: 'head',
    label: 'Head',
    icon: 'hard-hat',
    locations: ['FullHat', 'FullSuitHead', 'FullSuitHeadSCBA', 'Hat', 'SweaterHat', 'JacketHat', 'JacketHatBulky'],
  },
  {
    id: 'torso',
    label: 'Torso',
    icon: 'shirt',
    locations: [
      'FullSuit',
      'BoilerSuit',
      'FullTop',
      'Dress',
      'LongDress',
      'BathRobe',
      'FullRobe',
      'JacketBulky',
      'Jacket',
      'JacketDown',
      'JacketSuit',
      'Sweater',
      'Cuirass',
      'TorsoExtraVestBullet',
      'TorsoExtraVest',
      'TorsoExtra',
      'Shirt',
      'ShortSleeveShirt',
      'Jersey',
      'Tshirt',
      'TankTop',
      'UnderwearTop',
    ],
  },
  { id: 'hands', label: 'Hands', icon: 'hand', locations: ['Hands', 'HandsLeft', 'HandsRight'] },
  {
    id: 'face',
    label: 'Face',
    icon: 'glasses',
    locations: ['MaskFull', 'MaskEyes', 'Mask', 'Eyes', 'Scarf', 'Neck'],
  },
  { id: 'back', label: 'Back', icon: 'backpack', locations: ['Back', 'Satchel', 'FannyPackBack', 'FannyPackFront'] },
  {
    id: 'belt',
    label: 'Belt',
    icon: 'circle-dot',
    locations: ['Belt', 'BeltExtra'],
  },
  {
    id: 'holster',
    label: 'Holster',
    icon: 'shield',
    locations: ['Holster', 'HolsterLeft', 'HolsterRight', 'ShoulderHolster'],
  },
  {
    id: 'wrist',
    label: 'Wrist',
    icon: 'watch',
    locations: ['LeftWrist', 'RightWrist'],
  },
  {
    id: 'legs',
    label: 'Legs',
    icon: 'layers',
    locations: ['Pants', 'PantsSkinny', 'ShortPants', 'ShortsShort', 'LongSkirt', 'Skirt', 'Legs1', 'UnderwearBottom'],
  },
  { id: 'feet', label: 'Feet', icon: 'footprints', locations: ['Shoes', 'Socks'] },
];

	// PZ's location strings aren't consistently cased across item scripts
	// ("Tshirt" vs "TShirt", "SweaterHat" vs "Sweaterhat"), and a miss here
	// silently empties a paperdoll box, so match case-insensitively.
	// Build 42 prefixes locations with "base:" (e.g. "base:shoes").
	const normalize = (location?: string | null) => (location ?? '').replace(/^[a-z]+:/i, '').toLowerCase();

export function paperdollSlotFor(location?: string | null): PaperdollSlotId | undefined {
  if (!location) return undefined;
  const wanted = normalize(location);
  return PAPERDOLL_SLOTS.find((slot) => slot.locations.some((l) => normalize(l) === wanted))?.id;
}

// ---------------------------------------------------------------------------
// Live snapshot → slots
// ---------------------------------------------------------------------------

// The hands, in the order the HUD shows them. Shared by the hand widget and
// the hotbar so both agree on which item is where.
export function handSlots(toolbar: ToolbarSnapshot | null): [EquipSlotState, EquipSlotState] {
  return [
    slotFromItem('primary', 'Primary', toolbar?.primary, { active: !!toolbar?.primary }),
    slotFromItem('secondary', 'Secondary', toolbar?.secondary, { active: !!toolbar?.secondary }),
  ];
}

// The numbered tray: what's in hand first, then whatever is attached to the
// player's hotbar slots (belt, holster, ...). Hand items are marked active,
// attachments aren't — that's the distinction the tray is there to show.
function hotbarSlots(toolbar: ToolbarSnapshot | null): EquipSlotState[] {
  if (!toolbar) return [];
  const slots: EquipSlotState[] = [];
  const push = (item: EquippedItemSnapshot, label: string, active: boolean) => {
    const key = slots.length + 1;
    slots.push(slotFromItem(`hotbar-${key}`, label, item, { active, badge: String(key) }));
  };

  if (toolbar.primary) push(toolbar.primary, 'Primary', true);
  if (toolbar.secondary) push(toolbar.secondary, 'Secondary', true);
  for (const attached of toolbar.attached) push(attached, attached.location ?? 'Attached', false);

  return slots;
}

export type HotbarGroupId = 'hands' | 'belt' | 'holster' | 'back' | 'webbing' | 'other';

export interface HotbarGroup {
  id: HotbarGroupId;
  label: string;
  slots: EquipSlotState[];
}

const HOTBAR_GROUPS: { id: HotbarGroupId; label: string; keyword?: string }[] = [
  { id: 'hands', label: 'Hands' },
  { id: 'belt', label: 'Belt', keyword: 'belt' },
  { id: 'holster', label: 'Holster', keyword: 'holster' },
  { id: 'back', label: 'Back', keyword: 'back' },
  { id: 'webbing', label: 'Webbing', keyword: 'webbing' },
  { id: 'other', label: 'Other' },
];

function hotbarGroupFor(slot: EquipSlotState): HotbarGroupId {
  if (slot.active) return 'hands';
  const location = slot.label.toLowerCase().replace(/[^a-z]/g, '');
  if (location.includes('bag') || location.includes('bedroll')) return 'back';
  return HOTBAR_GROUPS.find((group) => group.keyword && location.includes(group.keyword))?.id ?? 'other';
}

export function hotbarGroups(toolbar: ToolbarSnapshot | null): HotbarGroup[] {
  const byGroup = new Map<HotbarGroupId, EquipSlotState[]>();
  for (const slot of hotbarSlots(toolbar)) {
    const id = hotbarGroupFor(slot);
    const existing = byGroup.get(id);
    if (existing) existing.push(slot);
    else byGroup.set(id, [slot]);
  }

  return HOTBAR_GROUPS.flatMap(({ id, label }) => {
    const slots = byGroup.get(id);
    return slots?.length ? [{ id, label, slots }] : [];
  });
}

// All seven paperdoll boxes, always — an empty slot is a meaningful readout
// ("no shoes on"), so unworn locations come back as empty tiles rather than
// being dropped.
export function paperdollSlots(equipment: EquipmentSnapshot | null): EquipSlotState[] {
  return PAPERDOLL_SLOTS.map((slot) => {
    const worn = equipment?.worn ?? [];
    const item = slot.locations
      .map((location) => worn.find((w) => normalize(w.location ?? '') === normalize(location)))
      .find(Boolean);
    const state = slotFromItem(slot.id, slot.label, item);
    // Keep the slot's own silhouette icon when it's empty, so an unworn box
    // still reads as "this is the feet slot" rather than a generic box.
    return state.filled ? state : { ...state, icon: slot.icon };
  });
}

// ---------------------------------------------------------------------------
// Candidates for a slot
// ---------------------------------------------------------------------------

// What the selection drawer offers for a slot. Keyed by PZ's fully-qualified
// item type, which is also what the equip commands take.
export interface SelectableItem {
  type: string;
  name: string;
  icon: string;
  spriteIcon?: string;
  condition?: ItemCondition;
  displayCategory?: string;
  categoryLabel?: string;
  equipped: boolean;
}

function toSelectable(item: ContainerItemSnapshot, equippedType?: string): SelectableItem {
  return {
    type: item.type,
    name: item.name,
    icon: iconForItem(item.name, item.type),
    spriteIcon: item.icon || undefined,
    condition: conditionFrom(item.condition, item.conditionMax),
    displayCategory: item.displayCategory,
    categoryLabel: item.categoryLabel,
    equipped: item.type === equippedType,
  };
}

// A stack of five identical bandages is five inventory rows but one choice,
// so collapse by type — the drawer is for picking *what* to equip.
function dedupeByType(items: ContainerItemSnapshot[]): ContainerItemSnapshot[] {
  const byType = new Map<string, ContainerItemSnapshot>();
  for (const item of items) {
    // Keep the best-conditioned of a duplicate set: equipping the axe that's
    // about to break when a fresh one is in the bag is never the intent.
    const existing = byType.get(item.type);
    if (!existing || item.condition > existing.condition) byType.set(item.type, item);
  }
  return [...byType.values()];
}

// Anything that isn't clothing can go in a hand — tools, weapons, a lit
// candle, a bag of nails — so this filters out only what PZ would refuse.
export function handCandidates(
  inventory: ContainerSnapshot | null,
  equippedType?: string,
): SelectableItem[] {
  const items = (inventory?.items ?? []).filter((item) => item.category !== 'Clothing');
  return dedupeByType(items).map((item) => toSelectable(item, equippedType));
}

// Clothing whose own body location belongs to this paperdoll slot, so the
// Head drawer offers hats rather than the whole wardrobe.
export function wearCandidates(
  inventory: ContainerSnapshot | null,
  slotId: PaperdollSlotId,
  equippedType?: string,
): SelectableItem[] {
  const items = (inventory?.items ?? []).filter(
    (item) => !!item.bodyLocation && paperdollSlotFor(item.bodyLocation) === slotId,
  );
  return dedupeByType(items).map((item) => toSelectable(item, equippedType));
}
