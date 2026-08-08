import type { CSSProperties, ReactNode } from 'react';

export function ScreenModal({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: '100%',
          maxHeight: 'calc(100dvh - var(--hud-top-inset) - var(--hud-hotbar-inset))',
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
