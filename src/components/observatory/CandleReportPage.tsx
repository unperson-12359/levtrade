import { useMemo, useState } from 'react'
import { PriceChart } from '../chart/PriceChart'
import type { CandleHitCluster, IndicatorCategory, IndicatorHitEvent, IndicatorMetric } from '../../observatory/types'
import type { TrackedCoin } from '../../types/market'

const LANE_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Flow', 'Structure']

interface CandleReportPageProps {
  coin: TrackedCoin
  timeframe: '4h' | '1d'
  cluster: CandleHitCluster | null
  allIndicators: IndicatorMetric[]
  loading: boolean
  onBack: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
}

export function CandleReportPage({
  coin,
  timeframe,
  cluster,
  allIndicators,
  loading,
  onBack,
  onPrev,
  onNext,
}: CandleReportPageProps) {
  const [chartOpen, setChartOpen] = useState(false)

  const activeCount = cluster?.events.length ?? 0
  const totalCount = allIndicators.length
  const strongestLane = useMemo(() => (cluster ? strongestCategory(cluster) : null), [cluster])

  const unifiedGrid = useMemo(() => {
    if (!cluster) return []
    const activeMap = new Map(cluster.events.map((e) => [e.indicatorId, e]))
    return LANE_ORDER.map((category) => ({
      category,
      indicators: allIndicators
        .filter((ind) => ind.category === category)
        .map((ind) => ({
          id: ind.id,
          label: ind.label,
          active: activeMap.has(ind.id),
          event: activeMap.get(ind.id) ?? null,
          value: ind.currentValue,
          unit: ind.unit,
        }))
        .sort((a, b) => {
          if (a.active && !b.active) return -1
          if (!a.active && b.active) return 1
          if (a.event && b.event) return b.event.priority - a.event.priority
          return 0
        }),
    }))
  }, [cluster, allIndicators])

  if (!cluster) {
    return (
      <section className="obs-report obs-report--empty" data-testid="obs-candle-report-page">
        <nav className="obs-report__bar-nav">
          <button type="button" className="obs-report__bar-btn" onClick={onBack} data-testid="obs-candle-report-back">Back to Heatmap</button>
        </nav>
        <div className="obs-report__empty-copy">Candle report is unavailable for this timestamp. Select another heatmap cell.</div>
      </section>
    )
  }

  return (
    <section className="obs-report" data-testid="obs-candle-report-page">
      <header className="obs-report__bar">
        <nav className="obs-report__bar-nav">
          <button type="button" className="obs-report__bar-btn" disabled={!onPrev} onClick={onPrev ?? undefined} data-testid="obs-candle-report-prev">&larr;</button>
          <button type="button" className="obs-report__bar-btn" onClick={onBack} data-testid="obs-candle-report-back">Heatmap</button>
          <button type="button" className="obs-report__bar-btn" disabled={!onNext} onClick={onNext ?? undefined} data-testid="obs-candle-report-next">&rarr;</button>
        </nav>
        <time className="obs-report__bar-time">{new Date(cluster.time).toLocaleString()}</time>
        <span className="obs-report__bar-hits">{activeCount}/{totalCount}</span>

        <div className="obs-report__bar-price" data-testid="obs-cluster-candle-price">
          <span className={cluster.price.changePct >= 0 ? 'obs-report__bar-up' : 'obs-report__bar-down'}>
            {formatSignedPct(cluster.price.changePct)}
          </span>
          <span className="obs-report__bar-close">{formatPrice(cluster.price.close)}</span>
        </div>
      </header>

      <div className="obs-report__chart-drawer" data-testid="obs-candle-report-chart">
        <button
          type="button"
          className={`obs-report__chart-toggle ${chartOpen ? 'obs-report__chart-toggle--open' : ''}`}
          onClick={() => setChartOpen((v) => !v)}
        >
          <span>{coin} Chart</span>
          <span className="obs-report__chart-chevron">{chartOpen ? '\u25BE' : '\u25B8'}</span>
          {loading && <span className="obs-report__chart-refreshing">Refreshing...</span>}
        </button>
        {chartOpen && (
          <div className="obs-report__chart-body">
            <PriceChart coin={coin} embedded showHeader={false} />
          </div>
        )}
      </div>

      <div className="obs-report__summary">
        <div className="obs-report__summary-card">
          <span className="obs-report__summary-label">Strongest lane</span>
          <strong className="obs-report__summary-value">{strongestLane ?? '--'}</strong>
        </div>
        <div className="obs-report__summary-card">
          <span className="obs-report__summary-label">Range</span>
          <strong className="obs-report__summary-value">{formatSignedPct(cluster.price.rangePct)}</strong>
        </div>
        <div className="obs-report__summary-card obs-report__summary-card--wide">
          <span className="obs-report__summary-label">Top events</span>
          <strong className="obs-report__summary-value">{cluster.topHits.slice(0, 3).map((event) => event.indicatorLabel).join(' / ') || '--'}</strong>
        </div>
      </div>

      <div className="obs-report__grid" data-testid="obs-cluster-report">
        {unifiedGrid.map((group) => (
          <section key={group.category} className="obs-report__col">
            <div className="obs-report__col-head">
              <span className="obs-report__col-label">{group.category}</span>
              <span className="obs-report__col-count">
                {group.indicators.filter((i) => i.active).length}/{group.indicators.length}
              </span>
            </div>
            <div className="obs-report__col-items">
              {group.indicators.map((ind) => (
                <div
                  key={ind.id}
                  className={`obs-report__ind ${ind.active ? 'obs-report__ind--active' : 'obs-report__ind--inactive'}`}
                  data-testid="obs-cluster-report-row"
                >
                  <span className={`obs-report__ind-led obs-report__ind-led--${ind.active ? 'on' : 'off'}`} />
                  <span className="obs-report__ind-name">{ind.label}</span>
                  {ind.value !== null && ind.value !== undefined && (
                    <span className="obs-report__ind-val">{formatCompactValue(ind.value, ind.unit)}</span>
                  )}
                  {ind.active && ind.event && (
                    <span className="obs-report__ind-dur">{formatDuration(ind.event, timeframe)}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function formatDuration(hit: IndicatorHitEvent, timeframe: '4h' | '1d'): string {
  const bars = Math.max(1, hit.durationBars)
  const fallbackMs = bars * (timeframe === '4h' ? 4 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
  const durationMs = Number.isFinite(hit.durationMs) && hit.durationMs > 0 ? hit.durationMs : fallbackMs
  const hours = Math.max(1, Math.round(durationMs / (60 * 60 * 1000)))
  const human = hours % 24 === 0 ? `${hours / 24}d` : `${hours}h`
  return `${bars} bar${bars === 1 ? '' : 's'} (${human})`
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function formatCompactValue(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) return ''
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'bp') return `${value.toFixed(1)}bp`
  return value.toFixed(2)
}

function formatSignedPct(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function strongestCategory(cluster: CandleHitCluster) {
  let strongest: IndicatorCategory | null = null
  let count = -1
  for (const lane of LANE_ORDER) {
    const laneCount = cluster.laneCounts[lane] ?? 0
    if (laneCount > count) {
      strongest = lane
      count = laneCount
    }
  }
  return count > 0 ? strongest : null
}
