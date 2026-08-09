import { useState } from 'react';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import { conditionColor, conditionFrom } from '../lib/equipment';
import { ALL_TYPE, capacityColor, containerIcon, itemWeightColor } from '../lib/containers';
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
  onDropItems,
  compact,
}: {
  containers: ContainerSnapshot[];
  active: ContainerSnapshot | null;
  onActiveChange: (containerId: string) => void;
  selectedIds: number[];
  onSelectionChange: (containerId: string, ids: number[]) => void;
  onDropItems: (targetId: string, source: { containerId: string; ids: number[] }) => void;
  compact: boolean;
}) {
  const groups = active ? groupByItemCategory(active.items) : [];
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function startDrag(event: React.DragEvent, itemId: number) {
    if (!active) return;
    const ids = selectedIds.includes(itemId) ? selectedIds : [itemId];
    event.dataTransfer.setData('application/pz-items', JSON.stringify({ containerId: active.id, ids }));
    event.dataTransfer.effectAllowed = 'move';
  }

  function acceptDrag(event: React.DragEvent, targetId: string) {
    if (!event.dataTransfer.types.includes('application/pz-items')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverId(targetId);
  }

  function handleDrop(event: React.DragEvent, targetId: string) {
    const raw = event.dataTransfer.getData('application/pz-items');
    setDragOverId(null);
    if (!raw) return;
    event.preventDefault();
    const source = JSON.parse(raw) as { containerId: string; ids: number[] };
    if (source.containerId === targetId) return;
    onDropItems(targetId, source);
  }

  function toggle(id: number) {
    if (!active) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((selected) => selected !== id)
      : [...selectedIds, id];
    onSelectionChange(active.id, next);
  }

  function toggleGroup(ids: number[]) {
    if (!active) return;
    const allSelected = ids.every((id) => selectedIds.includes(id));
    const next = allSelected
      ? selectedIds.filter((id) => !ids.includes(id))
      : [...selectedIds, ...ids.filter((id) => !selectedIds.includes(id))];
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
            const droppable = !container.locked && container.type !== ALL_TYPE;
            return (
              <button
                key={container.id}
                onClick={() => onActiveChange(container.id)}
                onDragOver={(event) => droppable && acceptDrag(event, container.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(event) => droppable && handleDrop(event, container.id)}
                title={container.name}
                aria-label={container.name}
                aria-pressed={isActive}
                style={{
                  position: 'relative',
                  height: compact ? 44 : 48,
                  outline:
                    dragOverId === container.id ? '2px solid var(--color-accent-border-strong)' : 'none',
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
                {container.type === ALL_TYPE ? (
                  <Icon
                    name="layers"
                    size={20}
                    color={isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                  />
                ) : container.icon ? (
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
          <span
            style={{
              fontSize: 11,
              color: active ? capacityColor(active.weight, active.capacity) : 'var(--color-text-tertiary)',
              flexShrink: 0,
            }}
          >
            {active ? capacityLabel(active) : ''}
          </span>
        </div>
      </div>

      <div
        onDragOver={(event) => active && !active.locked && active.type !== ALL_TYPE && acceptDrag(event, active.id)}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(event) => active && !active.locked && active.type !== ALL_TYPE && handleDrop(event, active.id)}
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          padding: '6px 0',
          background:
            active && dragOverId === active.id ? 'var(--color-accent-fill-medium)' : 'transparent',
        }}
      >
        {groups.length === 0 && (
          <div style={{ padding: '16px 12px', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            Empty.
          </div>
        )}
        {groups.map((group) => {
          const groupIds = group.items.map((item) => item.id);
          const allSelected = groupIds.every((id) => selectedIds.includes(id));
          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(groupIds)}
                aria-pressed={allSelected}
                className="pz-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  width: '100%',
                  padding: compact ? '10px 24px 6px' : '10px 16px 6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 11,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--color-accent)',
                }}
              >
                <span>{group.label}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>
                  {allSelected ? 'None' : 'All'}
                </span>
              </button>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 76 : 84}px, 1fr))`,
                  gap: 8,
                  padding: compact ? '0 24px 8px' : '0 16px 8px',
                }}
              >
                {group.items.map((item) => {
                  const selected = selectedIds.includes(item.id);
                  const condition = conditionFrom(item.condition, item.conditionMax);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      draggable
                      onDragStart={(event) => startDrag(event, item.id)}
                      title={item.name}
                      aria-pressed={selected}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 4,
                        minHeight: compact ? 88 : 92,
                        padding: '8px 4px 6px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sharp)',
                        border: selected
                          ? '1px solid var(--color-accent-border-strong)'
                          : '1px solid var(--color-border-default)',
                        background: selected
                          ? 'var(--color-accent-fill-medium)'
                          : 'var(--color-glass-inset)',
                        color: 'var(--color-text-primary)',
                        fontSize: 11,
                      }}
                    >
                      <ItemIcon
                        icon={item.icon}
                        name={item.name}
                        type={item.type}
                        size={28}
                        color={selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                      />
                      <span
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.2,
                          textAlign: 'center',
                          wordBreak: 'break-word',
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          marginTop: 'auto',
                          fontSize: 10,
                          color: itemWeightColor(item.weight),
                        }}
                      >
                        {item.weight.toFixed(1)} kg
                      </span>
                      {item.count > 1 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 4,
                            fontSize: 10,
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          ×{item.count}
                        </span>
                      )}
                      {item.equipped && (
                        <span
                          title="Equipped"
                          style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex' }}
                        >
                          <Icon name="hand" size={12} color="var(--color-accent)" />
                        </span>
                      )}
                      {condition && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: conditionColor(condition),
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
