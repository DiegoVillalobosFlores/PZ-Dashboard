import { CornerBrackets } from './CornerBrackets';
import { EquipTile } from './EquipTile';
import { useGameSubscription } from '../lib/gameSocket';
import { handSlots, type EquipSlotState } from '../lib/equipment';

// Primary/secondary hand-equipment widget (v8): what's literally held in each
// hand right now, distinct from the numbered hotbar (quick-access favorites,
// not necessarily what's currently drawn). Both read the same live toolbar
// snapshot through the same <EquipTile>, so they can't disagree about what's
// in hand the way the mock-backed version used to.
export function HandEquipmentWidget({
  wide = true,
  onSelectSlot,
}: {
  wide?: boolean;
  onSelectSlot: (slot: EquipSlotState) => void;
}) {
  const slots =
    useGameSubscription('hands', (msg) =>
      msg.category === 'toolbar' ? handSlots(msg.data) : undefined,
    ) ?? handSlots(null);

  // Matches the Penpot v8 frame: tile size and gap differ per breakpoint, and
  // the panel is sized to its contents rather than the other way round.
  const slotSize = wide ? 84 : 62;
  const pad = 8;
  const gap = wide ? 8 : 6;

  return (
    <div
      style={{
        position: 'relative',
        width: pad * 2 + slotSize * 2 + gap,
        height: pad * 2 + slotSize,
        background: 'var(--color-glass-panel)',
        backdropFilter: 'var(--frost-blur)',
      }}
    >
      <CornerBrackets length={12} thickness={2} inset={3} opacity={0.85} />
      <div style={{ position: 'absolute', top: pad, left: pad, display: 'flex', gap }}>
        {slots.map((slot) => (
          <EquipTile
            key={slot.id}
            slot={slot}
            variant="hand"
            wide={wide}
            onClick={() => onSelectSlot(slot)}
          />
        ))}
      </div>
    </div>
  );
}
