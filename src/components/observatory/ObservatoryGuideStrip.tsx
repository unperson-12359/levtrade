import type { ObservatoryLiveStatus } from '../../hooks/useIndicatorObservatory'
import { OBSERVATORY_READING_STEPS } from './methodologyContent'

interface ObservatoryGuideStripProps {
  coin: string
  timeframe: '4h' | '1d'
  primaryView: 'timeline' | 'network'
  liveStatus: ObservatoryLiveStatus
  observedAt: string | null
  expanded: boolean
  selectedClusterLabel: string
  selectedClusterHits: number | null
  onOpenMethodology: () => void
  onToggleExpanded: () => void
}

export function ObservatoryGuideStrip({
  coin,
  timeframe,
  primaryView,
  liveStatus,
  observedAt,
  expanded,
  selectedClusterLabel,
  selectedClusterHits,
  onOpenMethodology,
  onToggleExpanded,
}: ObservatoryGuideStripProps) {
  const currentStepId =
    liveStatus === 'delayed' || liveStatus === 'disconnected'
      ? 'market'
      : primaryView === 'network'
        ? 'deep-dive'
        : selectedClusterHits && selectedClusterHits > 0
          ? 'selected'
          : 'pressure'
  const currentStep = OBSERVATORY_READING_STEPS.find((step) => step.id === currentStepId) ?? OBSERVATORY_READING_STEPS[0]!

  return (
    <section
      className={`obs-guide ${expanded ? 'obs-guide--expanded' : 'obs-guide--collapsed'}`}
      data-testid="obs-guide-strip"
      data-guide-state={expanded ? 'expanded' : 'collapsed'}
    >
      <div className="obs-guide__header">
        <div className="obs-guide__header-copy">
          <div className="obs-guide__eyebrow">Start here</div>
          <h2 className="obs-guide__title">Market reading flow</h2>
        </div>
        <div className="obs-guide__actions">
          <button
            type="button"
            className="obs-guide__toggle"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-controls="obs-guide-expanded"
            data-testid="obs-guide-toggle"
          >
            {expanded ? 'Collapse guide' : 'Expand guide'}
          </button>
          <button type="button" className="obs-panel__action obs-panel__action--secondary" onClick={onOpenMethodology}>
            Methodology
          </button>
        </div>
      </div>

      <div className="obs-guide__summary-row">
        <div className="obs-guide__meta">
          <span>{coin} / {timeframe}</span>
          <span>Status: {formatGuideStatus(liveStatus)}</span>
          <span>Observed: {formatGuideObservedAt(observedAt)}</span>
          <span>Selected: {selectedClusterLabel}</span>
        </div>
        <div className="obs-guide__summary-content">
          <span className="obs-guide__focus-pill">Current focus: {currentStep.title}</span>
          <span className="obs-guide__next">Next: {currentStep.readNext}</span>
        </div>
      </div>

      {expanded ? (
        <div id="obs-guide-expanded" className="obs-guide__grid" data-testid="obs-guide-expanded">
          {OBSERVATORY_READING_STEPS.map((step) => (
            <article
              key={step.id}
              className={`obs-guide__card ${step.id === currentStepId ? 'obs-guide__card--current' : ''}`}
            >
              <div className="obs-guide__card-top">
                <span className="obs-guide__card-step">Step {step.step}</span>
                {step.id === currentStepId ? <span className="obs-guide__card-badge">Current</span> : null}
              </div>
              <h3>{step.title}</h3>
              <p>{step.question}</p>
              <div className="obs-guide__card-next">{step.readNext}</div>
            </article>
          ))}
        </div>
      ) : (
        <div id="obs-guide-expanded" hidden data-testid="obs-guide-expanded" />
      )}
    </section>
  )
}

function formatGuideStatus(status: ObservatoryLiveStatus): string {
  if (status === 'live') return 'Live'
  if (status === 'updating') return 'Updating'
  if (status === 'delayed') return 'Delayed'
  return 'Disconnected'
}

function formatGuideObservedAt(observedAt: string | null): string {
  const time = Date.parse(observedAt ?? '')
  if (!Number.isFinite(time)) return '--'
  return new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
