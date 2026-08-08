import type { CSSProperties, ReactNode } from 'react';

export function GlassPanel({
  children,
  bg = 'var(--color-glass-panel)',
  borderOpacity = 0.35,
  style,
  onClick,
}: {
  children: ReactNode;
  bg?: string;
  borderOpacity?: number;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: `1px solid rgba(247, 103, 7, ${borderOpacity})`,
        borderRadius: 'var(--radius-sharp)',
        backdropFilter: 'var(--frost-blur)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
