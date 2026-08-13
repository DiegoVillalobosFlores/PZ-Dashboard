import { useState } from 'react';
import { apiBase } from '../lib/api';
import { Icon } from './Icon';
import { iconForItem } from '../lib/itemIcon';

// Real in-game sprite when the mod reports one (item:getTex():getName(),
// cropped on demand out of the game's own texture atlases by
// /game-icons/<name>.png) - falls back to the lucide keyword-guess icon when
// there's no icon name or the sprite 404s (e.g. a texture only a mod's own
// pack has, or a stale mod build).
export function ItemIcon({
  icon,
  name,
  type,
  size = 24,
  color,
}: {
  icon?: string;
  name: string;
  type?: string;
  size?: number;
  color?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (icon && !failed) {
    return (
      <img
        src={`${apiBase()}/game-icons/${icon}.png`}
        alt={name}
        width={size}
        height={size}
        style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
        onError={() => setFailed(true)}
      />
    );
  }

  return <Icon name={iconForItem(name, type)} size={size * 0.75} color={color} />;
}
