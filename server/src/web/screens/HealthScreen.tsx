import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { EquipmentPanel } from '../components/EquipmentPanel';
import { SelectionDrawer } from '../components/SelectionDrawer';
import { sendAction, useGameSubscription } from '../lib/gameSocket';
import {
  wearCandidates,
  type EquipSlotState,
  type PaperdollSlotId,
  type SelectableItem,
} from '../lib/equipment';

export function HealthScreen() {
  const isWide = useMediaQuery('(min-width: 900px)');

  // Which paperdoll box the drawer is filling. What's *worn* is live from the
  // mod (see EquipmentPanel); this is only the drawer's own state.
  const [activeSlot, setActiveSlot] = useState<EquipSlotState | null>(null);

  const inventory = useGameSubscription('inventory', (msg) =>
    msg.category === 'inventory' ? msg.data : undefined,
  );
  const candidates = activeSlot
    ? wearCandidates(inventory ?? null, activeSlot.id as PaperdollSlotId, activeSlot.itemType)
    : [];

  function handleSelect(item: SelectableItem) {
    // PZ derives the body location from the garment itself, so wearing it
    // fills the right slot without us naming one. Like equipping, it's a
    // timed action — the paperdoll updates when the mod reports it done.
    sendAction('wearItem', { itemType: item.type });
    setActiveSlot(null);
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <EquipmentPanel compact={!isWide} onSelectSlot={setActiveSlot} />
        </div>
      </div>
      <SelectionDrawer
        opened={activeSlot !== null}
        onClose={() => setActiveSlot(null)}
        title={`Select ${activeSlot?.label ?? ''} Item`}
        items={candidates}
        emptyMessage={
          inventory
            ? `Nothing in your inventory fits the ${activeSlot?.label.toLowerCase() ?? ''} slot.`
            : 'Waiting for inventory data…'
        }
        onSelect={handleSelect}
      />
    </>
  );
}
