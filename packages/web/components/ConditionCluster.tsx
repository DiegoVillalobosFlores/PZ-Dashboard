import { Tooltip } from '@mantine/core';
import { Icon } from './Icon';
import { GlassPanel } from './GlassPanel';
import { Divider } from './Divider';
import { healthColor, vitalColor } from '../lib/vitals';
import { useGameSubscription } from '../lib/gameSocket';
import { useConditionClusterSettings } from '../lib/settings';
import { statusToVitals, statusToConditions } from '../lib/transformLiveState';
import { mockVitals } from '../mock/gameState';

const TOOLTIP_STYLES = {
  tooltip: {
    background: 'var(--color-glass-panel)',
    border: '1px solid var(--color-border)',
    backdropFilter: 'var(--frost-blur)',
    borderRadius: 'var(--radius-sharp)',
    boxShadow: 'var(--shadow-float)',
    color: 'var(--color-text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    padding: '8px 12px',
    maxWidth: 300,
    whiteSpace: 'normal',
    lineHeight: 1.5,
  },
};

function vitalsLabel(name: string, value: number): string {
  switch (name) {
    case 'health': return `Health — overall condition. Low health slows movement and actions. Zero is death. (${value}%)`;
    case 'hunger': return `Hunger — nourishment level. Starvation reduces strength and deals health damage. (${value}%)`;
    case 'thirst': return `Thirst — hydration level. Dehydration slows endurance recovery and deals health damage. (${value}%)`;
    case 'fatigue': return `Fatigue — tiredness. Exhaustion reduces perception, accuracy and prevents sprinting. (${value}%)`;
    case 'stamina': return `Stamina — endurance reserve. Spent by running, swinging weapons and heavy actions. (${value}%)`;
    default: return `${value}%`;
  }
}

function condLabel(name: string, value: number, resist = 1): string {
  switch (name) {
    case 'stress': return `Stress — mental strain. Builds from zombie presence, blood and nightmares. Causes unhappiness. (${value}%)`;
    case 'panic': return `Panic — fear level. Reduces weapon accuracy and critical hit chance. Triggered by zombies and phobias. Fades ${resist}x faster from time survived (+1x per 30 days, caps at 6x on day 150), and twice as fast while asleep. (${value}%)`;
    case 'pain': return `Pain — from injuries. Slows movement and action speed. Painkillers provide temporary relief. (${value}%)`;
    case 'boredom': return `Boredom — mental understimulation. Causes unhappiness over time. Relieved by reading and entertainment. (${value}%)`;
    default: return `${value}%`;
  }
}

function flagLabel(name: string, active: boolean): string {
  switch (name) {
    case 'infected': return `Infected — wound infection. Causes progressive health loss. Requires antibiotics or sterilized bandages. (${active ? 'Yes' : 'No'})`;
    case 'bleeding': return `Bleeding — open wounds. Causes continuous health loss. Must be bandaged to stop. (${active ? 'Yes' : 'No'})`;
    default: return active ? 'Yes' : 'No';
  }
}

function MiniVital({ name, icon, value, compact }: { name: string; icon: string; value: number; compact: boolean }) {
  return (
    <Tooltip label={vitalsLabel(name, value)} styles={TOOLTIP_STYLES} withArrow arrowSize={6}>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 3 : 5, cursor: 'default' }}>
        <Icon name={icon} size={compact ? 14 : 18} color={vitalColor(value)} />
        <span
          style={{
            fontSize: compact ? 12 : 14,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
          }}
        >
          {value}%
        </span>
      </div>
    </Tooltip>
  );
}

function MiniCond({
  name,
  icon,
  value,
  compact,
  severe,
  resist,
}: {
  name: string;
  icon: string;
  value: number;
  compact: boolean;
  severe: boolean;
  resist?: number;
}) {
  const color = severe ? 'var(--color-danger)' : value > 0 ? 'var(--color-warning)' : 'var(--color-text-tertiary)';
  return (
    <Tooltip label={condLabel(name, value, resist)} styles={TOOLTIP_STYLES} withArrow arrowSize={6}>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 3 : 5, cursor: 'default' }}>
        <Icon name={icon} size={compact ? 15 : 18} color={color} />
        <span
          style={{
            fontSize: compact ? 12 : 13,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color,
            opacity: value > 0 ? 1 : 0.7,
          }}
        >
          {value}%
        </span>
      </div>
    </Tooltip>
  );
}

function MiniFlag({ name, icon, active, compact }: { name: string; icon: string; active: boolean; compact: boolean }) {
  return (
    <Tooltip label={flagLabel(name, active)} styles={TOOLTIP_STYLES} withArrow arrowSize={6}>
      <span style={{ cursor: 'default' }}>
        <Icon
          name={icon}
          size={compact ? 15 : 18}
          color={active ? 'var(--color-danger)' : 'var(--color-text-tertiary)'}
          strokeWidth={active ? 2.5 : 2}
        />
      </span>
    </Tooltip>
  );
}


