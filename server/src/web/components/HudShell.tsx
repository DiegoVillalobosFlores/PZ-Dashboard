import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import { AnnotationsDrawer } from './AnnotationsDrawer';
import { ConditionCluster } from './ConditionCluster';
import { FloatingHotbar } from './FloatingHotbar';
import { HudIconButton } from './HudIconButton';
import { MapCanvas } from './MapCanvas';
import { QuickNav, useCurrentDestinationId } from './QuickNav';
import { mockMapPins } from '../mock/gameState';

// The app's layout route: everything here - the map behind the HUD, the vitals
// pill, the nav rail, the hotbar - stays mounted across navigation, so the map
// holds its pan/zoom and marker easing and the socket-backed widgets never
// re-subscribe just because the player switched screens. Only <Outlet /> swaps.
//
// Deliberately holds no game state: each child subscribes to the shared socket
// itself (see lib/gameSocket.ts), so nothing gets threaded through here.
const HOTBAR_CLEARANCE = 16;
const TOP_INSET = { wide: 88, compact: 104 };

export function HudShell() {
  const isWide = useMediaQuery('(min-width: 900px)');
  const currentId = useCurrentDestinationId();
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hotbarRef = useRef<HTMLDivElement | null>(null);
  const hotbarBottom = isWide ? 40 : 24;

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
      } as CSSProperties}
    >
      <MapCanvas pins={mockMapPins} />

      {isWide ? (
        <>
          <div style={{ position: 'absolute', top: 24, left: 116, zIndex: 2 }}>
            <ConditionCluster compact={false} />
          </div>
          <div style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
            <QuickNav currentId={currentId} />
          </div>
        </>
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            zIndex: 2,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <ConditionCluster compact />
          <QuickNav currentId={currentId} />
        </div>
      )}

      <div style={{ position: 'absolute', right: 20, bottom: 132 }}>
        <HudIconButton icon="map-pinned" label="Map notes" onClick={() => setAnnotationsOpen(true)} />
      </div>

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
        <FloatingHotbar compact={!isWide} />
      </div>

      <AnnotationsDrawer opened={annotationsOpen} onClose={() => setAnnotationsOpen(false)} />
    </div>
  );
}
