export function Divider({
  height,
  orientation = 'vertical',
}: {
  height?: number;
  orientation?: 'vertical' | 'horizontal';
}) {
  const vertical = orientation === 'vertical';
  return (
    <span
      style={{
        width: vertical ? 1 : '100%',
        height: vertical ? height : 1,
        alignSelf: vertical && height === undefined ? 'stretch' : undefined,
        flexShrink: 0,
        background: 'var(--color-border-default)',
        opacity: 0.5,
      }}
    />
  );
}
