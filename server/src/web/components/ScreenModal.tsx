import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useModalContext } from './ModalContext';

export function ScreenModal({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: CSSProperties;
}) {
  const { registerModal } = useModalContext();

  useEffect(() => {
    return registerModal();
  }, [registerModal]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 'calc(var(--hud-top-inset) + 24px)',
        paddingBottom: 'calc(var(--hud-hotbar-inset) + 24px)',
        paddingLeft: 'var(--hud-left-inset, 24px)',
        paddingRight: 'var(--hud-right-inset, 24px)',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
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