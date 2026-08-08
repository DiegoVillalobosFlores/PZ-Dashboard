import { CornerBrackets } from './CornerBrackets';
import { Icon } from './Icon';

// The map layer's floating controls (recenter, map notes), drawn in the same
// v9 "scanner HUD" language as the status pill and the skills panel: opaque
// --color-bg-app, sharp corners, accent bracket frame - not the translucent
// GlassPanel they used to be.
export const HUD_ICON_BUTTON_SIZE = 44;

export function HudIconButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: 'relative',
        width: HUD_ICON_BUTTON_SIZE,
        height: HUD_ICON_BUTTON_SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-app)',
        border: 'none',
        borderRadius: 'var(--radius-sharp)',
        boxShadow: '0 3px 16px rgba(0, 0, 0, 0.4)',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <CornerBrackets length={10} thickness={2} inset={3} opacity={0.85} />
      <Icon name={icon} size={20} color="var(--color-accent)" />
    </button>
  );
}
