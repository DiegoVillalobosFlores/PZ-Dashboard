import { useMediaQuery } from '@mantine/hooks';
import { GlassPanel } from '../components/GlassPanel';
import { ItemIcon } from '../components/ItemIcon';
import { ScreenModal } from '../components/ScreenModal';
import { sendAction, useGameConnection, useGameSubscription } from '../lib/gameSocket';
import { groupByItemCategory } from '../lib/itemCategories';
import type { InventoryItemSnapshot } from '../lib/liveTypes';

function InventoryRow({ item, onDrop }: { item: InventoryItemSnapshot; onDrop: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-row)',
        }}
      >
        <ItemIcon icon={item.icon} name={item.name} type={item.type} size={28} color="var(--color-text-secondary)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
          {item.name}
          {item.count > 1 ? ` ×${item.count}` : ''}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          {item.weight.toFixed(1)} kg · condition {Math.round(item.condition)}
        </div>
      </div>
      <button
        onClick={onDrop}
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.14)',
          color: 'var(--color-text-secondary)',
          fontSize: 10,
          letterSpacing: '0.06em',
          padding: '6px 10px',
          cursor: 'pointer',
        }}
        className="pz-label"
      >
        Drop
      </button>
    </div>
  );
}

function CategoryHeading({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        background: 'var(--color-glass-72)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span
        className="pz-label"
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--color-text-secondary)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{count}</span>
    </div>
  );
}

export function InventoryScreen() {
  const isWide = useMediaQuery('(min-width: 900px)');
  const connected = useGameConnection();
  const inventory = useGameSubscription('inventory', (msg) =>
    msg.category === 'inventory' ? msg.data : undefined,
  );
  const categories = groupByItemCategory(inventory?.items ?? []);

  return (
    <ScreenModal contentStyle={{ width: isWide ? 480 : 340 }}>
      <GlassPanel
        style={{ display: 'flex', flexDirection: 'column', width: '100%', maxHeight: '100%', minHeight: 0 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 12px',
          }}
        >
          <span style={{ fontSize: 14, letterSpacing: '0.08em', color: 'var(--color-text-primary)' }} className="pz-label">
            Inventory
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            {inventory ? `${inventory.weight.toFixed(1)} / ${inventory.capacity} kg` : connected ? 'loading…' : 'offline'}
          </span>
        </div>
        <div style={{ overflowY: 'auto' }}>
          {!inventory && (
            <div style={{ padding: '24px 16px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              {connected ? 'Waiting for inventory data…' : 'Not connected to the dashboard server.'}
            </div>
          )}
          {inventory && categories.length === 0 && (
            <div style={{ padding: '24px 16px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Nothing carried.
            </div>
          )}
          {categories.map((category) => (
            <div key={category.key}>
              <CategoryHeading label={category.label} count={category.items.length} />
              {category.items.map((item, index) => (
                <InventoryRow
                  key={`${item.type}-${index}`}
                  item={item}
                  onDrop={() => sendAction('dropItem', { itemType: item.type })}
                />
              ))}
            </div>
          ))}
        </div>
      </GlassPanel>
    </ScreenModal>
  );
}
