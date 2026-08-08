// Shapes as written by the PZ mod's collectors (mod/PZDashboard/.../PZDashboard_Collectors.lua).
// Numeric need-stats (hunger/thirst/fatigue/...) are the game's raw 0-1
// scale where higher = worse (more hungry, more tired); `endurance` is the
// odd one out where higher = better (more stamina left).

export interface StatusSnapshot {
  forename: string;
  surname: string;
  displayName: string;
  health: number; // 0-100, higher = better
  hunger: number; // 0-1, higher = more hungry
  thirst: number; // 0-1, higher = more thirsty
  fatigue: number; // 0-1, higher = more tired
  endurance: number; // 0-1, higher = more stamina
  stress: number;
  panic: number;
  boredom: number;
  pain: number;
  infected: boolean;
  bleeding: boolean;
}

export interface InventoryItemSnapshot {
  name: string;
  type: string;
  count: number;
  condition: number; // raw, only meaningful against conditionMax
  conditionMax: number;
  weight: number;
  icon: string;
  category: string; // "Weapon" | "Clothing" | "Item" | ... (PZ's own item categories)
  displayCategory: string;
  categoryLabel: string;
  bodyLocation: string; // ItemBodyLocation this would occupy if worn; "" for non-clothing
}

export interface InventorySnapshot {
  weight: number;
  capacity: number;
  items: InventoryItemSnapshot[];
}

// One shape for every equipped item, whichever slot holds it — see
// itemSnapshot() in the mod's PZDashboard_Collectors.lua. `location` is only
// set for items that live in a named slot (hotbar attachments, worn
// clothing), not for hand items.
export interface EquippedItemSnapshot {
  name: string;
  type: string;
  icon: string;
  condition: number; // raw, only meaningful against conditionMax
  conditionMax: number;
  ammo?: number; // firearms only
  ammoMax?: number;
  location?: string;
}

export interface ToolbarSnapshot {
  primary?: EquippedItemSnapshot | null;
  secondary?: EquippedItemSnapshot | null;
  attached: EquippedItemSnapshot[];
}

export interface EquipmentSnapshot {
  worn: EquippedItemSnapshot[];
}

export interface SkillPerkSnapshot {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  passive: boolean;
  level: number;
  xp: number;
  xpLevelStart: number;
  xpLevelEnd: number;
}

export interface SkillsSnapshot {
  perks: SkillPerkSnapshot[];
}

export interface NearbyContainerItemSnapshot {
  name: string;
  type: string;
  count: number;
  condition: number;
  weight: number;
  displayCategory: string;
  categoryLabel: string;
}

export interface NearbyContainerSnapshot {
  kind: 'object' | 'deadBody' | 'floorBag';
  type: string;
  name: string;
  x: number;
  y: number;
  z: number;
  locked: boolean;
  weight: number;
  capacity: number;
  items: NearbyContainerItemSnapshot[];
}

export interface NearbyContainerCombinedItemSnapshot {
  type: string;
  name: string;
  count: number;
  weight: number;
  displayCategory: string;
  categoryLabel: string;
}

export interface NearbyContainersSnapshot {
  containers: NearbyContainerSnapshot[];
  combined: NearbyContainerCombinedItemSnapshot[];
}

export interface ManifestEntry {
  enabled: boolean;
  updatedAtMs?: number;
}

export type ManifestSnapshot = Record<string, ManifestEntry>;

export interface CommandResultSnapshot {
  id: string;
  ok: boolean;
  error?: string;
}

export interface MapSnapshot {
  x: number;
  y: number;
  z: number;
  safehouse: boolean;
  inVehicle: boolean;
}

// Only the player's own hand-placed map markers/notes (mod filters out the
// map's built-in default annotations via symbol:isUserDefined()) - see
// mod/PZDashboard/.../PZDashboard_Collectors.lua's annotations() collector.
export interface AnnotationMarkerSnapshot {
  x: number;
  y: number;
  isText: boolean;
  text?: string;
  symbolId?: string;
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  rotation: number; // degrees
  author: string;
}

export interface AnnotationsSnapshot {
  markers: AnnotationMarkerSnapshot[];
}

// The mod reports appearance as ids rather than file paths; the server turns
// them into a mesh/texture draw list at /api/model/figure, so the only thing
// the frontend does with this snapshot is notice that it changed.
export interface AppearanceWornSnapshot {
  clothingItem: string;
  name: string;
  location: string;
  hasModel: boolean;
  textureChoice: number;
  baseTexture: number;
  tint?: { r: number; g: number; b: number };
}

export interface AppearanceSnapshot {
  female: boolean;
  skinTexture?: string;
  skinTextureIndex?: number;
  hairModel?: string;
  beardModel?: string;
  hairColor?: { r: number; g: number; b: number };
  beardColor?: { r: number; g: number; b: number };
  worn: AppearanceWornSnapshot[];
}

export interface CategoryMap {
  appearance: AppearanceSnapshot;
  status: StatusSnapshot;
  inventory: InventorySnapshot;
  nearbyContainers: NearbyContainersSnapshot;
  toolbar: ToolbarSnapshot;
  equipment: EquipmentSnapshot;
  skills: SkillsSnapshot;
  manifest: ManifestSnapshot;
  commandResult: CommandResultSnapshot;
  map: MapSnapshot;
  annotations: AnnotationsSnapshot;
}
