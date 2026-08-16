import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { EquipTile } from './EquipTile';
import { GlassPanel } from './GlassPanel';
import { Divider } from './Divider';
import { sendAction, useGameSubscription } from '../lib/gameSocket';
import { hotbarGroups, type EquipSlotState } from '../lib/equipment';

const MAX_ROWS_ROOMY = 1;

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
  const pad = compact ? 8 : 10;
  const tile = compact ? 52 : 64;

  useLayoutEffect(() => {
    // Mobile always lays tiles out in a single scrollable row - see the
    // dedicated branch below - so the natural-width measurement below only
    // matters for the wide layout's 1-vs-2-row decision.
    if (isMobile) return;

    const root = rootRef.current;
    if (!root || groups.length === 0) {
      setMaxRows(MAX_ROWS_ROOMY);
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
        if (i > 0) total += 1;
      });

      setMaxRows(forcedSingleRow || total > budget ? 1 : MAX_ROWS_ROOMY);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (root.parentElement) ro.observe(root.parentElement);
    ro.observe(root);
    return () => ro.disconnect();
  }, [groups, compact, gap, pad, tile, forcedSingleRow, isMobile]);

  function equip(slot: EquipSlotState) {
    if (slot.itemType) sendAction('equipPrimary', { itemType: slot.itemType });
  }

  if (groups.length === 0) return null;

  // Mobile: every group shares one glass strip instead of a separate panel
  // each - three headers plus three double-height tile columns was the
  // single biggest chunk of vertical space the mobile HUD gave up. A single
  // row of tiles per group, divided by hairlines rather than full panels,
  // cuts that roughly in half and scrolls horizontally if it overflows.
  if (isMobile) {
    return (
      <div
        ref={rootRef}
        style={{
          width: '100%',
          pointerEvents: 'auto',
          overflowX: 'auto',
        }}
      >
        <GlassPanel
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            padding: '4px 6px',
            width: 'max-content',
            minWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {groups.map((group, i) => (
            <Fragment key={group.id}>
              {i > 0 && (
                <Divider />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span
                  className="pz-label"
                  style={{
                    fontSize: 8,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {group.label}
                </span>
                <div style={{ display: 'flex', flexDirection: 'row', gap: 0 }}>
                  {group.slots.map((slot) => (
                    <EquipTile key={slot.id} slot={slot} variant="hotbar" wide={false} onClick={() => equip(slot)} />
                  ))}
                </div>
              </div>
            </Fragment>
          ))}
        </GlassPanel>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'flex-start',
        justifyContent: 'center',
        width: 'auto',
        maxWidth: '100%',
        pointerEvents: 'auto',
        overflowX: maxRows === 1 ? 'auto' : 'visible',
      }}
    >
      {groups.map((group, i) => (
        <Fragment key={group.id}>
          {i > 0 && (
            <Divider />
          )}
          <GlassPanel
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: compact ? 6 : 8,
              padding: pad,
              flex: '0 0 auto',
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
              width: 'auto',
              justifyContent: 'flex-start',
            }}
          >
            {columnsOf(group.slots, maxRows).map((column) => (
              <div key={column[0]!.id} style={{ display: 'flex', flexDirection: 'column', gap: maxRows > 1 ? gap : 0 }}>
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
        </Fragment>
      ))}
    </div>
  );
}
