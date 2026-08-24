import { Icon } from './Icon';
import { GlassPanel } from './GlassPanel';
import { TraitsList } from './TraitsList';
import { MAX_SKILL_LEVEL, type SkillCategoryState, type SkillState } from '../lib/skills';
import { useShowTraits } from '../lib/settings';
import { useGameSubscription } from '../lib/gameSocket';
import { summarizeTraitEffects } from '../lib/traits';
import { useLocalStorage } from '@mantine/hooks';

const MAX_LEVEL = MAX_SKILL_LEVEL;

function SkillMeter({ level, progress }: { level: number; progress: number }) {
  return (
    <div style={{ display: 'flex', gap: 3, width: '100%' }}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 10,
            position: 'relative',
            overflow: 'hidden',
            background: i < level ? 'var(--color-accent)' : 'var(--color-tile-bg)',
          }}
        >
          {i === level && progress > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${progress * 100}%`,
                background: 'var(--color-accent-border-medium)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SkillTile({ skill, width, compact }: { skill: SkillState; width: number; compact: boolean }) {
  const levelReadout = (
    <span
      style={{
        flexShrink: 0,
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color: 'var(--color-accent)',
      }}
    >
      {skill.level}/{MAX_LEVEL}
    </span>
  );
  const nameLabel = (
    <span
      style={{
        fontSize: compact ? 11 : 12,
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: 'var(--color-text-primary)',
        lineHeight: 1.25,
        ...(compact
          ? {}
          : { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
      }}
    >
      {skill.name}
    </span>
  );

  return (
    <div
      style={{
        width,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 10,
        background: 'var(--color-glass-inset)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-sharp)',
      }}
    >
      {compact ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Icon name={skill.icon} size={16} color="var(--color-text-secondary)" />
            {levelReadout}
          </div>
          {nameLabel}
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={skill.icon} size={16} color="var(--color-text-secondary)" />
          {nameLabel}
          {levelReadout}
        </div>
      )}
      <SkillMeter level={skill.level} progress={skill.progress} />
    </div>
  );
}

function SummaryChip({ source, value }: { source: string; value: string }) {
  return (
    <span
      title={`${source}: ${value}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 5,
        maxWidth: '100%',
        minWidth: 0,
        padding: '3px 6px',
        color: 'var(--color-text-primary)',
        background: 'var(--color-tile-bg)',
        border: '1px solid var(--color-border-default)',
        borderLeft: '2px solid var(--color-warning)',
        borderRadius: 'var(--radius-sharp)',
        fontSize: 10,
        lineHeight: 1.2,
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
      }}
    >
      <span style={{ color: 'var(--color-text-secondary)' }}>{source}</span>
      <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{value}</span>
    </span>
  );
}

