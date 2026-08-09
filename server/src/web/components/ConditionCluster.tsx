import { Tooltip } from '@mantine/core';
import { Icon } from './Icon';
import { GlassPanel } from './GlassPanel';
import { healthColor, vitalColor } from '../lib/vitals';
import { useGameSubscription } from '../lib/gameSocket';
import { statusToVitals, statusToConditions } from '../lib/transformLiveState';
import { mockVitals } from '../mock/gameState';

const TOOLTIP_STYLES = {
  tooltip: {
    background: 'var(--color-glass-panel)',
    backdropFilter: 'var(--frost-blur)',
    borderRadius: 'var(--radius-sharp)',
    boxShadow: '0 3px 16px rgba(0, 0, 0, 0.4)',
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

function condLabel(name: string, value: number): string {
  switch (name) {
    case 'stress': return `Stress — mental strain. Builds from zombie presence, blood and nightmares. Causes unhappiness. (${value}%)`;
    case 'panic': return `Panic — fear level. Reduces weapon accuracy and critical hit chance. Triggered by zombies and phobias. (${value}%)`;
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
}: {
  name: string;
  icon: string;
  value: number;
  compact: boolean;
  severe: boolean;
}) {
  const color = severe ? 'var(--color-danger)' : value > 0 ? 'var(--color-warning)' : 'var(--color-text-tertiary)';
  return (
    <Tooltip label={condLabel(name, value)} styles={TOOLTIP_STYLES} withArrow arrowSize={6}>
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

function Divider({ height }: { height: number }) {
  return (
    <span
      style={{
        width: 1,
        height,
        flexShrink: 0,
        background: 'var(--color-border-default)',
        opacity: 0.5,
      }}
    />
  );
}

export function ConditionCluster({ compact = false }: { compact?: boolean }) {
  const vitals =
    useGameSubscription('vitals', (msg) =>
      msg.category === 'status' ? statusToVitals(msg.data) : undefined,
    ) ?? mockVitals;

  const conditions = useGameSubscription('conditions', (msg) =>
    msg.category === 'status' ? statusToConditions(msg.data) : undefined,
  );

  const iconSize = compact ? 17 : 20;

  const healthChip = (
    <Tooltip label={vitalsLabel('health', vitals.health)} styles={TOOLTIP_STYLES} withArrow arrowSize={6}>
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

  // Mobile: one full-width row so the strip reads at a glance without eating
  // two lines of the map's top edge - the wide layout keeps the stacked
  // two-row pill since it already has a whole side of the screen to itself.
  if (compact) {
    return (
      <GlassPanel
        cornerBrackets={{ length: 12, thickness: 2, inset: 3, opacity: 0.85 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '9px 12px',
          width: '100%',
          overflowX: 'auto',
        }}
      >
        {healthChip}
        <Divider height={16} />
        <MiniVital name="hunger" icon="drumstick" value={vitals.hunger} compact={compact} />
        <MiniVital name="thirst" icon="droplet" value={vitals.thirst} compact={compact} />
        <MiniVital name="fatigue" icon="moon" value={vitals.fatigue} compact={compact} />
        <MiniVital name="stamina" icon="zap" value={vitals.stamina} compact={compact} />
        {conditions && (
          <>
            <Divider height={16} />
            <MiniCond
              name="stress"
              icon="brain"
              value={conditions.stress}
              compact={compact}
              severe={conditions.stress > 60}
            />
            <MiniCond
              name="panic"
              icon="alert-triangle"
              value={conditions.panic}
              compact={compact}
              severe={conditions.panic > 60}
            />
            <MiniCond
              name="pain"
              icon="activity"
              value={conditions.pain}
              compact={compact}
              severe={conditions.pain > 60}
            />
            {(conditions.infected || conditions.bleeding) && <Divider height={16} />}
            {conditions.infected && <MiniFlag name="infected" icon="skull" active compact={compact} />}
            {conditions.bleeding && <MiniFlag name="bleeding" icon="droplet" active compact={compact} />}
          </>
        )}
      </GlassPanel>
    );
  }

  return (
    <GlassPanel
      cornerBrackets={{ length: 12, thickness: 2, inset: 3, opacity: 0.85 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '8px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {healthChip}
        <MiniVital name="hunger" icon="drumstick" value={vitals.hunger} compact={compact} />
        <MiniVital name="thirst" icon="droplet" value={vitals.thirst} compact={compact} />
        <MiniVital name="fatigue" icon="moon" value={vitals.fatigue} compact={compact} />
        <MiniVital name="stamina" icon="zap" value={vitals.stamina} compact={compact} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Divider height={18} />
        {conditions ? (
          <>
            <MiniCond
              name="stress"
              icon="brain"
              value={conditions.stress}
              compact={compact}
              severe={conditions.stress > 60}
            />
            <MiniCond
              name="panic"
              icon="alert-triangle"
              value={conditions.panic}
              compact={compact}
              severe={conditions.panic > 60}
            />
            <MiniCond
              name="pain"
              icon="activity"
              value={conditions.pain}
              compact={compact}
              severe={conditions.pain > 60}
            />
            <MiniCond name="boredom" icon="flame" value={conditions.boredom} compact={compact} severe={false} />
            <MiniFlag name="infected" icon="skull" active={conditions.infected} compact={compact} />
            <MiniFlag name="bleeding" icon="droplet" active={conditions.bleeding} compact={compact} />
          </>
        ) : null}
      </div>
    </GlassPanel>
  );
}
