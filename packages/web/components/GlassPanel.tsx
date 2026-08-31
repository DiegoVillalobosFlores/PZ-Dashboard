import type { CSSProperties, ReactNode } from 'react';
import { CornerBrackets } from './CornerBrackets';

export function GlassPanel({
  children,
  bg = 'var(--color-glass-panel)',
  style,
  onClick,
  cornerBrackets,
}: {
  children: ReactNode;
  bg?: string;
  style?: CSSProperties;
  onClick?: () => void;
  cornerBrackets?: { length: number; thickness?: number; inset: number; opacity?: number };
}) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: bg,
        borderRadius: 'var(--radius-sharp)',
        backdropFilter: 'var(--frost-blur)',
        boxShadow: 'var(--shadow-float)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {cornerBrackets && (
        <CornerBrackets
          length={cornerBrackets.length}
          thickness={cornerBrackets.thickness ?? 2}
          inset={cornerBrackets.inset}
          opacity={cornerBrackets.opacity ?? 0.85}
        />
      )}
      {children}
    </div>
  );
}
