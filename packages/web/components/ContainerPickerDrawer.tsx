import { Drawer } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { CornerBrackets } from './CornerBrackets';
import { Icon } from './Icon';
import { ItemIcon } from './ItemIcon';
import { capacityColor, containerIcon } from '../lib/containers';
import type { ContainerSnapshot } from '../lib/liveTypes';

export function ContainerPickerDrawer({
  opened,
  onClose,
  containers,
  selectedId,
  onSelect,
}: {
  opened: boolean;
  onClose: () => void;
  containers: ContainerSnapshot[];
  selectedId: string | null;
  onSelect: (containerId: string) => void;
}) {
  const isWide = useMediaQuery('(min-width: 900px)');

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
          background: 'var(--color-glass-panel)',
          backdropFilter: 'var(--frost-blur)',
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.4)',
        },
        body: { padding: 0, height: '100%', position: 'relative' },
      }}
    >
      <CornerBrackets length={22} thickness={2} inset={8} opacity={0.85} />
      <div
        style={{
          padding: isWide ? '18px' : '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          height: '100%',
        }}
      >
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
            Move to
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
            aria-label="Close"
          >
            <Icon name="close" size={20} color="var(--color-text-secondary)" />
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {containers.length === 0 && (
            <div style={{ padding: '12px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Nothing in range.
            </div>
          )}
          {containers.map((container) => {
            const selected = container.id === selectedId;
            return (
              <button
                key={container.id}
                onClick={() => {
                  onSelect(container.id);
                  onClose();
                }}
                disabled={container.locked}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 48,
                  padding: '0 12px',
                  cursor: container.locked ? 'default' : 'pointer',
                  textAlign: 'left',
                  borderRadius: 'var(--radius-sharp)',
                  border: selected
                    ? '1px solid var(--color-accent-border-strong)'
                    : '1px solid var(--color-border-default)',
                  background: selected ? 'var(--color-accent-fill-medium)' : 'var(--color-bg-surface)',
                  color: container.locked ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                  fontSize: 13,
                }}
              >
                {container.icon ? (
                  <ItemIcon
                    icon={container.icon}
                    name={container.name}
                    type={container.type}
                    size={22}
                    color="var(--color-text-secondary)"
                  />
                ) : (
                  <Icon name={containerIcon(container.kind)} size={18} color="var(--color-text-secondary)" />
                )}
                <span
                  style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {container.name}
                </span>
                {container.locked && <Icon name="lock" size={14} color="var(--color-text-tertiary)" />}
                <span
                  style={{
                    fontSize: 11,
                    color: capacityColor(container.weight, container.capacity),
                    flexShrink: 0,
                  }}
                >
                  {container.capacity < 0
                    ? `${container.weight.toFixed(1)} kg`
                    : `${container.weight.toFixed(1)} / ${container.capacity}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
}