function SummaryRow({
  compact,
  showTraits,
}: {
  compact: boolean;
  showTraits: boolean;
}) {
  const traitSnapshot = useGameSubscription('traits', (msg) =>
    msg.category === 'traits' ? msg.data : undefined,
  );
  const traitEffects = showTraits
    ? summarizeTraitEffects(traitSnapshot?.traits)
    : [];
  const columns = [
    { label: 'Combat', effects: traitEffects.filter((effect) => effect.category === 'combat') },
    { label: 'Other', effects: traitEffects.filter((effect) => effect.category === 'other') },
  ];

  return (
    <section
      aria-label="Summary"
      style={{
        display: 'flex',
        flexDirection: compact ? 'column' : 'row',
        alignItems: compact ? 'stretch' : 'flex-start',
        flex: compact ? '1 1 0' : undefined,
        minHeight: compact ? 0 : undefined,
        gap: 10,
        minWidth: 0,
        padding: '10px 12px',
        height: compact ? '100%' : undefined,
        boxSizing: 'border-box',
        background: 'var(--color-glass-inset)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-sharp)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
        <span
          className="pz-label"
          style={{
            color: 'var(--color-text-primary)',
            fontSize: 11,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          Summary
        </span>
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          {traitEffects.length}
        </span>
      </div>
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          maxHeight: compact ? undefined : 140,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          alignItems: 'start',
          gap: 10,
        }}
      >
        {columns.map((column) => (
          <div key={column.label} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span
              className="pz-label"
              style={{
                color: column.label === 'Combat' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                fontSize: 9,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
            >
              {column.label}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 5 }}>
              {column.effects.length === 0 ? (
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>None</span>
              ) : (
                column.effects.map((effect, index) => (
                  <SummaryChip key={`${effect.source}-${index}`} source={effect.source} value={effect.value} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategorySection({
  category,
  tileWidth,
  compact,
}: {
  category: SkillCategoryState;
  tileWidth: number;
  compact: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        className="pz-label"
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--color-accent)',
        }}
      >
        {category.label}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {category.skills.map((skill) => (
          <SkillTile key={skill.id} skill={skill} width={tileWidth} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export function SkillsPanel({
  categories,
  compact = false,
  emptyMessage,
}: {
  categories: SkillCategoryState[];
  compact?: boolean;
  emptyMessage?: string;
}) {
  const tileWidth = compact ? 86 : 172;
  const [showTraits] = useShowTraits();
  const [mobileTab, setMobileTab] = useLocalStorage<'summary' | 'traits' | 'skills'>({
    key: 'pz-dashboard.skillsMobileTab',
    defaultValue: 'summary',
    getInitialValueInEffect: false,
  });

  const header = (
    <span
      className="pz-label"
      style={{
        fontSize: 18,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: 'var(--color-text-primary)',
      }}
    >
      Skills
    </span>
  );

  const skillsContent = (
    <div
      style={{
        flex: compact ? '0 0 auto' : '0 1 auto',
        minWidth: 0,
        minHeight: 0,
        overflowY: compact ? 'visible' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {categories.length === 0 && emptyMessage && (
        <div style={{ padding: '24px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          {emptyMessage}
        </div>
      )}
      {categories.map((category) => (
        <CategorySection key={category.id} category={category} tileWidth={tileWidth} compact={compact} />
      ))}
    </div>
  );

  const mobileTabs = (
    <div role="tablist" aria-label="Skills sections" style={{ display: 'flex', gap: 4, width: '100%' }}>
      {(['summary', 'traits', 'skills'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={mobileTab === tab}
          onClick={() => setMobileTab(tab)}
          style={{
            flex: 1,
            padding: '8px 4px',
            color: mobileTab === tab ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            background: mobileTab === tab ? 'var(--color-accent-fill-weak)' : 'var(--color-glass-inset)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-sharp)',
            fontFamily: 'var(--font-display)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  return (
    <GlassPanel
      cornerBrackets={{ length: 20, thickness: 2, inset: 6, opacity: 0.85 }}
      style={{
        width: compact ? '100%' : 1370,
        maxWidth: '100%',
        height: compact ? '100%' : 'auto',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '20px 24px',
      }}
      >
      {header}
      {compact && mobileTabs}
      {(!compact || mobileTab === 'summary') && (
        <div style={{ flex: compact ? '1 1 0' : undefined, minHeight: compact ? 0 : undefined, display: 'flex' }}>
          <SummaryRow compact={compact} showTraits={showTraits} />
        </div>
      )}
      <div
        style={{
          flex: compact ? '1 1 0' : '0 1 auto',
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          display: compact && mobileTab === 'summary' ? 'none' : compact ? 'flex' : 'grid',
          flexDirection: compact ? 'column' : undefined,
          gridTemplateColumns: compact ? undefined : showTraits ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr',
          alignItems: 'stretch',
          gap: compact ? 14 : 24,
          overflow: compact ? 'auto' : 'hidden',
        }}
      >
        {(!compact || mobileTab === 'traits') && showTraits && (
          <div
            style={{
              flex: compact ? '0 0 auto' : undefined,
              minWidth: 0,
              minHeight: 0,
              width: '100%',
              overflowY: compact ? 'visible' : 'auto',
            }}
          >
            <TraitsList compact={compact} />
          </div>
        )}
        {(!compact || mobileTab === 'skills') && skillsContent}
      </div>
    </GlassPanel>
  );
}
