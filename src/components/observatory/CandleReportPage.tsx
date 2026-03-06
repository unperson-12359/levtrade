import { useMemo } from 'react'
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
  const groupedEvents = useMemo(() => {
    if (!cluster) return []
    return LANE_ORDER
      .map((category) => ({
        category,
        events: cluster.events
          .filter((event) => event.category === category)
          .sort((left, right) => right.priority - left.priority),
      }))
      .filter((group) => group.events.length > 0)
  }, [cluster])

  const inactiveGroups = useMemo(() => {
    if (!cluster || allIndicators.length === 0) return []
    const activeIds = new Set(cluster.events.map((e) => e.indicatorId))
    return LANE_ORDER
      .map((category) => ({
        category,
        indicators: allIndicators
          .filter((ind) => ind.category === category && !activeIds.has(ind.id))
          .map((ind) => ({ id: ind.id, label: ind.label })),
      }))
      .filter((group) => group.indicators.length > 0)
  }, [cluster, allIndicators])

  const activeCount = cluster?.events.length ?? 0
  const totalCount = allIndicators.length

  if (!cluster) {
    return (
      <section className="obs-report obs-report--empty" data-testid="obs-candle-report-page">
        <div className="obs-report__nav">
          <button type="button" className="obs-report__nav-btn" onClick={onBack} data-testid="obs-candle-report-back">Back to Heatmap</button>
        </div>
        <div className="obs-report__empty-copy">Candle report is unavailable for this timestamp. Select another heatmap cell.</div>
      </section>
    )
  }

  return (
    <section className="obs-report" data-testid="obs-candle-report-page">
      <header className="obs-report__header">
        <div className="obs-report__nav">
          <button type="button" className="obs-report__nav-btn" disabled={!onPrev} onClick={onPrev ?? undefined} data-testid="obs-candle-report-prev">&lt; Prev</button>
          <button type="button" className="obs-report__nav-btn" onClick={onBack} data-testid="obs-candle-report-back">Back to Heatmap</button>
          <button type="button" className="obs-report__nav-btn" disabled={!onNext} onClick={onNext ?? undefined} data-testid="obs-candle-report-next">Next &gt;</button>
        </div>
        <div className="obs-report__title-wrap">
          <h2 className="obs-report__title">Candle Report</h2>
          <p className="obs-report__hint">{new Date(cluster.time).toLocaleString()} | {activeCount} of {totalCount} active</p>
        </div>
      </header>

      <div className="obs-panel obs-panel--report-chart" data-testid="obs-candle-report-chart">
        <div className="obs-panel__title-row">
          <h3 className="obs-panel__title">{coin} Price</h3>
          {loading && <p className="obs-panel__hint">Refreshing...</p>}
        </div>
        <div className="obs-chart-compact">
          <PriceChart coin={coin} embedded showHeader={false} />
        </div>
      </div>

      <div className="obs-report__price" data-testid="obs-cluster-candle-price">
        <span className={cluster.price.changePct >= 0 ? 'obs-report__price-up' : 'obs-report__price-down'}>
          {formatSignedPct(cluster.price.changePct)}
        </span>
        <span className="obs-report__price-range">{formatPrice(cluster.price.close)}</span>
      </div>

      <div className="obs-report__sections" data-testid="obs-cluster-report">
        <div className="obs-report__section-label obs-report__section-label--active">Active ({activeCount})</div>
        {groupedEvents.length > 0 ? (
          groupedEvents.map((group) => (
            <section key={group.category} className="obs-report__category">
              <div className="obs-report__category-head">
                <span>{group.category}</span>
                <span>{group.events.length}</span>
              </div>
              <div className="obs-report__events">
                {group.events.map((hit) => (
                  <article key={hit.id} className="obs-report__event" data-testid="obs-cluster-report-row">
                    <div className="obs-report__event-line">
                      <span className="obs-report__event-indicator">{hit.indicatorLabel}</span>
                      <span className="obs-report__event-yes">YES</span>
                      <span className="obs-report__event-duration">{formatDuration(hit, timeframe)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="obs-report__empty-copy">No indicators fired on this candle.</div>
        )}

        {inactiveGroups.length > 0 && (
          <>
            <div className="obs-report__section-label obs-report__section-label--inactive">Inactive ({totalCount - activeCount})</div>
            {inactiveGroups.map((group) => (
              <section key={group.category} className="obs-report__category obs-report__category--inactive">
                <div className="obs-report__category-head">
                  <span>{group.category}</span>
                  <span>{group.indicators.length}</span>
                </div>
                <div className="obs-report__events">
                  {group.indicators.map((ind) => (
                    <article key={ind.id} className="obs-report__event obs-report__event--inactive" data-testid="obs-cluster-report-row">
                      <div className="obs-report__event-line">
                        <span className="obs-report__event-indicator">{ind.label}</span>
                        <span className="obs-report__inactive-dot">&middot;</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
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

function formatSignedPct(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}
