import { useEffect, useRef, useState } from 'react';
import { Menu } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ContainerPane } from '../components/ContainerPane';
import { ContainerPickerDrawer } from '../components/ContainerPickerDrawer';
import { GlassPanel } from '../components/GlassPanel';
import { Icon } from '../components/Icon';
import { ItemIcon } from '../components/ItemIcon';
import { ScreenModal } from '../components/ScreenModal';
import { sendAction, useGameConnection, useGameSubscription } from '../lib/gameSocket';
import {
  ALL_TYPE,
  allContainer,
  capacityColor,
  containerIcon,
  itemWeightColor,
  playerContainer,
  selectionWeight,
} from '../lib/containers';
import type { ContainerSnapshot } from '../lib/liveTypes';

interface Selection {
  containerId: string;
  ids: number[];
}

const PENDING_TIMEOUT_MS = 8000;
const ERROR_TIMEOUT_MS = 6000;

function isCarried(container: ContainerSnapshot): boolean {
  return container.kind === 'player' || container.kind === 'bag';
}

function defaultTarget(containers: ContainerSnapshot[]): ContainerSnapshot | null {
  const real = containers.filter((container) => container.type !== ALL_TYPE);
  return real.find((container) => container.kind !== 'floor') ?? real[0] ?? null;
}

function moveBlocker(destination: ContainerSnapshot | null, selection: Selection, weight: number) {
  if (!destination) return 'No target';
  if (destination.type === ALL_TYPE) return 'Pick a container';
  if (destination.id === selection.containerId) return 'Same container';
  if (destination.locked) return 'Locked';
  if (destination.capacity >= 0 && destination.weight + weight > destination.capacity) {
    return 'No room';
  }
  return null;
}

