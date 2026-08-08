import { useLayoutEffect, useRef, useState } from 'react';
import { CharacterModel } from './CharacterModel';
import { EquipTile } from './EquipTile';
import { Icon } from './Icon';
import { GlassPanel } from './GlassPanel';
import { useGameSubscription } from '../lib/gameSocket';
import { paperdollSlots, type EquipSlotState, type PaperdollSlotId } from '../lib/equipment';

const ALL_SLOTS: PaperdollSlotId[] = ['head', 'torso', 'hands', 'face', 'back', 'belt', 'holster', 'wrist', 'legs', 'feet'];

function useMeasuredHeight() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const h = el.clientHeight;
      if (h > 0) setHeight(h);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, height };
}

export function EquipmentPanel({
  compact = false,
  onSelectSlot,
}: {
  compact?: boolean;
  onSelectSlot: (slot: EquipSlotState) => void;
}) {
  const slots =
    useGameSubscription('paperdoll', (msg) =>
      msg.category === 'equipment' ? paperdollSlots(msg.data) : undefined,
    ) ?? paperdollSlots(null);

  const status = useGameSubscription('status', (msg) =>
    msg.category === 'status' ? msg.data : undefined,
  );
  const characterName = status?.displayName ?? 'Character';

  const bySlot = Object.fromEntries(slots.map((s) => [s.id, s])) as Record<
    PaperdollSlotId,
    EquipSlotState
  >;
  const { ref: rowRef, height: rowHeight } = useMeasuredHeight();
  const gridGap = compact ? 12 : 16;
  const sideGap = compact ? 18 : 32;
  const paddingX = compact ? 26 : 40;
  const panelWidth = compact ? 520 : 680;
  const tileBox = compact ? 54 : 72;
  const tileGridWidth = 2 * tileBox + gridGap;
  const maxModelWidth = panelWidth - 2 * paddingX - tileGridWidth - sideGap;
  const fallbackSize = compact ? 180 : 340;
  const modelSize = rowHeight > 0 ? Math.min(rowHeight, Math.floor(maxModelWidth)) : fallbackSize;

  const tile = (id: PaperdollSlotId) => (
    <EquipTile
      key={id}
      slot={bySlot[id]}
      variant="worn"
      wide={!compact}
      onClick={() => onSelectSlot(bySlot[id])}
    />
  );

  return (
    <GlassPanel
      cornerBrackets={{ length: 20, thickness: 2, inset: 6, opacity: 0.85 }}
      style={{
        width: compact ? 520 : 680,
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: compact ? '20px 26px' : '28px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 16 : 24,
      }}
    >
      <span
        style={{
          fontSize: compact ? 16 : 18,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--color-text-primary)',
        }}
        className="pz-label"
      >
        {characterName}
      </span>
      <div ref={rowRef} style={{ display: 'flex', alignItems: 'stretch', gap: sideGap }}>
        <CharacterModel
          size={modelSize}
          fallback={
            <Icon
              name="person-standing"
              size={fallbackSize}
              color="var(--color-text-tertiary)"
              strokeWidth={1.5}
            />
          }
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(2, 1fr)`,
            gap: gridGap,
          }}
        >
          {ALL_SLOTS.map(tile)}
        </div>
      </div>
    </GlassPanel>
  );
}
