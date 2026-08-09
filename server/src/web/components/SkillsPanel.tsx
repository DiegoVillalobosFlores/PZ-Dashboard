import { Icon } from './Icon';
import { GlassPanel } from './GlassPanel';
import { MAX_SKILL_LEVEL, type SkillCategoryState, type SkillState } from '../lib/skills';

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

  return (
    <GlassPanel
      cornerBrackets={{ length: 20, thickness: 2, inset: 6, opacity: 0.85 }}
      style={{
        width: compact ? '100%' : 1370,
        maxWidth: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '20px 24px',
      }}
    >
      {header}
      <div style={{ minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {categories.length === 0 && emptyMessage && (
          <div style={{ padding: '24px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
            {emptyMessage}
          </div>
        )}
        {categories.map((category) => (
          <CategorySection key={category.id} category={category} tileWidth={tileWidth} compact={compact} />
        ))}
      </div>
    </GlassPanel>
  );
}