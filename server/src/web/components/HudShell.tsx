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
import { ModalProvider, useModalContext } from './ModalContext';

const HOTBAR_CLEARANCE = 16;
const TOP_INSET = { wide: 88, compact: 104 };
const LEFT_INSET = { wide: 112, compact: 24 };
const RIGHT_INSET = 80;

function HudShellInner() {
  const isWide = useMediaQuery('(min-width: 900px)');
  const currentId = useCurrentDestinationId();
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hotbarRef = useRef<HTMLDivElement | null>(null);
  const { isModalOpen } = useModalContext();
  const hotbarBottom = isModalOpen ? 4 : (isWide ? 40 : 0);
  const hotbarForcedSingleRow = isModalOpen;

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
        '--hud-left-inset': `${isWide ? LEFT_INSET.wide : LEFT_INSET.compact}px`,
        '--hud-right-inset': `${RIGHT_INSET}px`,
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
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
            paddingTop: 8,
            paddingLeft: 8,
            paddingRight: 8,
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
        <FloatingHotbar compact={!isWide} forcedSingleRow={hotbarForcedSingleRow} isMobile={!isWide} />
      </div>

      <AnnotationsDrawer opened={annotationsOpen} onClose={() => setAnnotationsOpen(false)} />
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