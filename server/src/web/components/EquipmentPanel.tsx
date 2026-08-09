import { Loader } from '@mantine/core';
import { CharacterModel } from './CharacterModel';
import { EquipTile } from './EquipTile';
import { GlassPanel } from './GlassPanel';
import { useGameSubscription } from '../lib/gameSocket';
import { paperdollSlots, type EquipSlotState, type PaperdollSlotId } from '../lib/equipment';
import { useModalContext } from './ModalContext';

const ALL_SLOTS: PaperdollSlotId[] = ['head', 'torso', 'hands', 'face', 'back', 'belt', 'holster', 'wrist', 'legs', 'feet'];

export function EquipmentPanel({
  compact = false,
  onSelectSlot,
}: {
  compact?: boolean;
  onSelectSlot: (slot: EquipSlotState) => void;
}) {
  const { isModalOpen } = useModalContext();
  const inModal = isModalOpen;

  const slots =
    useGameSubscription('paperdoll', (msg) =>
      msg.category === 'equipment' ? paperdollSlots(msg.data) : undefined,
    ) ?? paperdollSlots(null);

  const status = useGameSubscription('status', (msg) =>
    msg.category === 'status' ? msg.data : undefined,
  );
  const firstName = status?.forename || 'Character';
  const lastName = status?.surname ?? '';

  const bySlot = Object.fromEntries(slots.map((s) => [s.id, s])) as Record<
    PaperdollSlotId,
    EquipSlotState
  >;
  const gridGap = compact ? 12 : 16;
  const sideGap = compact ? 18 : 32;
  const paddingX = compact ? 26 : 40;
  const panelWidth = compact ? 520 : 680;
  const tileBox = compact ? 54 : 72;
  const tileGridWidth = 2 * tileBox + gridGap;
  const maxModelWidth = panelWidth - 2 * paddingX - tileGridWidth - sideGap;
  const fallbackSize = compact ? 180 : 340;

  const tile = (id: PaperdollSlotId) => (
    <EquipTile
      key={id}
      slot={bySlot[id]}
      variant="worn"
      wide={!compact}
      onClick={() => onSelectSlot(bySlot[id])}
    />
  );

  const isCompactModal = compact && inModal;

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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
          {firstName}
        </span>
        {lastName && (
          <span
            style={{
              fontSize: compact ? 12 : 13,
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              letterSpacing: '0.04em',
              color: 'var(--color-text-secondary)',
            }}
            className="pz-label"
          >
            {lastName}
          </span>
        )}
      </div>
      {isCompactModal ? (
        <>
          <div style={{ width: '100%', height: fallbackSize, display: 'flex', justifyContent: 'center' }}>
            <CharacterModel fallback={<Loader color="var(--color-text-tertiary)" />} />
          </div>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(5, 1fr)`,
                gap: gridGap,
                maxWidth: panelWidth - 2 * paddingX,
              }}
            >
              {ALL_SLOTS.map(tile)}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: sideGap }}>
          <div style={{ width: maxModelWidth, flexShrink: 0 }}>
            <CharacterModel fallback={<Loader color="var(--color-text-tertiary)" />} />
          </div>
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
      )}
    </GlassPanel>
  );
}