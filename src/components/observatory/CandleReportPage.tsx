import { useMemo } from 'react'
import { PriceChart } from '../chart/PriceChart'
import type { CandleHitCluster, IndicatorCategory, IndicatorHitEvent } from '../../observatory/types'
import type { TrackedCoin } from '../../types/market'

const LANE_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Flow', 'Structure']

interface CandleReportPageProps {
  coin: TrackedCoin
  timeframe: '4h' | '1d'
  cluster: CandleHitCluster | null
  loading: boolean
  onBack: () => void
}

export function CandleReportPage({
  coin,
  timeframe,
  cluster,
  loading,
  onBack,
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

  if (!cluster) {
    return (
      <section className="obs-report obs-report--empty" data-testid="obs-candle-report-page">
        <button type="button" className="obs-report__back" onClick={onBack} data-testid="obs-candle-report-back">Back to Heatmap</button>
        <div className="obs-report__empty-copy">Candle report is unavailable for this timestamp. Select another heatmap cell.</div>
      </section>
    )
  }

  return (
    <section className="obs-report" data-testid="obs-candle-report-page">
      <header className="obs-report__header">
        <button type="button" className="obs-report__back" onClick={onBack} data-testid="obs-candle-report-back">Back to Heatmap</button>
        <div className="obs-report__title-wrap">
          <h2 className="obs-report__title">Candle Report</h2>
          <p className="obs-report__hint">{new Date(cluster.time).toLocaleString()} | {cluster.totalHits} fired indicators</p>
        </div>
      </header>

      <div className="obs-panel obs-panel--report-chart" data-testid="obs-candle-report-chart">
        <div className="obs-panel__title-row">
          <h3 className="obs-panel__title">{coin} Price Context ({timeframe})</h3>
          <p className="obs-panel__hint">{loading ? 'Refreshing canonical snapshot...' : 'Chart context for selected candle.'}</p>
        </div>
        <div className="obs-chart-compact">
          <PriceChart coin={coin} embedded showHeader={false} />
        </div>
      </div>

      <div className="obs-report__price" data-testid="obs-cluster-candle-price">
        <div>O {formatPrice(cluster.price.open)} H {formatPrice(cluster.price.high)}</div>
        <div>L {formatPrice(cluster.price.low)} C {formatPrice(cluster.price.close)}</div>
        <div className={cluster.price.changePct >= 0 ? 'obs-report__price-up' : 'obs-report__price-down'}>
          Candle {formatSignedPct(cluster.price.changePct)} | Range {Math.abs(cluster.price.rangePct).toFixed(2)}%
        </div>
      </div>

      <div className="obs-report__sections" data-testid="obs-cluster-report">
        {groupedEvents.map((group) => (
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
                    <span className={`obs-report__event-kind obs-report__event-kind--${hit.kind}`}>{toKindLabel(hit.kind)}</span>
                  </div>
                  <div className="obs-report__event-meta">
                    <span>{`${hit.fromState} -> ${hit.toState}`}</span>
                    <span>{formatDuration(hit, timeframe)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {groupedEvents.length === 0 && (
          <div className="obs-report__empty-copy">No indicator transitions fired on this candle.</div>
        )}
      </div>
    </section>
  )
}

function toKindLabel(kind: IndicatorHitEvent['kind']): string {
  if (kind === 'flip') return 'Flip'
  if (kind === 'exit_to_neutral') return 'Normalize'
  if (kind === 'enter_high') return 'High'
  return 'Low'
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
