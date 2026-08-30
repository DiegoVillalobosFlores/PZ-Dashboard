import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import { AnnotationsDrawer } from './AnnotationsDrawer';
import { ConditionCluster } from './ConditionCluster';
import { FloatingHotbar } from './FloatingHotbar';
import { HudIconButton } from './HudIconButton';
import { MapCanvas } from './MapCanvas';
import { MOBILE_NAV_HEIGHT, QuickNav, useCurrentDestinationId } from './QuickNav';
import { mockMapPins } from '../mock/gameState';
import { ModalProvider, useModalContext } from './ModalContext';
import { useServerConnection } from '../lib/gameSocket';

const HOTBAR_CLEARANCE = 16;
const TOP_CLEARANCE = 12;
const TOP_INSET = { wide: 88, compact: 76 };
const LEFT_INSET = { wide: 112, compact: 12 };
// Mobile hides the right-edge map buttons entirely, so it only needs a
// screen-edge margin rather than room to clear them.
const RIGHT_INSET = { wide: 80, compact: 12 };

function HudShellInner() {
  const isWide = useMediaQuery('(min-width: 900px)');
  const currentId = useCurrentDestinationId();
  const navigate = useNavigate();
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hotbarRef = useRef<HTMLDivElement | null>(null);
  const topClusterRef = useRef<HTMLDivElement | null>(null);
  const { isModalOpen } = useModalContext();
  const connection = useServerConnection();
  // Mobile hotbar always clears the persistent bottom tab bar; the wide
  // layout has no bottom bar (nav lives in the left rail) so it only needs
  // to clear the screen edge.
  const hotbarBottom = isWide ? 40 : MOBILE_NAV_HEIGHT + 10;
  const hotbarForcedSingleRow = isModalOpen;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  useEffect(() => {
    const shell = shellRef.current;
    const hotbar = hotbarRef.current;
    if (!shell || !hotbar) return;

    const observer = new ResizeObserver(() => {
      const { height } = hotbar.getBoundingClientRect();
      const inset = height ? height + hotbarBottom + HOTBAR_CLEARANCE : 0;
      shell.style.setProperty('--hud-hotbar-inset', `${Math.round(inset)}px`);
    });
    observer.observe(hotbar);
    return () => observer.disconnect();
  }, [hotbarBottom]);

  useEffect(() => {
    const shell = shellRef.current;
    const cluster = topClusterRef.current;
    if (!shell || !cluster) return;

    const fallback = isWide ? TOP_INSET.wide : TOP_INSET.compact;
    const observer = new ResizeObserver(() => {
      const { bottom } = cluster.getBoundingClientRect();
      const inset = bottom > 0 ? bottom + TOP_CLEARANCE : fallback;
      shell.style.setProperty('--hud-top-inset', `${Math.round(inset)}px`);
    });
    observer.observe(cluster);
    return () => observer.disconnect();
  }, [isWide]);

  return (
    <div
      ref={shellRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--color-bg-app)',
        '--hud-hotbar-inset': '0px',
        '--hud-top-inset': `${isWide ? TOP_INSET.wide : TOP_INSET.compact}px`,
        '--hud-left-inset': `${isWide ? LEFT_INSET.wide : LEFT_INSET.compact}px`,
        '--hud-right-inset': `${isWide ? RIGHT_INSET.wide : RIGHT_INSET.compact}px`,
      } as CSSProperties}
    >
      <MapCanvas pins={mockMapPins} />
      {isWide ? (
        <>
          <div ref={topClusterRef} style={{ position: 'absolute', top: 24, left: 116, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <ConditionCluster compact={false} />
            {(!connection.connected || !connection.modConnected) && <ConnectionStatus connected={connection.connected} />}
          </div>
          <div style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
            <QuickNav currentId={currentId} />
          </div>
        </>
      ) : (
        <>
          <div
            ref={topClusterRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <ConditionCluster compact />
            {(!connection.connected || !connection.modConnected) && <ConnectionStatus connected={connection.connected} />}
          </div>
          <QuickNav currentId={currentId} />
        </>
      )}

      {(isWide || !isModalOpen) && (
        <div style={{ position: 'absolute', right: 20, bottom: 'calc(var(--hud-hotbar-inset) + 12px)' }}>
          <HudIconButton icon="map-pinned" label="Map notes" onClick={() => setAnnotationsOpen(true)} />
        </div>
      )}

      <Outlet />

      <div
        ref={hotbarRef}
        style={{
          position: 'absolute',
          bottom: hotbarBottom,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <FloatingHotbar compact={!isWide} forcedSingleRow={hotbarForcedSingleRow} isMobile={!isWide} />
      </div>

      <AnnotationsDrawer opened={annotationsOpen} onClose={() => setAnnotationsOpen(false)} />
    </div>
  );
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(0,0,0,.55)', color: '#ffb3b3', fontSize: 12 }}>
      {connected ? 'Mod disconnected' : 'Server disconnected'}
    </div>
  );
}

export function HudShell() {
  return (
    <ModalProvider>
      <HudShellInner />
    </ModalProvider>
  );
}
