import type { ObservatoryLiveStatus } from '../../hooks/useIndicatorObservatory'

interface ObservatoryGuideStripProps {
  primaryView: 'timeline' | 'network'
  liveStatus: ObservatoryLiveStatus
  selectedClusterHits: number | null
  onOpenMethodology: () => void
}

export function ObservatoryGuideStrip({
  primaryView,
  liveStatus,
  selectedClusterHits,
  onOpenMethodology,
}: ObservatoryGuideStripProps) {
  const currentStepId =
    liveStatus === 'delayed' || liveStatus === 'disconnected'
      ? 'market'
      : primaryView === 'network'
        ? 'deep-dive'
        : selectedClusterHits && selectedClusterHits > 0
          ? 'selected'
          : 'pressure'

  const hintText = currentStepId === 'pressure'
    ? 'Click any heatmap cell to read what happened on that bar.'
    : currentStepId === 'selected'
      ? 'Cell selected — read the card below, then open the report if it looks important.'
      : currentStepId === 'deep-dive'
        ? 'Use the network to validate correlations between active indicators.'
        : 'Check the price context above before reading indicator pressure.'

  return (
    <section
      className="obs-guide obs-guide--collapsed"
      data-testid="obs-guide-strip"
      data-guide-state="collapsed"
    >
      <div className="obs-guide__hint-bar">
        <span className="obs-guide__hint-text">{hintText}</span>
        <div className="obs-guide__hint-actions">
          <button
            type="button"
            className="obs-guide__toggle"
            onClick={onOpenMethodology}
            data-testid="obs-guide-toggle"
          >
            Methodology
          </button>
        </div>
      </div>
      <div id="obs-guide-expanded" hidden data-testid="obs-guide-expanded" />
    </section>
  )
}
