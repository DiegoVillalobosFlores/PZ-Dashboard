import { Switch } from '@mantine/core';
import { GlassPanel } from '../components/GlassPanel';
import { ScreenModal } from '../components/ScreenModal';
import { useFogOfWar } from '../lib/settings';

export function SettingsScreen() {
  const [fogOfWar, setFogOfWar] = useFogOfWar();

  return (
    <ScreenModal>
      <GlassPanel
        style={{ width: 420, maxWidth: '100%', padding: 20 }}
        cornerBrackets={{ length: 14, inset: 6 }}
      >
        <h2
          className="pz-label"
          style={{
            margin: '0 0 16px',
            fontSize: 13,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--color-text-secondary)',
          }}
        >
          Settings
        </h2>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: 'var(--color-tile-bg)',
            padding: 14,
            cursor: 'pointer',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Fog of war
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              Hide everything missing from your in-game map
            </span>
          </span>
          <Switch
            checked={fogOfWar}
            onChange={(event) => setFogOfWar(event.currentTarget.checked)}
            aria-label="Fog of war"
          />
        </label>
      </GlassPanel>
    </ScreenModal>
  );
}
