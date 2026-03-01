import { useTrackerStats } from '../../hooks/useTrackerStats'
import { formatPercent, timeAgo } from '../../utils/format'

const toneClasses = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
} as const

export function AccuracyPanel() {
  const stats = useTrackerStats()

  return (
    <section className="panel-shell">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Accuracy Tracker</div>
          <h3 className="panel-title">How the cockpit has performed over time</h3>
        </div>
        {stats.bestKind24h && (
          <span className="status-pill status-pill--green">
            24h best: {stats.bestKind24h.label}
          </span>
        )}
      </div>

      <div className="stat-grid">
        <TrackerMetric
          label="Tracked Signals"
          value={String(stats.totalSignals)}
          tone="yellow"
        />
        <TrackerMetric
          label="Resolved Outcomes"
          value={String(stats.totalResolved)}
          tone="yellow"
        />
        <TrackerMetric
          label="24h Hit Rate"
          value={renderRate(stats.overallByWindow['24h'].hitRate)}
          tone={rateTone(stats.overallByWindow['24h'].hitRate)}
        />
        <TrackerMetric
          label="Best Signal"
          value={stats.bestKind24h?.label ?? 'N/A'}
          tone="green"
        />
      </div>

      {stats.latestResolved && (
        <div className="panel-copy">
          Latest resolved: {stats.latestResolved.coin} {stats.latestResolved.label} on {stats.latestResolved.window}{' '}
          was <span className={stats.latestResolved.correct ? 'text-signal-green' : 'text-signal-red'}>{stats.latestResolved.correct ? 'correct' : 'wrong'}</span>
          {stats.latestResolved.returnPct !== null && ` (${formatPercent(stats.latestResolved.returnPct, 2)})`} {timeAgo(stats.latestResolved.resolvedAt)}.
        </div>
      )}

      <p className="panel-copy">
        This table tracks whether each signal correctly predicted the price direction over 4h, 24h, and 72h windows.
        A hit rate above 55% is meaningful — above 60% is strong.
        Neutral signals (like Regime) are excluded from hit-rate calculations since they describe market character, not direction.
      </p>

      <div className="tracker-table-wrap">
        <div className="tracker-table">
          <div className="tracker-row tracker-row--head">
            <span>Signal</span>
            <span>4h</span>
            <span>24h</span>
            <span>72h</span>
            <span>Samples</span>
          </div>
          {stats.byKind.map((item) => (
            <div key={item.kind} className="tracker-row">
              <span>{item.label}</span>
              <span className={toneClasses[rateTone(item.windows['4h'].hitRate)]}>{renderRate(item.windows['4h'].hitRate)}</span>
              <span className={toneClasses[rateTone(item.windows['24h'].hitRate)]}>{renderRate(item.windows['24h'].hitRate)}</span>
              <span className={toneClasses[rateTone(item.windows['72h'].hitRate)]}>{renderRate(item.windows['72h'].hitRate)}</span>
              <span>{item.windows['24h'].sampleSize}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrackerMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'green' | 'yellow' | 'red'
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClasses[tone]}`}>{value}</div>
    </div>
  )
}

function renderRate(value: number | null): string {
  if (value === null) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

function rateTone(value: number | null): 'green' | 'yellow' | 'red' {
  if (value === null) return 'yellow'
  if (value >= 0.6) return 'green'
  if (value >= 0.45) return 'yellow'
  return 'red'
}
