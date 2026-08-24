import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import { Icon } from './Icon';

interface Destination {
	id: string;
	path: string;
	icon: string;
	label: string;
	shortcut: string;
}

const DESTINATIONS: Destination[] = [
	{ id: 'map', path: '/', icon: 'map-pin', label: 'Map', shortcut: '1' },
	{ id: 'inventory', path: '/inventory', icon: 'backpack', label: 'Inventory', shortcut: '2' },
	{ id: 'health', path: '/health', icon: 'heart', label: 'Health', shortcut: '3' },
	{ id: 'skills', path: '/skills', icon: 'dumbbell', label: 'Skills', shortcut: '4' },
	{ id: 'settings', path: '/settings', icon: 'cog', label: 'Settings', shortcut: '5' },
];

// Full-width bottom tab bar on mobile - real thumb reach beats the top-corner
// icon rail the wide layout keeps, and clears the entire top edge for
// ConditionCluster instead of the two competing for the same row.
export const MOBILE_NAV_HEIGHT = 60;

// v9 "scanner HUD" nav: square tiles (radius2), not the earlier rounded rail.
// The wide rail sits straight on the map with no panel behind it, so each
// tile carries the frosted glass itself rather than the flat tile-chip
// background used inside the panels.
export function QuickNav({ currentId }: { currentId: string }) {
	const isWide = useMediaQuery('(min-width: 900px)');
	const navigate = useNavigate();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const destination = DESTINATIONS.find((d) => d.shortcut === event.key);
			if (destination) navigate(destination.path);
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [navigate]);

  if (isWide) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DESTINATIONS.map((d) => {
          const active = d.id === currentId;
          return (
            <button
              key={d.id}
              onClick={() => navigate(d.path)}
              style={{
                width: 72,
                height: 72,
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
                size={28}
                color={active ? '#ffffff' : 'var(--color-text-secondary)'}
                strokeWidth={active ? 2.5 : 2}
								/>
								<span style={{ position: 'absolute', top: 5, right: 7, fontSize: 10, color: active ? '#ffffff' : 'var(--color-text-tertiary)' }}>{d.shortcut}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <nav
      aria-label="Screens"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3,
        display: 'flex',
        background: 'var(--color-glass-panel)',
        backdropFilter: 'var(--frost-blur)',
        boxShadow: '0 -3px 16px rgba(0, 0, 0, 0.4)',
        borderTop: '1px solid var(--color-border-default)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {DESTINATIONS.map((d) => {
        const active = d.id === currentId;
        return (
          <button
            key={d.id}
            onClick={() => navigate(d.path)}
            aria-current={active ? 'page' : undefined}
            style={{
              position: 'relative',
              flex: '1 1 0',
              height: MOBILE_NAV_HEIGHT,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {active && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 28,
                  height: 2,
                  background: 'var(--color-accent)',
                }}
              />
            )}
							<Icon
              name={d.icon}
              size={22}
              color={active ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
              strokeWidth={active ? 2.5 : 2}
							/>
	            <span
              className="pz-label"
              style={{
                fontSize: 9,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              }}
            >
              {d.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function useCurrentDestinationId(): string {
  const { pathname } = useLocation();
  const match = DESTINATIONS.find((d) => d.path === pathname);
  return match?.id ?? 'map';
}