export function InventoryScreen() {
  const isWide = useMediaQuery('(min-width: 900px)');
  const connected = useGameConnection();

  const snapshot = useGameSubscription('containers', (msg) =>
    msg.category === 'containers' ? msg.data : undefined,
  );
  const containers = snapshot?.containers ?? [];
  const carried = containers.filter(isCarried);
  const nearby = containers.filter((container) => !isCarried(container));

  const carriedTabs = [allContainer(carried, 'all:carried', 'All carried'), ...carried].filter(
    (container): container is ContainerSnapshot => container !== null,
  );
  const nearbyTabs = [allContainer(nearby, 'all:nearby', 'All nearby'), ...nearby].filter(
    (container): container is ContainerSnapshot => container !== null,
  );

  function paneContainerById(id: string | null | undefined): ContainerSnapshot | null {
    if (!id) return null;
    return [...carriedTabs, ...nearbyTabs].find((container) => container.id === id) ?? null;
  }

  const [selection, setSelection] = useState<Selection | null>(null);
  const [leftId, setLeftId] = useState('player');
  const [rightId, setRightId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const left = paneContainerById(leftId) ?? playerContainer(snapshot);
  const right = paneContainerById(rightId) ?? defaultTarget(nearbyTabs);

  const seenResultId = useRef<string | null>(null);
  const commandResult = useGameSubscription('containers:commandResult', (msg) =>
    msg.category === 'commandResult' ? msg.data : undefined,
  );

  useEffect(() => {
    if (!commandResult) return;
    if (seenResultId.current === null) {
      seenResultId.current = commandResult.id;
      return;
    }
    if (commandResult.id === seenResultId.current) return;
    seenResultId.current = commandResult.id;
    setPending(null);
    if (!commandResult.ok) setError(commandResult.error ?? 'The game refused that move.');
  }, [commandResult]);

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => setPending(null), PENDING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    if (snapshot) setPending(null);
  }, [snapshot]);

  useEffect(() => {
    if (error === null) return;
    const timer = setTimeout(() => setError(null), ERROR_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [error]);

  function activate(paneId: 'left' | 'right', containerId: string) {
    setSelection(null);
    if (paneId === 'left') setLeftId(containerId);
    else setRightId(containerId);
  }

  function select(containerId: string, ids: number[]) {
    setSelection(ids.length === 0 ? null : { containerId, ids });
  }

  const source = selection ? paneContainerById(selection.containerId) : null;
  const destination = !selection
    ? null
    : isWide
      ? selection.containerId === left?.id
        ? right
        : left
      : right;
  const weight = selection ? selectionWeight(source, selection.ids) : 0;
  const blocker = selection ? moveBlocker(destination, selection, weight) : null;
  const leftSelection = selection !== null && selection.containerId === left?.id ? selection.ids : [];
  const rightSelection = selection !== null && selection.containerId === right?.id ? selection.ids : [];

  function moveTo(target: ContainerSnapshot | null) {
    if (!selection || !target) return;
    if (moveBlocker(target, selection, weight)) return;
    sendAction('moveItems', { to: target.id, itemIds: selection.ids });
    setPending(selection.ids.length);
    setSelection(null);
  }

  function dropItems(targetId: string, source: Selection) {
    const target = paneContainerById(targetId);
    if (!target) return;
    const dropped = selectionWeight(paneContainerById(source.containerId), source.ids);
    const dropBlocker = moveBlocker(target, source, dropped);
    if (dropBlocker) {
      setError(dropBlocker);
      return;
    }
    sendAction('moveItems', { to: target.id, itemIds: source.ids });
    setPending(source.ids.length);
    setSelection(null);
  }

  const targets = selection
    ? containers.filter((container) => container.id !== selection.containerId)
    : [];
  const carriedTargets = targets.filter(isCarried);
  const nearbyTargets = targets.filter((container) => !isCarried(container));
  const useMenu = targets.length > 1;

  function moveButtonStyle(disabled: boolean) {
    return {
      height: 48,
      minWidth: 150,
      padding: '0 16px',
      cursor: disabled ? 'default' : 'pointer',
      fontSize: 12,
      letterSpacing: '0.06em',
      borderRadius: 'var(--radius-sharp)',
      color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
      background: disabled ? 'var(--color-slot-empty-fill)' : 'var(--color-accent-fill-medium)',
      border: disabled
        ? '1px solid var(--color-slot-empty-border)'
        : '1px solid var(--color-accent-border-strong)',
    } as const;
  }

  function targetMenuItem(container: ContainerSnapshot) {
    const itemBlocker = selection ? moveBlocker(container, selection, weight) : 'No target';
    return (
      <Menu.Item
        key={container.id}
        disabled={itemBlocker !== null}
        onClick={() => moveTo(container)}
        leftSection={
          container.icon ? (
            <ItemIcon
              icon={container.icon}
              name={container.name}
              type={container.type}
              size={18}
              color="var(--color-text-secondary)"
            />
          ) : (
            <Icon name={containerIcon(container.kind)} size={14} color="var(--color-text-secondary)" />
          )
        }
        rightSection={
          itemBlocker ? (
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{itemBlocker}</span>
          ) : (
            <span
              style={{ fontSize: 10, color: capacityColor(container.weight, container.capacity) }}
            >
              {container.capacity < 0
                ? `${container.weight.toFixed(1)} kg`
                : `${container.weight.toFixed(1)} / ${container.capacity}`}
            </span>
          )
        }
      >
        {container.name}
      </Menu.Item>
    );
  }

  const status = snapshot
    ? `${nearby.length} in range`
    : connected
      ? 'loading…'
      : 'offline';

  return (
    <ScreenModal contentStyle={{ width: '100%', maxWidth: isWide ? 1100 : undefined }}>
      <GlassPanel
        cornerBrackets={{ length: 20, thickness: 2, inset: 6, opacity: 0.85 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          maxHeight: '100%',
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 12px',
            flexShrink: 0,
          }}
        >
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
            Containers
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{status}</span>
        </div>

        {!snapshot && (
          <div style={{ padding: '24px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
            {connected ? 'Waiting for container data…' : 'Not connected to the dashboard server.'}
          </div>
        )}

        {snapshot && isWide && (
          <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0 }}>
            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex' }}>
              <ContainerPane
                containers={carriedTabs}
                active={left}
                onActiveChange={(id) => activate('left', id)}
                selectedIds={leftSelection}
                onSelectionChange={select}
                onDropItems={dropItems}
                compact={false}
              />
            </div>
            <div style={{ width: 1, background: 'var(--color-glass-inset)', flexShrink: 0 }} />
            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex' }}>
              <ContainerPane
                containers={nearbyTabs}
                active={right}
                onActiveChange={(id) => activate('right', id)}
                selectedIds={rightSelection}
                onSelectionChange={select}
                onDropItems={dropItems}
                compact={false}
              />
            </div>
          </div>
        )}

        {snapshot && !isWide && (
          <>
            <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0 }}>
              <ContainerPane
                containers={carriedTabs}
                active={left}
                onActiveChange={(id) => activate('left', id)}
                selectedIds={leftSelection}
                onSelectionChange={select}
                onDropItems={dropItems}
                compact
              />
            </div>
            <button
              onClick={() => setPickerOpen(true)}
              style={{
                height: 48,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                cursor: 'pointer',
                background: 'transparent',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                borderTop: '1px solid var(--color-glass-inset)',
              }}
            >
              <span
                className="pz-label"
                style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--color-text-tertiary)' }}
              >
                Move to
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: 'var(--color-text-primary)',
                }}
              >
                {right &&
                  (right.icon ? (
                    <ItemIcon
                      icon={right.icon}
                      name={right.name}
                      type={right.type}
                      size={18}
                      color="var(--color-text-secondary)"
                    />
                  ) : (
                    <Icon name={containerIcon(right.kind)} size={16} color="var(--color-text-secondary)" />
                  ))}
                {right?.name ?? 'Nothing in range'}
              </span>
            </button>
          </>
        )}

        {error && (
          <div
            style={{
              padding: '8px 24px',
              fontSize: 12,
              color: 'var(--color-danger)',
              flexShrink: 0,
            }}
          >
            {error}
          </div>
        )}

        {(selection || pending !== null) && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '12px 24px',
              borderTop: '1px solid var(--color-glass-inset)',
            }}
          >
            {pending !== null ? (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                Moving {pending} item{pending === 1 ? '' : 's'}…
              </span>
            ) : (
              <>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {selection?.ids.length} selected ·{' '}
                  <span style={{ color: itemWeightColor(weight) }}>{weight.toFixed(1)} kg</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setSelection(null)}
                    style={{
                      height: 44,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                    }}
                    className="pz-label"
                  >
                    Clear
                  </button>
                  {useMenu ? (
                    <Menu position="top-end" withinPortal shadow="md" width={isWide ? 520 : 320}>
                      <Menu.Target>
                        <button className="pz-label" style={moveButtonStyle(false)}>
                          Move to…
                        </button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: '1 1 0', minWidth: 0 }}>
                            <Menu.Label>Player inventory</Menu.Label>
                            {carriedTargets.length === 0 ? (
                              <Menu.Item disabled>None</Menu.Item>
                            ) : (
                              carriedTargets.map(targetMenuItem)
                            )}
                          </div>
                          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-glass-inset)' }} />
                          <div style={{ flex: '1 1 0', minWidth: 0 }}>
                            <Menu.Label>Nearby</Menu.Label>
                            {nearbyTargets.length === 0 ? (
                              <Menu.Item disabled>Nothing in range</Menu.Item>
                            ) : (
                              nearbyTargets.map(targetMenuItem)
                            )}
                          </div>
                        </div>
                      </Menu.Dropdown>
                    </Menu>
                  ) : (
                    <button
                      onClick={() => moveTo(destination)}
                      disabled={blocker !== null}
                      className="pz-label"
                      style={moveButtonStyle(blocker !== null)}
                    >
                      {blocker ?? `Move → ${destination?.name ?? ''}`}
                    </button>
                  )}
                </span>
              </>
            )}
          </div>
        )}
      </GlassPanel>

      <ContainerPickerDrawer
        opened={pickerOpen && !isWide}
        onClose={() => setPickerOpen(false)}
        containers={nearby}
        selectedId={right?.id ?? null}
        onSelect={(id) => activate('right', id)}
      />
    </ScreenModal>
  );
}
