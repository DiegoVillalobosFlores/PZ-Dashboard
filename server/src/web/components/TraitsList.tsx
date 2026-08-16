import { useState } from 'react';
import { Tooltip } from '@mantine/core';
import { Icon } from './Icon';
import { useGameConnection, useGameSubscription } from '../lib/gameSocket';
import { signedLevel, sortTraits, traitEffects, type TraitEffect } from '../lib/traits';
import type { TraitSnapshot } from '../lib/liveTypes';

function TraitIcon({ icon }: { icon: string }) {
  const [failed, setFailed] = useState(false);

  if (!icon || failed) {
    return (
      <span
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--color-text-tertiary)',
          background: 'var(--color-tile-bg)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-sharp)',
        }}
      >
        <Icon name="circle-dot" size={16} />
      </span>
    );
  }

  return (
    <img
      src={`/game-icons/${icon}.png`}
      alt=""
      width={30}
      height={30}
      onError={() => setFailed(true)}
      style={{
        flexShrink: 0,
        objectFit: 'contain',
        imageRendering: 'auto',
        background: 'var(--color-tile-bg)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-sharp)',
      }}
    />
  );
}

function EffectContent({ effect }: { effect: TraitEffect }) {
  if (effect.kind === 'description') {
    return (
      <span
        style={{
          display: '-webkit-box',
          overflow: 'hidden',
          color: 'var(--color-text-tertiary)',
          fontSize: 10,
          lineHeight: 1.25,
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 1,
        }}
      >
        {effect.text}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        padding: '2px 5px',
        color: 'var(--color-accent)',
        background: 'var(--color-accent-fill-weak)',
        border: '1px solid var(--color-accent-border-medium)',
        borderRadius: 'var(--radius-sharp)',
        fontSize: 10,
        lineHeight: 1.2,
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap',
      }}
    >
      {effect.perk} {signedLevel(effect.level)}
    </span>
  );
}

function TraitRow({ trait }: { trait: TraitSnapshot }) {
  const label = trait.label || trait.id || 'Unknown trait';
  const effects = traitEffects(trait);

  return (
    <Tooltip
      label={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong>{label}</strong>
          <span>{trait.description || 'No description available.'}</span>
        </div>
      }
      multiline
      w={240}
      withArrow
      events={{ hover: true, focus: true, touch: true }}
    >
      <div
        tabIndex={0}
        aria-label={`${label}: ${trait.description}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          minWidth: 0,
          padding: 7,
          background: 'var(--color-glass-inset)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-sharp)',
          outline: 'none',
        }}
      >
        <TraitIcon key={trait.icon} icon={trait.icon} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span
            className="pz-label"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--color-text-primary)',
              fontSize: 11,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {label}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
            {effects.map((effect, index) => (
              <EffectContent key={`${effect.kind}-${index}`} effect={effect} />
            ))}
          </div>
        </div>
      </div>
    </Tooltip>
  );
}

function TraitColumn({
  label,
  color,
  traits,
  compact,
}: {
  label: string;
  color: string;
  traits: TraitSnapshot[];
  compact: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        minHeight: 0,
        height: compact ? undefined : '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        overflowY: compact ? 'visible' : 'auto',
        overflowX: compact ? 'visible' : 'hidden',
      }}
    >
      <span
        className="pz-label"
        style={{
          flexShrink: 0,
          color,
          fontSize: 10,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      {traits.length === 0 ? (
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>None</span>
      ) : (
        traits.map((trait) => <TraitRow key={trait.id} trait={trait} />)
      )}
    </div>
  );
}

export function TraitsList({ compact = false }: { compact?: boolean }) {
  const connected = useGameConnection();
  const snapshot = useGameSubscription('traits', (msg) =>
    msg.category === 'traits' ? msg.data : undefined,
  );
  const traits = sortTraits(snapshot?.traits);
  const positiveTraits = traits.filter((trait) => trait.cost >= 0);
  const negativeTraits = traits.filter((trait) => trait.cost < 0);

  return (
    <section
      style={{
        width: '100%',
        height: compact ? undefined : '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span
        className="pz-label"
        style={{
          flexShrink: 0,
          color: 'var(--color-accent)',
          fontSize: 11,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}
      >
        Traits
      </span>
      <div
        style={{
          flex: compact ? undefined : '1 1 0',
          minHeight: 0,
          overflow: compact ? 'visible' : 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          alignItems: 'stretch',
          gap: compact ? 12 : 8,
        }}
      >
        {snapshot === undefined ? (
          <div style={{ gridColumn: '1 / -1', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            {connected ? 'Waiting for trait data…' : 'Not connected to the dashboard server.'}
          </div>
        ) : (
          <>
            <TraitColumn label="Positive" color="var(--color-accent)" traits={positiveTraits} compact={compact} />
            <TraitColumn label="Negative" color="var(--color-danger)" traits={negativeTraits} compact={compact} />
          </>
        )}
      </div>
    </section>
  );
}