export function ConditionCluster({ compact = false }: { compact?: boolean }) {
  const position = useGameSubscription('map:position', (msg) =>
    msg.category === 'map' ? msg.data : undefined,
  );
  const vitals =
    useGameSubscription('vitals', (msg) =>
      msg.category === 'status' ? statusToVitals(msg.data) : undefined,
    ) ?? mockVitals;

  const conditions = useGameSubscription('conditions', (msg) =>
    msg.category === 'status' ? statusToConditions(msg.data) : undefined,
  );
  const world = useGameSubscription('world-stats', (msg) =>
    msg.category === 'status' ? msg.data : undefined,
  );
  const [settings] = useConditionClusterSettings();

  if (!settings.showCluster) return null;

  const iconSize = compact ? 17 : 20;

  const healthChip = (
    <Tooltip
      key="health"
      label={vitalsLabel('health', vitals.health)}
      styles={TOOLTIP_STYLES}
      withArrow
      arrowSize={6}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 5 : 6, cursor: 'default', flexShrink: 0 }}>
        <Icon name="heart" size={iconSize} color={healthColor(vitals.health)} />
        <span
          style={{
            fontSize: compact ? 15 : 16,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-primary)',
            fontWeight: 700,
          }}
        >
          {vitals.health}%
        </span>
      </div>
    </Tooltip>
  );

  const vehicleChip = position?.inVehicle ? (
    <Icon key="vehicle" name="car" size={iconSize} color="var(--color-accent)" />
  ) : null;

  const worldStats = world ? (
    <div
      key="world"
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: compact ? 'center' : 'flex-start',
        gap: compact ? 7 : 2,
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: compact ? 11 : 12,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--color-accent)' }}>{String(world.hour).padStart(2, '0')}:{String(world.minute).padStart(2, '0')}</span>
      <span>DAY {Math.floor(world.hoursSurvived / 24) + 1}</span>
      {!compact && <span>{world.day + 1}/{world.month + 1}</span>}
      <span>{Math.round(world.temperature)}°</span>
    </div>
  ) : null;

  const vitalItems = [
    settings.hunger && <MiniVital key="hunger" name="hunger" icon="drumstick" value={vitals.hunger} compact={compact} />,
    settings.thirst && <MiniVital key="thirst" name="thirst" icon="droplet" value={vitals.thirst} compact={compact} />,
    settings.fatigue && <MiniVital key="fatigue" name="fatigue" icon="moon" value={vitals.fatigue} compact={compact} />,
    settings.stamina && (!compact || vitals.stamina < 100) && (
      <MiniVital key="stamina" name="stamina" icon="zap" value={vitals.stamina} compact={compact} />
    ),
  ].filter(Boolean);

  const condItems = conditions
    ? [
        settings.stress && (
          <MiniCond key="stress" name="stress" icon="brain" value={conditions.stress} compact={compact} severe={conditions.stress > 60} />
        ),
        settings.panic && (
          <MiniCond key="panic" name="panic" icon="alert-triangle" value={conditions.panic} compact={compact} severe={conditions.panic > 60} resist={conditions.panicResistance} />
        ),
        settings.pain && (
          <MiniCond key="pain" name="pain" icon="activity" value={conditions.pain} compact={compact} severe={conditions.pain > 60} />
        ),
        settings.boredom && (
          <MiniCond key="boredom" name="boredom" icon="flame" value={conditions.boredom} compact={compact} severe={false} />
        ),
        settings.infected && <MiniFlag key="infected" name="infected" icon="skull" active={conditions.infected} compact={compact} />,
        settings.bleeding && <MiniFlag key="bleeding" name="bleeding" icon="droplet" active={conditions.bleeding} compact={compact} />,
      ].filter(Boolean)
    : [];

  const compactCondItems = conditions
    ? [
        settings.stress && conditions.stress > 0 && (
          <MiniCond key="stress" name="stress" icon="brain" value={conditions.stress} compact={compact} severe={conditions.stress > 60} />
        ),
        settings.panic && conditions.panic > 0 && (
          <MiniCond key="panic" name="panic" icon="alert-triangle" value={conditions.panic} compact={compact} severe={conditions.panic > 60} resist={conditions.panicResistance} />
        ),
        settings.pain && conditions.pain > 0 && (
          <MiniCond key="pain" name="pain" icon="activity" value={conditions.pain} compact={compact} severe={conditions.pain > 60} />
        ),
        settings.boredom && conditions.boredom > 0 && (
          <MiniCond key="boredom" name="boredom" icon="flame" value={conditions.boredom} compact={compact} severe={false} />
        ),
      ].filter(Boolean)
    : [];

  const compactFlagItems = conditions
    ? [
        settings.infected && conditions.infected && <MiniFlag key="infected" name="infected" icon="skull" active compact={compact} />,
        settings.bleeding && conditions.bleeding && <MiniFlag key="bleeding" name="bleeding" icon="droplet" active compact={compact} />,
      ].filter(Boolean)
    : [];

  // Mobile: one full-width row so the strip reads at a glance without eating
  // two lines of the map's top edge - the wide layout keeps the stacked
  // two-row pill since it already has a whole side of the screen to itself.
  if (compact) {
    const groups = [
      [vehicleChip, worldStats],
      settings.health ? [healthChip] : [],
      vitalItems,
      compactCondItems,
      compactFlagItems,
    ]
      .map((group) => group.filter(Boolean))
      .filter((group) => group.length > 0);

    return (
      <GlassPanel
        cornerBrackets={{ length: 12, thickness: 2, inset: 3, opacity: 0.85 }}
        style={{
          padding: '9px 12px',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 9, rowGap: 7 }}>
          {groups.flatMap((group, i) => {
            const divider = i < groups.length - 1 ? <Divider key={`d${i}`} height={16} /> : null;
            return [...group, divider];
          })}
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel
      cornerBrackets={{ length: 12, thickness: 2, inset: 3, opacity: 0.85 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '8px 18px',
      }}
    >
      {worldStats}
      {worldStats && <Divider />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {vehicleChip}
          {settings.health && healthChip}
          {vitalItems}
        </div>

        {condItems.length > 0 && (
          <>
            <Divider orientation="horizontal" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>{condItems}</div>
          </>
        )}
      </div>
    </GlassPanel>
  );
}
