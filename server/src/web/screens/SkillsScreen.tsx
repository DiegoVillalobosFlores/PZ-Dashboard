import { useMediaQuery } from '@mantine/hooks';
import { SkillsPanel } from '../components/SkillsPanel';
import { useGameConnection, useGameSubscription } from '../lib/gameSocket';
import { perksToCategories } from '../lib/skills';

export function SkillsScreen() {
  const isWide = useMediaQuery('(min-width: 900px)');
  const connected = useGameConnection();
  const skills = useGameSubscription('skills', (msg) =>
    msg.category === 'skills' ? msg.data : undefined,
  );
  const categories = perksToCategories(skills);

  return (
    <div
      style={{
        position: 'absolute',
        top: isWide ? 88 : 104,
        bottom: isWide ? 138 : 240,
        left: isWide ? 112 : 12,
        right: isWide ? 84 : 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          maxWidth: '100%',
          maxHeight: '100%',
          minHeight: 0,
        }}
      >
        <SkillsPanel
          categories={categories}
          compact={!isWide}
          emptyMessage={
            connected ? 'Waiting for skill data…' : 'Not connected to the dashboard server.'
          }
        />
      </div>
    </div>
  );
}
