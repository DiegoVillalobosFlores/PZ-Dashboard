import { Switch } from '@mantine/core';
import { GlassPanel } from '../components/GlassPanel';
import { ScreenModal } from '../components/ScreenModal';
import {
  useFogOfWar,
  useShowTraits,
  useConditionClusterSettings,
  type ClusterStatSettings,
} from '../lib/settings';

const CLUSTER_STATS: Array<{ key: keyof ClusterStatSettings; label: string; hint: string; group: 'Vitals' | 'Conditions' }> = [
  { key: 'health', label: 'Health', hint: 'Overall condition', group: 'Vitals' },
  { key: 'hunger', label: 'Hunger', hint: 'Nourishment level', group: 'Vitals' },
  { key: 'thirst', label: 'Thirst', hint: 'Hydration level', group: 'Vitals' },
  { key: 'fatigue', label: 'Fatigue', hint: 'Tiredness', group: 'Vitals' },
  { key: 'stamina', label: 'Stamina', hint: 'Endurance reserve', group: 'Vitals' },
  { key: 'stress', label: 'Stress', hint: 'Mental strain', group: 'Conditions' },
  { key: 'panic', label: 'Panic', hint: 'Fear level', group: 'Conditions' },
  { key: 'pain', label: 'Pain', hint: 'From injuries', group: 'Conditions' },
  { key: 'boredom', label: 'Boredom', hint: 'Mental understimulation', group: 'Conditions' },
  { key: 'infected', label: 'Infected', hint: 'Wound infection', group: 'Conditions' },
  { key: 'bleeding', label: 'Bleeding', hint: 'Open wounds', group: 'Conditions' },
];

function SettingRow({
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 14px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
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
          {title}
        </span>
        {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{hint}</span>}
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        aria-label={title}
      />
    </label>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: '10px 14px 4px',
        fontSize: 11,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-text-tertiary)',
      }}
    >
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const [fogOfWar, setFogOfWar] = useFogOfWar();
  const [showTraits, setShowTraits] = useShowTraits();
  const [settings, setSettings] = useConditionClusterSettings();

  const setStat = (key: keyof ClusterStatSettings) => (checked: boolean) =>
    setSettings((prev) => ({ ...prev, [key]: checked }));

  return (
    <ScreenModal>
      <GlassPanel
        style={{ width: 420, maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        cornerBrackets={{ length: 14, inset: 6 }}
      >
        <div style={{ overflowY: 'auto', minHeight: 0, padding: 20 }}>
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

        <div style={{ marginTop: 16 }}>
          <SettingRow
            title="Traits list"
            hint="Show character traits on the Skills screen"
            checked={showTraits}
            onChange={setShowTraits}
          />

          <SettingRow
            title="Conditions cluster"
            hint="Show the vitals and conditions pill on the map"
            checked={settings.showCluster}
            onChange={(checked) => setSettings((prev) => ({ ...prev, showCluster: checked }))}
          />

          {(['Vitals', 'Conditions'] as const).map((group) => (
            <div key={group}>
              <SectionLabel>{group}</SectionLabel>
              {CLUSTER_STATS.filter((stat) => stat.group === group).map((stat) => (
                <SettingRow
                  key={stat.key}
                  title={stat.label}
                  hint={stat.hint}
                  checked={settings[stat.key]}
                  disabled={!settings.showCluster}
                  onChange={setStat(stat.key)}
                />
              ))}
            </div>
          ))}
        </div>
        </div>
      </GlassPanel>
    </ScreenModal>
  );
}
