import { Drawer } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { CornerBrackets } from './CornerBrackets';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import { conditionColor, type SelectableItem } from '../lib/equipment';
import { groupByItemCategory } from '../lib/itemCategories';

function ItemTile({
  item,
  size,
  onSelect,
}: {
  item: SelectableItem;
  size: number;
  onSelect: () => void;
}) {
  const iconSize = Math.round(size * 0.72);
  const bracketLength = Math.max(6, Math.round(size * 0.22));
  const dotSize = Math.max(4, Math.round(size * 0.16));

  return (
    <button
      onClick={onSelect}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: item.equipped ? 'var(--color-tile-equipped-bg)' : 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-sharp)',
        padding: 0,
        cursor: 'pointer',
      }}
      title={item.name}
      aria-label={item.name}
    >
      {item.equipped && <CornerBrackets length={bracketLength} thickness={1} inset={2} opacity={1} />}
      <ItemIcon
        icon={item.spriteIcon}
        name={item.name}
        type={item.type}
        size={iconSize}
        color="var(--color-text-secondary)"
      />
      {item.condition && (
        <span
          style={{
            position: 'absolute',
            top: 1,
            right: 1,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: conditionColor(item.condition),
          }}
        />
      )}
    </button>
  );
}

export function SelectionDrawer({
  opened,
  onClose,
  title,
  items,
  emptyMessage = 'No items.',
  onSelect,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  items: SelectableItem[];
  emptyMessage?: string;
  onSelect: (item: SelectableItem) => void;
}) {
  const isWide = useMediaQuery('(min-width: 900px)');
  const tileSize = 44;
  const labelWidth = isWide ? 104 : 84;
  const categories = groupByItemCategory(items);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={isWide ? 480 : 330}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
      transitionProps={{ transition: 'slide-left', duration: 200 }}
      styles={{
        content: {
          background: 'var(--color-glass-drawer)',
          backdropFilter: 'var(--frost-blur)',
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.55)',
        },
        body: { padding: 0, height: '100%', position: 'relative' },
      }}
    >
      <CornerBrackets length={22} thickness={2} inset={8} opacity={0.85} />
      <div style={{ padding: isWide ? '18px' : '16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 28 }}>
          <span
            className="pz-label"
            style={{
              fontSize: 18,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--color-text-primary)',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
            aria-label="Close"
          >
            <Icon name="close" size={20} color="var(--color-text-secondary)" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categories.length === 0 && (
            <div style={{ padding: '12px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              {emptyMessage}
            </div>
          )}
          {categories.map((category) => (
            <div key={category.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div
                className="pz-label"
                style={{
                  width: labelWidth,
                  flexShrink: 0,
                  paddingTop: 6,
                  fontSize: 11,
                  lineHeight: 1.25,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--color-accent)',
                }}
              >
                {category.label}
              </div>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {category.items.map((item) => (
                  <ItemTile key={item.type} item={item} size={tileSize} onSelect={() => onSelect(item)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
