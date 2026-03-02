import { useStore } from '../../store'
import { AnalyticsTabs } from './AnalyticsTabs'

export function AnalyticsPage() {
  const open = useStore((s) => s.expandedSections['analytics'] ?? false)
  const toggle = useStore((s) => s.toggleSection)
  const close = () => {
    if (open) toggle('analytics')
  }

  return (
    <>
      {open && <div className="guide-backdrop" onClick={close} />}
      <div className={`guide-page ${open ? 'guide-page--open' : ''}`}>
        <div className="guide-page__header">
          <h1 className="guide-page__title">Analytics</h1>
          <button onClick={close} className="guide-page__close" aria-label="Close analytics">
            X
          </button>
        </div>
        <div className="guide-page__body guide-page__body--analytics">
          <AnalyticsTabs />
        </div>
      </div>
    </>
  )
}
