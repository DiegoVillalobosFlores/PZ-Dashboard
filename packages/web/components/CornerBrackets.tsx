import type { CSSProperties } from 'react';

// Targeting-reticle corner frame used by the v8 "scanner HUD" surfaces
// (weapon/clothing drawers, hand-equipment widget) instead of a soft
// rounded stroke. Parent must be `position: relative`.
export function CornerBrackets({
  length,
  thickness = 2,
  inset,
  opacity = 1,
  color = 'var(--color-accent)',
}: {
  length: number;
  thickness?: number;
  inset: number;
  opacity?: number;
  color?: string;
}) {
  const tick = (style: CSSProperties): CSSProperties => ({
    position: 'absolute',
    background: color,
    opacity,
    pointerEvents: 'none',
    ...style,
  });

  return (
    <>
      <div style={tick({ top: inset, left: inset, width: thickness, height: length })} />
      <div style={tick({ top: inset, left: inset, width: length, height: thickness })} />
      <div style={tick({ top: inset, right: inset, width: thickness, height: length })} />
      <div style={tick({ top: inset, right: inset, width: length, height: thickness })} />
      <div style={tick({ bottom: inset, left: inset, width: thickness, height: length })} />
      <div style={tick({ bottom: inset, left: inset, width: length, height: thickness })} />
      <div style={tick({ bottom: inset, right: inset, width: thickness, height: length })} />
      <div style={tick({ bottom: inset, right: inset, width: length, height: thickness })} />
    </>
  );
}
