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
import { playerContainer } from '../lib/containers';

export function HealthScreen() {
  const isWide = useMediaQuery('(min-width: 900px)');

  const [activeSlot, setActiveSlot] = useState<EquipSlotState | null>(null);

  const containers = useGameSubscription('containers', (msg) =>
    msg.category === 'containers' ? msg.data : undefined,
  );
  const inventory = playerContainer(containers);
  const candidates = activeSlot
    ? wearCandidates(inventory, activeSlot.id as PaperdollSlotId, activeSlot.itemType)
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
