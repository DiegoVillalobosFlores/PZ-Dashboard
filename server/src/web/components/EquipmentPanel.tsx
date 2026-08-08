import { CharacterModel } from './CharacterModel';
import { EquipTile } from './EquipTile';
import { Icon } from './Icon';
import { GlassPanel } from './GlassPanel';
import { useGameSubscription } from '../lib/gameSocket';
import { paperdollSlots, type EquipSlotState, type PaperdollSlotId } from '../lib/equipment';

const ALL_SLOTS: PaperdollSlotId[] = ['head', 'torso', 'hands', 'face', 'back', 'legs', 'feet'];

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
  const silhouetteSize = compact ? 180 : 340;
  const gridGap = compact ? 12 : 16;
  const sideGap = compact ? 18 : 32;

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
      <div style={{ display: 'flex', alignItems: 'center', gap: sideGap }}>
        <CharacterModel
          size={silhouetteSize}
          fallback={
            <Icon
              name="person-standing"
              size={silhouetteSize}
              color="var(--color-text-tertiary)"
              strokeWidth={1.5}
            />
          }
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(3, 1fr)`,
            gap: gridGap,
          }}
        >
          {ALL_SLOTS.map(tile)}
        </div>
      </div>
    </GlassPanel>
  );
}
