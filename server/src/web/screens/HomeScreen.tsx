import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { HandEquipmentWidget } from '../components/HandEquipmentWidget';
import { SelectionDrawer } from '../components/SelectionDrawer';
import { sendAction, useGameSubscription } from '../lib/gameSocket';
import { handCandidates, type EquipSlotState, type SelectableItem } from '../lib/equipment';

export function HomeScreen() {
  const isWide = useMediaQuery('(min-width: 900px)');

  // Which hand the drawer is filling. The hands themselves are live from the
  // mod (see HandEquipmentWidget) — the only local state here is the drawer.
  const [activeHand, setActiveHand] = useState<EquipSlotState | null>(null);

  const inventory = useGameSubscription('inventory', (msg) =>
    msg.category === 'inventory' ? msg.data : undefined,
  );
  const candidates = handCandidates(inventory ?? null, activeHand?.itemType);

  function handleSelect(item: SelectableItem) {
    // Equipping is a timed action in-game, so the widget won't update on
    // click — it updates when the mod reports the hand actually changed.
    sendAction(activeHand?.id === 'secondary' ? 'equipSecondary' : 'equipPrimary', {
      itemType: item.type,
    });
    setActiveHand(null);
  }

  return (
    <>
      <div style={{ position: 'absolute', top: isWide ? 24 : 100, right: isWide ? 40 : 12 }}>        <HandEquipmentWidget wide={!!isWide} onSelectSlot={setActiveHand} />
      </div>
      <SelectionDrawer
        opened={activeHand !== null}
        onClose={() => setActiveHand(null)}
        title={`Select ${activeHand?.label ?? 'Primary'} Item`}
        items={candidates}
        emptyMessage={inventory ? 'Nothing in your inventory to equip.' : 'Waiting for inventory data…'}
        onSelect={handleSelect}
      />
    </>
  );
}
