import type { SkillPerkSnapshot, SkillsSnapshot } from './liveTypes';

export const MAX_SKILL_LEVEL = 10;

export interface SkillState {
  id: string;
  name: string;
  icon: string;
  level: number;
  progress: number;
}

export interface SkillCategoryState {
  id: string;
  label: string;
  icon: string;
  skills: SkillState[];
}

const SKILL_ICONS: Record<string, string> = {
  Axe: 'axe',
  Blunt: 'club',
  SmallBlunt: 'hammer',
  LongBlade: 'sword',
  SmallBlade: 'swords',
  Spear: 'slash',
  Maintenance: 'wrench',
  Aiming: 'target',
  Reloading: 'crosshair',
  Woodwork: 'construction',
  Carving: 'slice',
  Cooking: 'cooking-pot',
  Electricity: 'zap',
  Doctor: 'stethoscope',
  Glassmaking: 'flask-conical',
  FlintKnapping: 'gem',
  Masonry: 'brick-wall',
  Blacksmith: 'anvil',
  Mechanics: 'cog',
  Pottery: 'amphora',
  Tailoring: 'scissors',
  MetalWelding: 'flame',
  Fishing: 'fish',
  PlantScavenging: 'leaf',
  Tracking: 'paw-print',
  Trapping: 'trees',
  Fitness: 'dumbbell',
  Strength: 'hand',
  Lightfoot: 'feather',
  Nimble: 'wind',
  Sprinting: 'footprints',
  Sneak: 'eye-off',
  Farming: 'wheat',
  Husbandry: 'rabbit',
  Butchering: 'beef',
};

const CATEGORY_ICONS: Record<string, string> = {
  Combat: 'swords',
  Firearm: 'crosshair',
  Crafting: 'hammer',
  Survivalist: 'tent',
  PhysicalCategory: 'dumbbell',
  Agility: 'footprints',
  FarmingCategory: 'wheat',
};

const FALLBACK_CATEGORY_ICON = 'circle-dot';

function progressThroughLevel(perk: SkillPerkSnapshot): number {
  if (perk.passive || perk.level >= MAX_SKILL_LEVEL) return 0;
  const span = perk.xpLevelEnd - perk.xpLevelStart;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (perk.xp - perk.xpLevelStart) / span));
}

export function perksToCategories(skills: SkillsSnapshot | undefined): SkillCategoryState[] {
  const categories: SkillCategoryState[] = [];
  const byId = new Map<string, SkillCategoryState>();

  for (const perk of skills?.perks ?? []) {
    if (!perk.category) continue;
    let category = byId.get(perk.category);
    if (!category) {
      category = {
        id: perk.category,
        label: perk.categoryName || perk.category,
        icon: CATEGORY_ICONS[perk.category] ?? FALLBACK_CATEGORY_ICON,
        skills: [],
      };
      byId.set(perk.category, category);
      categories.push(category);
    }
    category.skills.push({
      id: perk.id,
      name: perk.name,
      icon: SKILL_ICONS[perk.id] ?? category.icon,
      level: perk.level,
      progress: progressThroughLevel(perk),
    });
  }

  return categories;
}
