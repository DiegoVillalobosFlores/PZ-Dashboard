import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useModalContext } from './ModalContext';

export function ScreenModal({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: CSSProperties;
}) {
  const { registerModal } = useModalContext();
  const isWide = useMediaQuery('(min-width: 900px)');
  // Mobile has no side rails or floating buttons left to clear, so the
  // modal only needs enough clearance to stay off the condition bar and
  // hotbar/nav - not the desktop layout's generous fixed breathing room.
  const clearance = isWide ? 24 : 8;

  useEffect(() => {
    return registerModal();
  }, [registerModal]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        // stretch (not center) so this container's height is a definite
        // used value - a percentage max-height on a descendant (e.g.
        // GlassPanel's maxHeight: '100%') only resolves against an ancestor
        // with a definite height, and align-items: center left this box
        // auto-sized to its own content, silently turning every nested
        // maxHeight/overflow: auto below it into a no-op that just got
        // hard-clipped instead of scrolling.
        alignItems: 'stretch',
        justifyContent: 'center',
        paddingTop: `calc(var(--hud-top-inset) + ${clearance}px)`,
        paddingBottom: `calc(var(--hud-hotbar-inset) + ${clearance}px)`,
        paddingLeft: `var(--hud-left-inset, ${clearance}px)`,
        paddingRight: `var(--hud-right-inset, ${clearance}px)`,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '100%',
          maxHeight: '100%',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}