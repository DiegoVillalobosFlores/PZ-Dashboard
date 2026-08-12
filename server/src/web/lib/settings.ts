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
