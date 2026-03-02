import type { ReactNode } from 'react'
import { useStore } from '../../store'

interface ExpandableSectionProps {
  sectionId: string
  title: string
  children: ReactNode
}

export function ExpandableSection({ sectionId, title, children }: ExpandableSectionProps) {
  const expanded = useStore((s) => s.expandedSections[sectionId] === true)
  const toggle = useStore((s) => s.toggleSection)
  const contentId = `${sectionId}-content`

  return (
    <section className="expandable-section">
      <button
        type="button"
        className="expandable-section__toggle"
        onClick={() => toggle(sectionId)}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span>{expanded ? `Hide ${title}` : `Show ${title}`}</span>
        <span className={`expandable-section__chevron ${expanded ? 'expandable-section__chevron--open' : ''}`}>
          &#9660;
        </span>
      </button>

      {expanded && (
        <div id={contentId} className="expandable-section__content">
          {children}
        </div>
      )}
    </section>
  )
}
