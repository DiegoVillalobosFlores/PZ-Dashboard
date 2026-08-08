import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { EquipmentPanel } from '../components/EquipmentPanel';
import { ScreenModal } from '../components/ScreenModal';
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

  const [activeSlot, setActiveSlot] = useState<EquipSlotState | null>(null);

  const inventory = useGameSubscription('inventory', (msg) =>
    msg.category === 'inventory' ? msg.data : undefined,
  );
  const candidates = activeSlot
    ? wearCandidates(inventory ?? null, activeSlot.id as PaperdollSlotId, activeSlot.itemType)
    : [];

  function handleSelect(item: SelectableItem) {
    sendAction('wearItem', { itemType: item.type });
    setActiveSlot(null);
  }

  return (
    <>
      <ScreenModal>
        <EquipmentPanel compact={!isWide} onSelectSlot={setActiveSlot} />
      </ScreenModal>
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
