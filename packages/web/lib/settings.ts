import { useLocalStorage } from '@mantine/hooks';

export const DEFAULT_FOG_OF_WAR = true;
export const DEFAULT_SHOW_TRAITS = true;
export const DEFAULT_SHOW_SUMMARY = true;
export const DEFAULT_AUTO_ZOOM_ON_SPEED = false;
export const DEFAULT_AUTO_ROTATE = true;

// Mantine's hook syncs every subscriber in the tab, so the Settings screen and
// the map read the same value without a provider.
export function useFogOfWar() {
  return useLocalStorage({
    key: 'pz-dashboard.fogOfWar',
    defaultValue: DEFAULT_FOG_OF_WAR,
    getInitialValueInEffect: false,
  });
}

export function useShowTraits() {
  return useLocalStorage({
    key: 'pz-dashboard.showTraits',
    defaultValue: DEFAULT_SHOW_TRAITS,
    getInitialValueInEffect: false,
  });
}

export function useShowSummary() {
  return useLocalStorage({
    key: 'pz-dashboard.showSummary',
    defaultValue: DEFAULT_SHOW_SUMMARY,
    getInitialValueInEffect: false,
  });
}

export interface ClusterStatSettings {
  health: boolean;
  hunger: boolean;
  thirst: boolean;
  fatigue: boolean;
  stamina: boolean;
  stress: boolean;
  panic: boolean;
  pain: boolean;
  boredom: boolean;
  infected: boolean;
  bleeding: boolean;
}

export interface ConditionClusterSettings extends ClusterStatSettings {
  showCluster: boolean;
}

export const DEFAULT_CLUSTER_SETTINGS: ConditionClusterSettings = {
  showCluster: true,
  health: true,
  hunger: true,
  thirst: true,
  fatigue: true,
  stamina: true,
  stress: true,
  panic: true,
  pain: true,
  boredom: true,
  infected: true,
  bleeding: true,
};

export function useConditionClusterSettings() {
  return useLocalStorage<ConditionClusterSettings>({
    key: 'pz-dashboard.conditionCluster',
    defaultValue: DEFAULT_CLUSTER_SETTINGS,
    getInitialValueInEffect: false,
  });
}

export function useAutoZoomOnSpeed() {
  return useLocalStorage({
    key: 'pz-dashboard.autoZoomOnSpeed',
    defaultValue: DEFAULT_AUTO_ZOOM_ON_SPEED,
    getInitialValueInEffect: false,
  });
}

export function useAutoRotate() {
  return useLocalStorage({
    key: 'pz-dashboard.autoRotate',
    defaultValue: DEFAULT_AUTO_ROTATE,
    getInitialValueInEffect: false,
  });
}

export function settingMatchesFilter(title: string, hint: string | undefined, filter: string): boolean {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) return true;
  return `${title} ${hint ?? ''}`.toLowerCase().includes(normalizedFilter);
}
