import { useServerTrackerStats } from '../../hooks/useServerTrackerStats'
import { useTrackerStats } from '../../hooks/useTrackerStats'
import { formatPercent, timeAgo } from '../../utils/format'

const toneClasses = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
} as const

export function AccuracyPanel() {
  const { stats, loading, error, truncated, recordCount, windowDays, computedAt } = useServerTrackerStats()
  const localStats = useTrackerStats()
  const usingFallback = (!!error || stats.totalSignals === 0) && localStats.totalSignals > 0
  const activeStats = usingFallback ? localStats : stats

  if (loading) {
    return (
      <section className="panel-shell">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Accuracy Tracker</div>
            <h3 className="panel-title">Loading signal accuracy data...</h3>
          </div>
        </div>
      </section>
    )
  }

  if (error && !usingFallback) {
    return (
      <section className="panel-shell">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Accuracy Tracker</div>
            <h3 className="panel-title">Server accuracy is temporarily unavailable</h3>
          </div>
          <span className="status-pill status-pill--yellow">UNAVAILABLE</span>
        </div>

        <p className="panel-copy">
          Signal accuracy is sourced from the Oracle collector. The server endpoint could not be loaded,
          so no signal stats are shown right now.
        </p>

        <p className="panel-copy">{error}</p>
      </section>
    )
  }

  return (
    <section className="panel-shell">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Accuracy Tracker</div>
          <h3 className="panel-title">How the cockpit has performed over time</h3>
        </div>
        {activeStats.bestKind24h && (
          <span className="status-pill status-pill--green">
            24h best: {activeStats.bestKind24h.label}
          </span>
        )}
      </div>

      <div className="stat-grid">
        <TrackerMetric label="Tracked Signals" value={String(activeStats.totalSignals)} tone="yellow" />
        <TrackerMetric label="Resolved Outcomes" value={String(activeStats.totalResolved)} tone="yellow" />
        <TrackerMetric
          label="24h Hit Rate"
          value={renderRate(activeStats.overallByWindow['24h'].hitRate)}
          tone={rateTone(activeStats.overallByWindow['24h'].hitRate)}
        />
        <TrackerMetric label="Best Signal" value={activeStats.bestKind24h?.label ?? 'N/A'} tone="green" />
      </div>

      {activeStats.latestResolved && (
        <div className="panel-copy">
          Latest resolved: {activeStats.latestResolved.coin} {activeStats.latestResolved.label} on {activeStats.latestResolved.window}{' '}
          was{' '}
          <span className={activeStats.latestResolved.correct ? 'text-signal-green' : 'text-signal-red'}>
            {activeStats.latestResolved.correct ? 'correct' : 'wrong'}
          </span>
          {activeStats.latestResolved.returnPct !== null && ` (${formatPercent(activeStats.latestResolved.returnPct, 2)})`}{' '}
          {timeAgo(activeStats.latestResolved.resolvedAt)}.
        </div>
      )}

      {usingFallback ? (
        <p className="panel-copy">
          Showing browser fallback signal accuracy because canonical server accuracy is currently unavailable or empty on
          this device. These numbers may differ across devices until the server collector path is available.
        </p>
      ) : (
        <p className="panel-copy">
          Signal accuracy is tracked by the server collector and consistent across all devices.
          Results resolve automatically as the collector runs, even when your browser is closed.
        </p>
      )}

      {truncated && !usingFallback && (
        <p className="panel-copy">
          Server accuracy is partial right now because the {windowDays}-day result set exceeded the current API fetch
          ceiling. Showing the first {recordCount.toLocaleString()} canonical records fetched
          {computedAt ? ` as of ${new Date(computedAt).toLocaleString()}` : ''}.
        </p>
      )}

      <p className="panel-copy">
        This table tracks whether each signal correctly predicted the price direction over 4h, 24h, and 72h windows.
        A hit rate above 55% is meaningful; above 60% is strong. Neutral signals like Regime are excluded from hit-rate
        calculations, and results only resolve once the matching future candle actually exists.
      </p>

      <div className="tracker-table-wrap">
        <div className="tracker-table">
          <div className="tracker-row tracker-row--head">
            <span>Signal</span>
            <span>4h</span>
            <span>24h</span>
            <span>72h</span>
            <span>24h Samples</span>
          </div>
          {activeStats.byKind.map((item) => (
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
