import { EquipTile } from './EquipTile';
import { sendAction, useGameSubscription } from '../lib/gameSocket';
import { hotbarSlots, type EquipSlotState } from '../lib/equipment';

// v9 "scanner HUD" hotbar: a frosted glass tray like the rest of the floating
// surfaces, with corner brackets on occupied slots and the lit
// background on whatever is actually in hand. Only the tray is local — the
// tiles are <EquipTile>, shared with the hand widget and the paperdoll.
export function FloatingHotbar({ compact = false }: { compact?: boolean }) {
  const slots =
    useGameSubscription('hotbar', (msg) =>
      msg.category === 'toolbar' ? hotbarSlots(msg.data) : undefined,
    ) ?? [];

  // Real PZ behavior for pressing a number key: that slot's item goes into
  // the primary hand. No optimistic local state — the mod runs the equip as a
  // timed action and the toolbar category reports the result a moment later,
  // so the tray shows what the character is actually holding rather than what
  // was clicked.
  function equip(slot: EquipSlotState) {
    if (slot.itemType) sendAction('equipPrimary', { itemType: slot.itemType });
  }

  // Nothing to show before the first toolbar snapshot arrives, and an empty
  // tray beats a glass box of mock items the player doesn't own.
  if (slots.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 10,
        background: 'var(--color-glass-panel)',
        backdropFilter: 'var(--frost-blur)',
        border: '1px solid var(--color-accent-border-medium)',
        borderRadius: 'var(--radius-sharp)',
        boxShadow: '0 6px 26px rgba(0, 0, 0, 0.5)',
      }}
    >
      {slots.map((slot) => (
        <EquipTile
          key={slot.id}
          slot={slot}
          variant="hotbar"
          wide={!compact}
          onClick={() => equip(slot)}
        />
      ))}
    </div>
  );
}
