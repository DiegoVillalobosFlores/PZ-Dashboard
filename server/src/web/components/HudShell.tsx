import { useState } from 'react';
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
export function HudShell() {
  const isWide = useMediaQuery('(min-width: 900px)');
  const currentId = useCurrentDestinationId();
  const [annotationsOpen, setAnnotationsOpen] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--color-bg-app)',
      }}
    >
      <MapCanvas pins={mockMapPins} />

      {isWide ? (
        <>
          <div style={{ position: 'absolute', top: 24, left: 116 }}>
            <ConditionCluster compact={false} />
          </div>
          <div style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)' }}>
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

      <div style={{ position: 'absolute', bottom: isWide ? 40 : 24, left: '50%', transform: 'translateX(-50%)' }}>
        <FloatingHotbar compact={!isWide} />
      </div>

      <AnnotationsDrawer opened={annotationsOpen} onClose={() => setAnnotationsOpen(false)} />
    </div>
  );
}
