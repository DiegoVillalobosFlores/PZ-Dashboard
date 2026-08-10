import { CornerBrackets } from './CornerBrackets';
import { ItemIcon } from './ItemIcon';
import { conditionColor, type EquipSlotState } from '../lib/equipment';

// The one tile every equipped item is drawn as. The hotbar tray, the
// primary/secondary hand widget and the worn-clothing paperdoll used to each
// have their own near-identical copy of this; they now differ only in the
// spec they pass in and how they arrange the tiles.
//
// Two rules hold across all three, so the same visual always means the same
// thing: the corner brackets mark a slot that holds something, and the lit
// background marks the item as in-hand right now.
export type EquipTileVariant = 'hotbar' | 'hand' | 'worn';

interface TileSpec {
  box: number;
  bracketLength: number;
  iconSize: number;
  // Absolute icon placement; the icon is centered in the box when unset.
  iconOffset?: { top: number; left: number };
  // Hotbar key chip, top-left inside the box.
  badge?: { size: number; fontSize: number };
  // Slot name inside the box (hand tiles) vs. underneath it (paperdoll).
  insetLabel?: { top: number; left: number; fontSize: number };
  caption?: { fontSize: number };
  itemName?: { top: number; left: number; width: number; fontSize: number };
  ammoFontSize?: number;
  conditionBar?: { bottom: number; inset: number; height: number };
}

// Pixel offsets tuned for both sizes
// rather than derived from a scale factor, since the design doesn't scale
// the two sizes by the same ratio for every element.
const SPECS: Record<EquipTileVariant, { wide: TileSpec; compact: TileSpec }> = {
  hotbar: {
    wide: {
      box: 64,
      bracketLength: 10,
      iconSize: 27,
      badge: { size: 17, fontSize: 10 },
      conditionBar: { bottom: 6, inset: 7, height: 3 },
    },
    compact: {
      box: 52,
      bracketLength: 8,
      iconSize: 22,
      badge: { size: 15, fontSize: 9 },
      conditionBar: { bottom: 5, inset: 6, height: 3 },
    },
  },
  hand: {
    wide: {
      box: 84,
      bracketLength: 12,
      iconSize: 26,
      iconOffset: { top: 29, left: 29 },
      insetLabel: { top: 16, left: 19, fontSize: 9 },
      itemName: { top: 53, left: 4, width: 76, fontSize: 10 },
      ammoFontSize: 12,
      conditionBar: { bottom: 8, inset: 9, height: 3 },
    },
    compact: {
      box: 62,
      bracketLength: 9,
      iconSize: 19,
      iconOffset: { top: 21, left: 22 },
      insetLabel: { top: 9, left: 10, fontSize: 8 },
      itemName: { top: 38, left: 4, width: 54, fontSize: 9 },
      ammoFontSize: 10,
      conditionBar: { bottom: 6, inset: 7, height: 3 },
    },
  },
  worn: {
    wide: {
      box: 72,
      bracketLength: 8,
      iconSize: 30,
      caption: { fontSize: 12 },
      conditionBar: { bottom: 6, inset: 7, height: 3 },
    },
    compact: {
      box: 54,
      bracketLength: 8,
      iconSize: 22,
      caption: { fontSize: 11 },
      conditionBar: { bottom: 5, inset: 6, height: 3 },
    },
  },
};

export function EquipTile({
  slot,
  variant,
  wide,
  onClick,
}: {
  slot: EquipSlotState;
  variant: EquipTileVariant;
  wide: boolean;
  onClick: () => void;
}) {
  const spec = SPECS[variant][wide ? 'wide' : 'compact'];
  const emptyLabel = `Empty ${slot.label}`;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spec.caption ? 6 : 0,
        width: spec.box,
        flexShrink: 0,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
      }}
      title={slot.itemName ?? emptyLabel}
    >
      <div
        style={{
          position: 'relative',
          width: spec.box,
          height: spec.box,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: slot.active ? 'var(--color-tile-equipped-bg)' : 'var(--color-tile-bg)',
        }}
      >
        {slot.filled && (
          <CornerBrackets
            length={spec.bracketLength}
            thickness={2}
            inset={3}
            opacity={slot.active ? 1 : 0.9}
          />
        )}

        <div style={spec.iconOffset ? { position: 'absolute', ...spec.iconOffset } : undefined}>
          <ItemIcon
            icon={slot.spriteIcon}
            name={slot.itemName ?? emptyLabel}
            size={spec.iconSize}
            color="var(--color-text-secondary)"
          />
        </div>

        {spec.badge && slot.badge && (
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: 3,
              width: spec.badge.size,
              height: spec.badge.size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: spec.badge.fontSize,
              fontFamily: 'Inter Tight, var(--font-sans)',
              fontWeight: 700,
              background: 'rgba(0,0,0,0.55)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {slot.badge}
          </span>
        )}

        {spec.insetLabel && (
          <span
            className="pz-label"
            style={{
              position: 'absolute',
              top: spec.insetLabel.top,
              left: spec.insetLabel.left,
              fontSize: spec.insetLabel.fontSize,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {slot.label}
          </span>
        )}

        {spec.itemName &&
          // Firearms trade the name for the mono ammo readout — with a gun
          // in hand, rounds left is the more urgent of the two.
          (slot.ammo ? (
            <span
              style={{
                position: 'absolute',
                top: spec.itemName.top - 2,
                left: spec.itemName.left,
                width: spec.itemName.width,
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: spec.ammoFontSize,
                color: 'var(--color-accent)',
              }}
            >
              {slot.ammo}
            </span>
          ) : (
            <span
              style={{
                position: 'absolute',
                top: spec.itemName.top,
                left: spec.itemName.left,
                width: spec.itemName.width,
                textAlign: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: spec.itemName.fontSize,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {slot.itemName ?? 'Empty'}
            </span>
          ))}

        {spec.conditionBar && slot.condition && slot.conditionRatio !== undefined && (
          <span
            style={{
              position: 'absolute',
              bottom: spec.conditionBar.bottom,
              left: spec.conditionBar.inset,
              right: spec.conditionBar.inset,
              height: spec.conditionBar.height,
              background: 'rgba(255, 255, 255, 0.14)',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${slot.conditionRatio * 100}%`,
                height: '100%',
                background: conditionColor(slot.condition),
              }}
            />
          </span>
        )}
      </div>

      {spec.caption && (
        <span
          className="pz-label"
          style={{
            width: '100%',
            fontSize: spec.caption.fontSize,
            fontFamily: 'Inter Tight, var(--font-sans)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {slot.label}
        </span>
      )}
    </button>
  );
}
