import { useMemo, useState } from 'react'
import { PriceChart } from '../chart/PriceChart'
import { formatPct, formatSignedPct } from '../../observatory/format'
import { formatUtcDateTime } from '../../observatory/timeFormat'
import type { CandleHitCluster, IndicatorCategory, IndicatorHitEvent, IndicatorMetric } from '../../observatory/types'
import type { TrackedCoin } from '../../types/market'

const LANE_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure']

interface CandleReportPageProps {
  coin: TrackedCoin
  timeframe: '1d'
  cluster: CandleHitCluster | null
  timeline: CandleHitCluster[]
  allIndicators: IndicatorMetric[]
  loading: boolean
  onBack: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
}

interface IndicatorContext {
  activeRate: number
  currentStreak: number
  lastSeenGapBars: number | null
  recentHitTimes: number[]
}

interface ReportIndicatorRow {
  id: string
  label: string
  active: boolean
  event: IndicatorHitEvent | null
  value: number | null
  unit: string
  activeRate: number
  currentStreak: number
  lastSeenGapBars: number | null
  recentHitTimes: number[]
}

export function CandleReportPage({
  coin,
  timeframe,
  cluster,
  timeline,
  allIndicators,
  loading,
  onBack,
  onPrev,
  onNext,
}: CandleReportPageProps) {
  const [chartOpen, setChartOpen] = useState(false)

  const clusterIndex = useMemo(
    () => (cluster ? timeline.findIndex((candidate) => candidate.time === cluster.time) : -1),
    [cluster, timeline],
  )

  const activeCount = cluster?.events.length ?? 0
  const totalCount = allIndicators.length
  const strongestLane = useMemo(() => (cluster ? strongestCategory(cluster) : null), [cluster])

  const indicatorContext = useMemo(() => {
    if (!cluster || clusterIndex < 0) return new Map<string, IndicatorContext>()

    const context = new Map<string, IndicatorContext>()
    const eventLookup = timeline.map((entry) => new Set(entry.events.map((event) => event.indicatorId)))

    for (const indicator of allIndicators) {
      const isActive = eventLookup[clusterIndex]?.has(indicator.id) ?? false
      let currentStreak = 0
      if (isActive) {
        for (let index = clusterIndex; index >= 0; index -= 1) {
          if (eventLookup[index]?.has(indicator.id)) currentStreak += 1
          else break
        }
      }

      const recentHitTimes: number[] = []
      let lastSeenGapBars: number | null = null
      for (let index = clusterIndex; index >= 0; index -= 1) {
        if (!eventLookup[index]?.has(indicator.id)) continue
        recentHitTimes.push(timeline[index]!.time)
        if (index < clusterIndex || !isActive) {
          lastSeenGapBars = clusterIndex - index
          if (recentHitTimes.length >= 4) break
        }
      }

      context.set(indicator.id, {
        activeRate: indicator.frequency.activeRate,
        currentStreak,
        lastSeenGapBars,
        recentHitTimes,
      })
    }

    return context
  }, [allIndicators, cluster, clusterIndex, timeline])

  const reportGroups = useMemo(() => {
    if (!cluster) return []
    const activeMap = new Map(cluster.events.map((event) => [event.indicatorId, event]))

    return LANE_ORDER.map((category) => {
      const indicators = allIndicators
        .filter((indicator) => indicator.category === category)
        .map<ReportIndicatorRow>((indicator) => {
          const context = indicatorContext.get(indicator.id)
          return {
            id: indicator.id,
            label: indicator.label,
            active: activeMap.has(indicator.id),
            event: activeMap.get(indicator.id) ?? null,
            value: indicator.currentValue,
            unit: indicator.unit,
            activeRate: context?.activeRate ?? 0,
            currentStreak: context?.currentStreak ?? 0,
            lastSeenGapBars: context?.lastSeenGapBars ?? null,
            recentHitTimes: context?.recentHitTimes ?? [],
          }
        })
        .sort((a, b) => {
          if (a.active && !b.active) return -1
          if (!a.active && b.active) return 1
          if (a.event && b.event && a.event.priority !== b.event.priority) return b.event.priority - a.event.priority
          if (a.currentStreak !== b.currentStreak) return b.currentStreak - a.currentStreak
          return b.activeRate - a.activeRate
        })

      const activeRows = indicators.filter((indicator) => indicator.active)
      return {
        category,
        share: cluster.totalHits > 0 ? (cluster.laneCounts[category] ?? 0) / cluster.totalHits : 0,
        activeCount: activeRows.length,
        total: indicators.length,
        indicators,
      }
    })
  }, [allIndicators, cluster, indicatorContext])

  const reportStats = useMemo(() => {
    if (!cluster) return null

    const trailingWindow = timeline
      .slice(Math.max(0, clusterIndex - 24), clusterIndex >= 0 ? clusterIndex : timeline.length)
      .filter((entry) => entry.time !== cluster.time)
    const baseline = trailingWindow.length > 0 ? trailingWindow : timeline.filter((entry) => entry.time !== cluster.time)
    const baselineTotals = baseline.map((entry) => entry.totalHits)
    const trailingAverage = average(baselineTotals)
    const percentile = percentileRank(timeline.map((entry) => entry.totalHits), cluster.totalHits)
    const strongestCount = strongestLane ? cluster.laneCounts[strongestLane] ?? 0 : 0
    const dominance = cluster.totalHits > 0 ? strongestCount / cluster.totalHits : 0
    const activeCategories = LANE_ORDER.filter((lane) => (cluster.laneCounts[lane] ?? 0) > 0).length

    const activeIndicators = reportGroups
      .flatMap((group) => group.indicators.filter((indicator) => indicator.active).map((indicator) => ({ ...indicator, category: group.category })))
      .sort((a, b) => (b.event?.priority ?? 0) - (a.event?.priority ?? 0) || b.currentStreak - a.currentStreak || b.activeRate - a.activeRate)
    const recurringActive = activeIndicators.filter((indicator) => indicator.lastSeenGapBars !== null).length

    return {
      trailingAverage,
      percentile,
      dominance,
      strongestCount,
      activeCategories,
      recurringActive,
      activeIndicators,
    }
  }, [cluster, clusterIndex, reportGroups, strongestLane, timeline])

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
        <div className="obs-report__bar-head">
          <time className="obs-report__bar-time">{formatUtcDateTime(cluster.time)}</time>
          <button type="button" className="obs-report__close-btn" onClick={onBack} data-testid="obs-candle-report-back">
            Close
          </button>
        </div>
        <nav className="obs-report__bar-nav">
          <button
            type="button"
            className="obs-report__bar-btn"
            disabled={!onPrev}
            onClick={onPrev ?? undefined}
            aria-label="Previous candle"
            data-testid="obs-candle-report-prev"
          >
            &larr;
          </button>
          <button
            type="button"
            className="obs-report__bar-btn"
            disabled={!onNext}
            onClick={onNext ?? undefined}
            aria-label="Next candle"
            data-testid="obs-candle-report-next"
          >
            &rarr;
          </button>
        </nav>
        <span className="obs-report__bar-hits">{activeCount}/{totalCount}</span>

        <div className="obs-report__bar-price" data-testid="obs-cluster-candle-price">
          <span className={cluster.price.changePct >= 0 ? 'obs-report__bar-up' : 'obs-report__bar-down'}>
            {formatSignedPct(cluster.price.changePct)}
          </span>
          <span className="obs-report__bar-close">{formatReportPrice(cluster.price.close)}</span>
        </div>
      </header>

      <div className="obs-report__chart-drawer" data-testid="obs-candle-report-chart">
        <p className="obs-report__intro">
          This page is the explanation layer for a selected candle. Read it when the live observatory tells you a candle is worth understanding in detail.
        </p>
        <button
          type="button"
          className={`obs-report__chart-toggle ${chartOpen ? 'obs-report__chart-toggle--open' : ''}`}
          onClick={() => setChartOpen((value) => !value)}
          aria-expanded={chartOpen}
          aria-controls="obs-report-chart-panel"
        >
          <span>{coin} Chart</span>
          <span className="obs-report__chart-chevron">{chartOpen ? '\u25BE' : '\u25B8'}</span>
          {loading && <span className="obs-report__chart-refreshing">Refreshing...</span>}
        </button>
        {chartOpen && (
          <div id="obs-report-chart-panel" className="obs-report__chart-body">
            <PriceChart coin={coin} embedded showHeader={false} />
          </div>
        )}
      </div>

      <div className="obs-report__metrics" data-testid="obs-report-metrics">
        <div className="obs-report__metric-card">
          <span className="obs-report__metric-label">Active indicators</span>
          <strong className="obs-report__metric-value">{cluster.totalHits}</strong>
          <span className="obs-report__metric-meta">
            {reportStats ? `${cluster.totalHits >= reportStats.trailingAverage ? '+' : ''}${(cluster.totalHits - reportStats.trailingAverage).toFixed(1)} vs trailing avg` : '--'}
          </span>
        </div>
        <div className="obs-report__metric-card">
          <span className="obs-report__metric-label">Percentile</span>
          <strong className="obs-report__metric-value">{reportStats ? `P${Math.round(reportStats.percentile * 100)}` : '--'}</strong>
          <span className="obs-report__metric-meta">Within visible timeline window</span>
        </div>
        <div className="obs-report__metric-card">
          <span className="obs-report__metric-label">Active categories</span>
          <strong className="obs-report__metric-value">{reportStats ? `${reportStats.activeCategories}/${LANE_ORDER.length}` : '--'}</strong>
          <span className="obs-report__metric-meta">{strongestLane ?? '--'} leading</span>
        </div>
        <div className="obs-report__metric-card">
          <span className="obs-report__metric-label">Dominance</span>
          <strong className="obs-report__metric-value">{reportStats ? formatPct(reportStats.dominance) : '--'}</strong>
          <span className="obs-report__metric-meta">{reportStats ? `${reportStats.strongestCount} active indicators in top category` : '--'}</span>
        </div>
        <div className="obs-report__metric-card">
          <span className="obs-report__metric-label">Recurring</span>
          <strong className="obs-report__metric-value">{reportStats ? `${reportStats.recurringActive}/${activeCount}` : '--'}</strong>
          <span className="obs-report__metric-meta">Active indicators seen before this candle</span>
        </div>
      </div>

      <div className="obs-report__insights">
        <section className="obs-report__detail-panel" data-testid="obs-report-active-context">
          <div className="obs-report__detail-head">
            <span className="obs-report__detail-label">Active pressure</span>
            <span className="obs-report__detail-count">{reportStats?.activeIndicators.length ?? 0}</span>
          </div>
          {reportStats && reportStats.activeIndicators.length > 0 ? (
            <div className="obs-report__event-table">
              <div className="obs-report__event-row obs-report__event-row--head">
                <span>Indicator</span>
                <span>Value</span>
                <span>Active rate</span>
                <span>Streak</span>
                <span>Recurrence</span>
              </div>
              {reportStats.activeIndicators.slice(0, 6).map((indicator) => (
                <div key={indicator.id} className="obs-report__event-row">
                  <div className="obs-report__event-main">
                    <strong>{indicator.label}</strong>
                    <span>{indicator.category}</span>
                  </div>
                  <span>{formatCompactValue(indicator.value, indicator.unit)}</span>
                  <span>{formatPct(indicator.activeRate)}</span>
                  <span>{formatStreak(indicator.currentStreak)}</span>
                  <span>{formatRecurrence(indicator.lastSeenGapBars, timeframe, true)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="obs-empty">No active indicator events for this candle.</div>
          )}
        </section>

        <section className="obs-report__detail-panel" data-testid="obs-report-category-share">
          <div className="obs-report__detail-head">
            <span className="obs-report__detail-label">Category share</span>
            <span className="obs-report__detail-count">{cluster.totalHits} active indicators</span>
          </div>
          <div className="obs-report__share-list">
            {reportGroups.map((group) => (
              <div key={group.category} className="obs-report__share-row">
                <div className="obs-report__share-main">
                  <span>{group.category}</span>
                  <span>{group.activeCount}/{group.total}</span>
                </div>
                <div className="obs-report__share-bar">
                  <span className="obs-report__share-fill" style={{ width: `${Math.max(group.share * 100, group.share > 0 ? 8 : 0)}%` }} />
                </div>
                <span className="obs-report__share-value">{formatPct(group.share)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="obs-report__grid" data-testid="obs-cluster-report">
        {reportGroups.map((group) => (
          <section key={group.category} className="obs-report__col">
            <div className="obs-report__col-head">
              <span className="obs-report__col-label">{group.category}</span>
              <span className="obs-report__col-count">
                {group.activeCount}/{group.total} • {formatPct(group.share)}
              </span>
            </div>
            <div className="obs-report__col-items">
              {group.indicators.map((indicator) => (
                <div
                  key={indicator.id}
                  className={`obs-report__ind ${indicator.active ? 'obs-report__ind--active' : 'obs-report__ind--inactive'}`}
                  data-testid="obs-cluster-report-row"
                  title={indicator.event?.message ?? indicator.label}
                >
                  <span className={`obs-report__ind-led obs-report__ind-led--${indicator.active ? 'on' : 'off'}`} />
                  <span className="obs-report__ind-name">{indicator.label}</span>
                  <span className="obs-report__ind-val">{formatCompactValue(indicator.value, indicator.unit)}</span>
                  <span className="obs-report__ind-rate">{formatPct(indicator.activeRate)}</span>
                  <span className="obs-report__ind-rec">
                    {indicator.active && indicator.event
                      ? formatDuration(indicator.event, timeframe)
                      : formatRecurrence(indicator.lastSeenGapBars, timeframe)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentileRank(values: number[], current: number) {
  if (values.length === 0) return 0
  const lowerOrEqual = values.filter((value) => value <= current).length
  return lowerOrEqual / values.length
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

function formatDuration(hit: IndicatorHitEvent, _timeframe: '1d') {
  const bars = Math.max(1, hit.durationBars)
  const fallbackMs = bars * 24 * 60 * 60 * 1000
  const durationMs = Number.isFinite(hit.durationMs) && hit.durationMs > 0 ? hit.durationMs : fallbackMs
  const hours = Math.max(1, Math.round(durationMs / (60 * 60 * 1000)))
  const human = hours % 24 === 0 ? `${hours / 24}d` : `${hours}h`
  return `${bars} bar${bars === 1 ? '' : 's'} / ${human}`
}

function formatReportPrice(value: number) {
  if (!Number.isFinite(value)) return '--'
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function formatCompactValue(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return '--'
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'bp') return `${value.toFixed(1)}bp`
  return value.toFixed(2)
}

function formatRecurrence(gapBars: number | null, _timeframe: '1d', active = false) {
  if (gapBars === null) return active ? 'New active state' : 'No recent active bars'
  if (gapBars === 0) return 'Active now'
  const durationHours = gapBars * 24
  return `${gapBars} bars / ${durationHours >= 24 ? `${durationHours / 24}d` : `${durationHours}h`} ago`
}

function formatStreak(value: number) {
  if (value <= 0) return 'Idle'
  return `${value} bars`
}
