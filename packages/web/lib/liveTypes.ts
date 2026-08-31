
export interface StatusSnapshot {
  forename: string;
  surname: string;
  displayName: string;
  health: number;
  hunger: number;
  thirst: number;
  fatigue: number;
  endurance: number;
  stress: number;
  panic: number;
  hoursSurvived: number;
  panicResistance: number;
  boredom: number;
  pain: number;
  hour: number;
  minute: number;
  day: number;
  month: number;
  temperature: number;
  infected: boolean;
  bleeding: boolean;
}

export interface ContainerItemSnapshot {
  id: number;
  name: string;
  type: string;
  count: number;
  condition: number;
  conditionMax: number;
  weight: number;
  icon: string;
  category: string;
  displayCategory: string;
  categoryLabel: string;
  bodyLocation: string;
  equipped?: boolean;
}

export type ContainerKind = 'player' | 'bag' | 'vehicle' | 'object' | 'deadBody' | 'floorBag' | 'floor';

export interface ContainerSnapshot {
  id: string;
  kind: ContainerKind;
  name: string;
  type: string;
  icon: string;
  x: number;
  y: number;
  z: number;
  locked: boolean;
  weight: number;
  capacity: number;
  items: ContainerItemSnapshot[];
}

export interface ContainersSnapshot {
  containers: ContainerSnapshot[];
}

export interface EquippedItemSnapshot {
  name: string;
  type: string;
  icon: string;
  condition: number;
  conditionMax: number;
  ammo?: number;
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

export interface TraitXpBoostSnapshot {
  perk: string;
  perkName: string;
  level: number;
}

export interface TraitModifierSnapshot {
  label: string;
  value: string;
}

export interface TraitSnapshot {
  id: string;
  label: string;
  description: string;
  cost: number;
  profession: boolean;
  icon: string;
  xpBoosts: TraitXpBoostSnapshot[];
  modifiers: TraitModifierSnapshot[];
}

export interface TraitsSnapshot {
  traits: TraitSnapshot[];
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
  dirX?: number;
  dirY?: number;
  safehouse: boolean;
  inVehicle: boolean;
}
export interface VehicleSnapshot {
  id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  dirX?: number;
  dirY?: number;
  current: boolean;
  speedKmh?: number;
  gear?: string;
  engineRunning?: boolean;
  engineStarted?: boolean;
  keysInIgnition?: boolean;
  fuelPercent?: number;
  battery?: number;
  headlightsOn?: boolean;
  engineCondition?: number;
  worstPartCondition?: number;
  parts?: Partial<Record<VehiclePartKey, number>>;
  tires?: Partial<Record<VehicleCorner, VehicleTireSnapshot>>;
  cabinTemp?: number;
  heaterActive?: boolean;
  heaterSetting?: number;
}

export type VehiclePartKey =
  | 'engine'
  | 'hood'
  | 'gasTank'
  | 'battery'
  | 'muffler'
  | 'windshield'
  | 'brakes'
  | 'suspension'
  | 'doors';

export type VehicleCorner = 'FrontLeft' | 'FrontRight' | 'RearLeft' | 'RearRight';

export interface VehicleTireSnapshot {
  condition?: number;
  pressure?: number;
}

export interface VehiclesSnapshot {
  vehicles: VehicleSnapshot[];
}


export interface AnnotationMarkerSnapshot {
  x: number;
  y: number;
  isText: boolean;
  text?: string;
  symbolId?: string;
  r: number;
  g: number;
  b: number;
  rotation: number;
  author: string;
}

export interface AnnotationsSnapshot {
  markers: AnnotationMarkerSnapshot[];
}

export interface FogSnapshot {
  unitSquares: number;
  cellSquares: number;
  // "cellX,cellY" -> one hex byte per unit row inside the cell, bit i (value
  // 1 << i) set when that unit is on the player's in-game map.
  cells: Record<string, string>;
}

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
  containers: ContainersSnapshot;
  toolbar: ToolbarSnapshot;
  equipment: EquipmentSnapshot;
  skills: SkillsSnapshot;
  traits: TraitsSnapshot;
  manifest: ManifestSnapshot;
  commandResult: CommandResultSnapshot;
  map: MapSnapshot;
  fog: FogSnapshot;
  annotations: AnnotationsSnapshot;
  vehicles: VehiclesSnapshot;
}

export interface ConnectionSnapshot {
  connected: boolean;
  modConnected: boolean;
  updatedAt: number;
}
