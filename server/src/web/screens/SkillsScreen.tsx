import { useMediaQuery } from '@mantine/hooks';
import { ScreenModal } from '../components/ScreenModal';
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
    <ScreenModal>
      <SkillsPanel
        categories={categories}
        compact={!isWide}
        emptyMessage={
          connected ? 'Waiting for skill data…' : 'Not connected to the dashboard server.'
        }
      />
    </ScreenModal>
  );
}
