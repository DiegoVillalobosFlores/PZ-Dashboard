import { useLocalStorage } from '@mantine/hooks';

// Mantine's hook syncs every subscriber in the tab, so the Settings screen and
// the map read the same value without a provider.
export function useFogOfWar() {
  return useLocalStorage({
    key: 'pz-dashboard.fogOfWar',
    defaultValue: true,
    getInitialValueInEffect: false,
  });
}

export function useShowTraits() {
  return useLocalStorage({
    key: 'pz-dashboard.showTraits',
    defaultValue: true,
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
