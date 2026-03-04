import { useEntryReadiness } from '../../hooks/useEntryReadiness'
import type { TrackedCoin } from '../../types/market'

interface EntryReadinessRailProps {
  coin: TrackedCoin
}

export function EntryReadinessRail({ coin }: EntryReadinessRailProps) {
  const readiness = useEntryReadiness(coin)
  const needleRotation = -90 + readiness.triggerProgressPct * 1.8

  return (
    <section className="entry-readiness-rail" aria-label="Entry readiness dashboard">
      <div className="entry-readiness-rail__lights" role="list">
        {readiness.lights.map((light, index) => (
          <div
            key={light.key}
            className={`entry-readiness-light entry-readiness-light--${light.state}`}
            role="listitem"
            title={`${index + 1}. ${light.label}: ${light.detail}`}
            aria-label={`${light.label}: ${light.state}`}
          >
            <span className="entry-readiness-light__index">{index + 1}</span>
            <span className="entry-readiness-light__dot" aria-hidden="true" />
            <span className="entry-readiness-light__label">{light.label}</span>
          </div>
        ))}
      </div>

      <div className="entry-readiness-rail__meter">
        <div
          className="entry-readiness-progress"
          role="progressbar"
          aria-label="Entry trigger progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readiness.triggerProgressPct}
        >
          <div
            className={`entry-readiness-progress__fill entry-readiness-progress__fill--${readiness.primaryBand}`}
            style={{ width: `${readiness.triggerProgressPct}%` }}
          />
        </div>
        <div className="entry-readiness-gauge" aria-hidden="true">
          <div className="entry-readiness-gauge__arc" />
          <div
            className={`entry-readiness-gauge__needle entry-readiness-gauge__needle--${readiness.primaryBand}`}
            style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
          />
          <div className="entry-readiness-gauge__hub" />
        </div>
        <div className="entry-readiness-rail__score">
          <span className={`entry-readiness-rail__pct entry-readiness-rail__pct--${readiness.primaryBand}`}>
            {readiness.triggerProgressPct}%
          </span>
          <span className="entry-readiness-rail__meta">
            {readiness.activeCount}/{readiness.totalCount} lights
          </span>
        </div>
        <div className="entry-readiness-rail__confidence">
          <span className="entry-readiness-rail__confidence-label">Confidence</span>
          <span className={`entry-readiness-rail__confidence-value entry-readiness-rail__confidence-value--${readiness.confidenceBand}`}>
            {readiness.weightedConfidencePct}%
          </span>
        </div>
      </div>
    </section>
  )
}
