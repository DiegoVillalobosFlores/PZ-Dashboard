import { Icon } from './Icon';
import { CornerBrackets } from './CornerBrackets';
import { healthColor, vitalColor } from '../lib/vitals';
import { useGameSubscription } from '../lib/gameSocket';
import { statusToVitals } from '../lib/transformLiveState';
import { mockVitals } from '../mock/gameState';

function MiniVital({ icon, value, compact }: { icon: string; value: number; compact: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 3 : 5 }}>
      <Icon name={icon} size={compact ? 14 : 18} color={vitalColor(value)} />
      <span
        style={{
          fontSize: compact ? 11 : 14,
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {value}%
      </span>
    </div>
  );
}

// v9 "scanner HUD" status pill: frosted panel + corner-bracket frame, Share
// Tech Mono readouts.
export function ConditionCluster({ compact = false }: { compact?: boolean }) {
  // Falls back to mock so the HUD isn't blank while connecting.
  const vitals =
    useGameSubscription('vitals', (msg) =>
      msg.category === 'status' ? statusToVitals(msg.data) : undefined,
    ) ?? mockVitals;

  const iconSize = compact ? 16 : 20;
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 10 : 16,
        padding: compact ? `0 12px` : `0 18px`,
        height: compact ? 36 : 48,
        background: 'var(--color-glass-panel)',
        backdropFilter: 'var(--frost-blur)',
        borderRadius: 'var(--radius-sharp)',
        boxShadow: '0 3px 16px rgba(0, 0, 0, 0.4)',
      }}
    >
      <CornerBrackets length={12} thickness={2} inset={3} opacity={0.85} />
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 6 }}>
        <Icon name="heart" size={iconSize} color={healthColor(vitals.health)} />
        <span
          style={{
            fontSize: compact ? 13 : 16,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-primary)',
            fontWeight: 600,
          }}
        >
          {vitals.health}%
        </span>
      </div>
      <MiniVital icon="drumstick" value={vitals.hunger} compact={compact} />
      <MiniVital icon="droplet" value={vitals.thirst} compact={compact} />
      <MiniVital icon="moon" value={vitals.fatigue} compact={compact} />
      <MiniVital icon="zap" value={vitals.stamina} compact={compact} />
    </div>
  );
}
