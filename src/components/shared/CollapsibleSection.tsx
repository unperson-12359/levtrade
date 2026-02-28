import { type ReactNode, useRef, useEffect, useState } from 'react'
import { useStore } from '../../store'

interface CollapsibleSectionProps {
  id: string
  title: string
  subtitle?: string
  children: ReactNode
  defaultExpanded?: boolean
}

export function CollapsibleSection({
  id,
  title,
  subtitle,
  children,
  defaultExpanded = false,
}: CollapsibleSectionProps) {
  const expanded = useStore((s) => s.expandedSections[id] ?? defaultExpanded)
  const toggle = useStore((s) => s.toggleSection)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [expanded, children])

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card overflow-hidden">
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-bg-card-hover transition-colors"
      >
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-text-muted transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        ref={contentRef}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: expanded ? (height ?? 2000) : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
