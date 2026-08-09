import { useLayoutEffect, useRef, useState } from 'react';
import { EquipTile } from './EquipTile';
import { GlassPanel } from './GlassPanel';
import { sendAction, useGameSubscription } from '../lib/gameSocket';
import { hotbarGroups, type EquipSlotState } from '../lib/equipment';

const MAX_ROWS_ROOMY = 2;

function columnsOf(slots: EquipSlotState[], maxRows: number): EquipSlotState[][] {
  const columns: EquipSlotState[][] = [];
  for (let i = 0; i < slots.length; i += maxRows) columns.push(slots.slice(i, i + maxRows));
  return columns;
}

function groupNaturalWidth(slotCount: number, tile: number, gap: number, pad: number, rows: number) {
  const cols = Math.ceil(slotCount / rows) || 0;
  return pad * 2 + cols * tile + Math.max(0, cols - 1) * gap;
}

export function FloatingHotbar({
  compact = false,
  forcedSingleRow = false,
  isMobile = false,
}: { compact?: boolean; forcedSingleRow?: boolean; isMobile?: boolean }) {
  const groups =
    useGameSubscription('hotbar', (msg) =>
      msg.category === 'toolbar' ? hotbarGroups(msg.data) : undefined,
    ) ?? [];

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [maxRows, setMaxRows] = useState(MAX_ROWS_ROOMY);

  const gap = compact ? 8 : 10;
  const groupGap = compact ? 8 : 10;
  const pad = compact ? 8 : 10;
  const tile = compact ? 52 : 64;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || groups.length === 0) {
      setMaxRows(forcedSingleRow ? 1 : (isMobile ? MAX_ROWS_ROOMY : MAX_ROWS_ROOMY));
      return;
    }

    const measure = () => {
      const parent = root.parentElement;
      if (!parent) return;
      const budget = parent.clientWidth;
      if (!budget) return;

      let total = 0;
      groups.forEach((g, i) => {
        total += groupNaturalWidth(g.slots.length, tile, gap, pad, MAX_ROWS_ROOMY);
        if (i > 0) total += groupGap;
      });

      if (forcedSingleRow) {
        setMaxRows(1);
      } else if (isMobile) {
        setMaxRows(MAX_ROWS_ROOMY);
      } else {
        setMaxRows(total > budget ? 1 : MAX_ROWS_ROOMY);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (root.parentElement) ro.observe(root.parentElement);
    ro.observe(root);
    return () => ro.disconnect();
  }, [groups, compact, gap, groupGap, pad, tile, forcedSingleRow, isMobile]);

  function equip(slot: EquipSlotState) {
    if (slot.itemType) sendAction('equipPrimary', { itemType: slot.itemType });
  }

  if (groups.length === 0) return null;

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'flex-start',
        justifyContent: isMobile ? 'stretch' : 'center',
        width: isMobile ? '100%' : 'auto',
        maxWidth: '100%',
        gap: groupGap,
        pointerEvents: 'auto',
        overflowX: maxRows === 1 ? 'auto' : 'visible',
      }}
    >
      {groups.map((group) => (
        <GlassPanel
          key={group.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: compact ? 6 : 8,
            padding: pad,
            flex: isMobile ? '1 1 auto' : '0 0 auto',
            minWidth: isMobile ? 0 : undefined,
          }}
        >
          <span
            className="pz-label"
            style={{
              fontSize: compact ? 9 : 10,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {group.label}
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'flex-start',
              gap,
              width: isMobile ? '100%' : 'auto',
              justifyContent: isMobile ? 'space-between' : 'flex-start',
            }}
          >
            {columnsOf(group.slots, maxRows).map((column) => (
              <div
                key={column[0]!.id}
                style={{ display: 'flex', flexDirection: 'column', gap, flex: isMobile ? '1 1 auto' : undefined }}
              >
                {column.map((slot) => (
                  <EquipTile
                    key={slot.id}
                    slot={slot}
                    variant="hotbar"
                    wide={!compact}
                    onClick={() => equip(slot)}
                  />
                ))}
              </div>
            ))}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}