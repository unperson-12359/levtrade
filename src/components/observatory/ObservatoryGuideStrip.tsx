import { OBSERVATORY_READING_STEPS } from './methodologyContent'

interface ObservatoryGuideStripProps {
  coin: string
  timeframe: '4h' | '1d'
  primaryView: 'timeline' | 'network'
  freshness: 'fresh' | 'delayed' | 'stale' | 'error'
  selectedClusterLabel: string
  selectedClusterHits: number | null
  onOpenMethodology: () => void
}

export function ObservatoryGuideStrip({
  coin,
  timeframe,
  primaryView,
  freshness,
  selectedClusterLabel,
  selectedClusterHits,
  onOpenMethodology,
}: ObservatoryGuideStripProps) {
  const currentStepId =
    freshness === 'error' || freshness === 'stale'
      ? 'market'
      : primaryView === 'network'
        ? 'deep-dive'
        : selectedClusterHits && selectedClusterHits > 0
          ? 'selected'
          : 'pressure'

  return (
    <section className="obs-guide" data-testid="obs-guide-strip">
      <div className="obs-guide__header">
        <div>
          <div className="obs-guide__eyebrow">Start here</div>
          <h2 className="obs-guide__title">Read the market in order, not by jumping to the loudest panel.</h2>
        </div>
        <button type="button" className="obs-panel__action obs-panel__action--secondary" onClick={onOpenMethodology}>
          Full methodology
        </button>
      </div>

      <div className="obs-guide__meta">
        <span>{coin} / {timeframe}</span>
        <span>Freshness: {freshness}</span>
        <span>Selected candle: {selectedClusterLabel}</span>
      </div>

      <div className="obs-guide__grid">
        {OBSERVATORY_READING_STEPS.map((step) => (
          <article
            key={step.id}
            className={`obs-guide__card ${step.id === currentStepId ? 'obs-guide__card--current' : ''}`}
          >
            <div className="obs-guide__card-top">
              <span className="obs-guide__card-step">Step {step.step}</span>
              {step.id === currentStepId ? <span className="obs-guide__card-badge">Current focus</span> : null}
            </div>
            <h3>{step.title}</h3>
            <p>{step.question}</p>
            <div className="obs-guide__card-next">{step.readNext}</div>
          </article>
        ))}
      </div>
    </section>
  )
}
