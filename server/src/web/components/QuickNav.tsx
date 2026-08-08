import { useNavigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import { Icon } from './Icon';

interface Destination {
  id: string;
  path: string;
  icon: string;
}

const DESTINATIONS: Destination[] = [
  { id: 'map', path: '/', icon: 'map-pin' },
  { id: 'inventory', path: '/inventory', icon: 'backpack' },
  { id: 'health', path: '/health', icon: 'heart' },
  { id: 'skills', path: '/skills', icon: 'dumbbell' },
];

// v9 "scanner HUD" nav: square tiles (radius2), not the earlier rounded rail.
// The tiles sit straight on the map with no panel behind them, so each one
// carries the frosted glass itself rather than the flat tile-chip background
// used inside the panels.
export function QuickNav({ currentId }: { currentId: string }) {
  const isWide = useMediaQuery('(min-width: 900px)');
  const navigate = useNavigate();

  const tile = (d: Destination, size: number, iconSize: number) => {
    const active = d.id === currentId;
    return (
      <button
        key={d.id}
        onClick={() => navigate(d.path)}
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? 'var(--color-accent)' : 'var(--color-glass-panel)',
          backdropFilter: 'var(--frost-blur)',
          opacity: active ? 0.85 : 1,
          border: 'none',
          borderRadius: 'var(--radius-sharp)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <Icon
          name={d.icon}
          size={iconSize}
          color={active ? '#ffffff' : 'var(--color-text-secondary)'}
          strokeWidth={active ? 2.5 : 2}
        />
      </button>
    );
  };

  if (isWide) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DESTINATIONS.map((d) => tile(d, 72, 28))}
      </div>
    );
  }

  return <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{DESTINATIONS.map((d) => tile(d, 44, 20))}</div>;
}

export function useCurrentDestinationId(): string {
  const { pathname } = useLocation();
  const match = DESTINATIONS.find((d) => d.path === pathname);
  return match?.id ?? 'map';
}
