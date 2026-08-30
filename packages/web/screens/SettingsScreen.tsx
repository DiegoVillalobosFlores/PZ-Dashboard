import { Button, Switch, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { ScreenModal } from '../components/ScreenModal';
import {
  DEFAULT_AUTO_ROTATE,
  DEFAULT_AUTO_ZOOM_ON_SPEED,
  DEFAULT_CLUSTER_SETTINGS,
  DEFAULT_FOG_OF_WAR,
  DEFAULT_SHOW_SUMMARY,
  DEFAULT_SHOW_TRAITS,
  settingMatchesFilter,
  useAutoRotate,
  useAutoZoomOnSpeed,
  useFogOfWar,
  useShowSummary,
  useShowTraits,
  useConditionClusterSettings,
  type ClusterStatSettings,
  type ConditionClusterSettings,
} from '../lib/settings';

const SECTIONS = [
  { id: 'map', label: 'Map', order: 0 },
  { id: 'character', label: 'Character', order: 1 },
  { id: 'skills', label: 'Skills', order: 2 },
  { id: 'conditions', label: 'Conditions', order: 3 },
] as const;

const CLUSTER_STATS: Array<{
  key: keyof ClusterStatSettings;
  label: string;
  hint: string;
  group: 'Vitals' | 'Conditions';
}> = [
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

type SectionId = (typeof SECTIONS)[number]['id'];
type Subgroup = 'Vitals' | 'Conditions';

type SettingDescriptor = {
  id: string;
  section: SectionId;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  reset: () => void;
  subgroup?: Subgroup;
};

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
        background: 'var(--color-tile-bg)',
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

function SectionHeader({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingBottom: 8,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
        }}
      >
        {label}
      </span>
      <Button
        type="button"
        variant="subtle"
        size="xs"
        onClick={onReset}
        aria-label={`Reset ${label} settings`}
        style={{ flexShrink: 0 }}
      >
        Reset
      </Button>
    </div>
  );
}

