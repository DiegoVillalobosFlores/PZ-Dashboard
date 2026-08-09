import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import { conditionColor, conditionFrom } from '../lib/equipment';
import { containerIcon } from '../lib/containers';
import { groupByItemCategory } from '../lib/itemCategories';
import type { ContainerSnapshot } from '../lib/liveTypes';

function capacityLabel(container: ContainerSnapshot): string {
  if (container.capacity < 0) return `${container.weight.toFixed(1)} kg`;
  return `${container.weight.toFixed(1)} / ${container.capacity} kg`;
}

export function ContainerPane({
  containers,
  active,
  onActiveChange,
  selectedIds,
  onSelectionChange,
  compact,
}: {
  containers: ContainerSnapshot[];
  active: ContainerSnapshot | null;
  onActiveChange: (containerId: string) => void;
  selectedIds: number[];
  onSelectionChange: (containerId: string, ids: number[]) => void;
  compact: boolean;
}) {
  const groups = active ? groupByItemCategory(active.items) : [];

  function toggle(id: number) {
    if (!active) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((selected) => selected !== id)
      : [...selectedIds, id];
    onSelectionChange(active.id, next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0, minHeight: 0 }}>
      <div
        style={{
          flexShrink: 0,
          borderBottom: '1px solid var(--color-glass-inset)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 44 : 48}px, 1fr))`,
            gap: 8,
            padding: compact ? '8px 24px' : '8px 16px',
          }}
        >
          {containers.map((container) => {
            const isActive = container.id === active?.id;
            return (
              <button
                key={container.id}
                onClick={() => onActiveChange(container.id)}
                title={container.name}
                aria-label={container.name}
                aria-pressed={isActive}
                style={{
                  position: 'relative',
                  height: compact ? 44 : 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  borderRadius: 'var(--radius-sharp)',
                  border: isActive
                    ? '1px solid var(--color-accent-border-strong)'
                    : '1px solid var(--color-border-default)',
                  background: isActive ? 'var(--color-accent-fill-medium)' : 'var(--color-glass-inset)',
                }}
              >
                {container.icon ? (
                  <ItemIcon
                    icon={container.icon}
                    name={container.name}
                    type={container.type}
                    size={24}
                    color={isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                  />
                ) : (
                  <Icon
                    name={containerIcon(container.kind)}
                    size={20}
                    color={isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                  />
                )}
                {container.locked && (
                  <span style={{ position: 'absolute', top: 2, right: 2, display: 'flex' }}>
                    <Icon name="lock" size={10} color="var(--color-text-tertiary)" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: compact ? '0 24px 10px' : '0 16px 10px',
          }}
        >
          <span
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 13,
              color: 'var(--color-text-primary)',
            }}
          >
            {active?.name ?? 'Nothing in range'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
            {active ? capacityLabel(active) : ''}
          </span>
        </div>
      </div>

      <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '6px 0' }}>
        {groups.length === 0 && (
          <div style={{ padding: '16px 12px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            Empty.
          </div>
        )}
        {groups.map((group) => (
          <div key={group.key}>
            <div
              className="pz-label"
              style={{
                padding: compact ? '10px 24px 4px' : '10px 16px 4px',
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--color-accent)',
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const selected = selectedIds.includes(item.id);
              const condition = conditionFrom(item.condition, item.conditionMax);
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    height: compact ? 44 : 38,
                    padding: compact ? '0 22px' : '0 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: 'none',
                    borderLeft: selected
                      ? '2px solid var(--color-accent-border-strong)'
                      : '2px solid transparent',
                    background: selected ? 'var(--color-accent-fill-medium)' : 'transparent',
                    color: 'var(--color-text-primary)',
                    fontSize: 13,
                  }}
                >
                  <ItemIcon
                    icon={item.icon}
                    name={item.name}
                    type={item.type}
                    size={20}
                    color="var(--color-text-secondary)"
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                    {item.count > 1 ? ` ×${item.count}` : ''}
                  </span>
                  {condition && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: conditionColor(condition),
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                    {item.weight.toFixed(1)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