function SubgroupLabel({ children }: { children: Subgroup }) {
  return (
    <div
      style={{
        padding: '8px 12px 4px',
        fontSize: 10,
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
  const isWide = useMediaQuery('(min-width: 900px)');
  const [fogOfWar, setFogOfWar] = useFogOfWar();
  const [autoRotate, setAutoRotate] = useAutoRotate();
  const [autoZoomOnSpeed, setAutoZoomOnSpeed] = useAutoZoomOnSpeed();
  const [showSummary, setShowSummary] = useShowSummary();
  const [showTraits, setShowTraits] = useShowTraits();
  const [settings, setSettings] = useConditionClusterSettings();
  const [filter, setFilter] = useState('');
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  useEffect(() => {
    if (!confirmResetAll) return;
    const timeout = window.setTimeout(() => setConfirmResetAll(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [confirmResetAll]);

  const setStat = (key: keyof ClusterStatSettings) => (checked: boolean) =>
    setSettings((prev) => ({ ...prev, [key]: checked }));

  const resetClusterField = (key: keyof ConditionClusterSettings) => () =>
    setSettings((prev) => ({ ...prev, [key]: DEFAULT_CLUSTER_SETTINGS[key] }));

  const descriptors: SettingDescriptor[] = [
    {
      id: 'fog-of-war',
      section: 'map',
      title: 'Fog of war',
      hint: 'Hide everything missing from your in-game map',
      checked: fogOfWar,
      onChange: setFogOfWar,
      reset: () => setFogOfWar(DEFAULT_FOG_OF_WAR),
    },
    {
      id: 'auto-zoom-on-speed',
      section: 'map',
      title: 'Auto zoom while driving',
      hint: 'Widen the map view when travelling fast',
      checked: autoZoomOnSpeed,
      onChange: setAutoZoomOnSpeed,
      reset: () => setAutoZoomOnSpeed(DEFAULT_AUTO_ZOOM_ON_SPEED),
    },
    {
      id: 'character-rotation',
      section: 'character',
      title: 'Character rotation',
      hint: 'Slowly spin the 3D character on the Health screen',
      checked: autoRotate,
      onChange: setAutoRotate,
      reset: () => setAutoRotate(DEFAULT_AUTO_ROTATE),
    },
    {
      id: 'skills-summary',
      section: 'skills',
      title: 'Skills summary',
      hint: 'Show the trait effects summary on the Skills screen',
      checked: showSummary,
      onChange: setShowSummary,
      reset: () => setShowSummary(DEFAULT_SHOW_SUMMARY),
    },
    {
      id: 'traits-list',
      section: 'skills',
      title: 'Traits list',
      hint: 'Show character traits on the Skills screen',
      checked: showTraits,
      onChange: setShowTraits,
      reset: () => setShowTraits(DEFAULT_SHOW_TRAITS),
    },
    {
      id: 'conditions-cluster',
      section: 'conditions',
      title: 'Conditions cluster',
      hint: 'Show the vitals and conditions pill on the map',
      checked: settings.showCluster,
      onChange: (checked) => setSettings((prev) => ({ ...prev, showCluster: checked })),
      reset: resetClusterField('showCluster'),
    },
    ...CLUSTER_STATS.map((stat): SettingDescriptor => ({
      id: `condition-stat-${stat.key}`,
      section: 'conditions',
      title: stat.label,
      hint: stat.hint,
      checked: settings[stat.key],
      disabled: !settings.showCluster,
      onChange: setStat(stat.key),
      reset: resetClusterField(stat.key),
      subgroup: stat.group,
    })),
  ];

  const visibleSections = [...SECTIONS]
    .sort((first, second) => first.order - second.order)
    .map((section) => {
      const sectionSettings = descriptors.filter((setting) => setting.section === section.id);
      return {
        ...section,
        settings: sectionSettings,
        visibleSettings: sectionSettings.filter((setting) => settingMatchesFilter(setting.title, setting.hint, filter)),
      };
    })
    .filter((section) => section.visibleSettings.length > 0);

  function resetAll() {
    if (!confirmResetAll) {
      setConfirmResetAll(true);
      return;
    }
    descriptors.forEach(({ reset }) => reset());
    setConfirmResetAll(false);
  }

  return (
    <ScreenModal contentStyle={{ width: isWide ? 780 : '100%', maxWidth: '100%' }}>
      <GlassPanel
        style={{
          width: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
        cornerBrackets={{ length: 14, inset: 6 }}
      >
        <div style={{ flexShrink: 0, padding: 20 }}>
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'end',
              gap: 10,
            }}
          >
            <TextInput
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              placeholder="Filter settings"
              aria-label="Filter settings"
              style={{ minWidth: 0 }}
            />
            <Button
              type="button"
              variant={confirmResetAll ? 'filled' : 'subtle'}
              size="sm"
              onClick={resetAll}
              onBlur={() => setConfirmResetAll(false)}
            >
              {confirmResetAll ? 'Confirm reset' : 'Reset all'}
            </Button>
          </div>
        </div>

        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 20px 20px' }}>
          {visibleSections.length === 0 ? (
            <div style={{ padding: '12px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              No settings match.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isWide ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
                gap: 20,
              }}
            >
              {visibleSections.map((section) => (
                <section
                  key={section.id}
                  style={{
                    minWidth: 0,
                    gridColumn: isWide && section.id === 'conditions' ? '1 / -1' : undefined,
                  }}
                >
                  <SectionHeader
                    label={section.label}
                    onReset={() => section.settings.forEach(({ reset }) => reset())}
                  />
                  <div style={{ display: 'grid', gap: 4 }}>
                    {section.visibleSettings.map((setting, index) => (
                      <div key={setting.id} style={{ marginLeft: setting.subgroup ? 12 : 0 }}>
                        {setting.subgroup && setting.subgroup !== section.visibleSettings[index - 1]?.subgroup && (
                          <SubgroupLabel>{setting.subgroup}</SubgroupLabel>
                        )}
                        <SettingRow
                          title={setting.title}
                          hint={setting.hint}
                          checked={setting.checked}
                          disabled={setting.disabled}
                          onChange={setting.onChange}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </GlassPanel>
    </ScreenModal>
  );
}
