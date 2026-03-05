import { useMemo } from 'react'
import type { CandleHitCluster, IndicatorCategory, IndicatorHitEvent } from '../../observatory/types'

const LANE_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Flow', 'Structure']

export type ClusterPresentationMode = 'simple' | 'pro'

interface IndicatorClusterLanesProps {
  timeline: CandleHitCluster[]
  timeframe: '4h' | '1d'
  mode: ClusterPresentationMode
  selectedTime: number | null
  onSelectTime: (time: number) => void
}

export function IndicatorClusterLanes({
  timeline,
  timeframe,
  mode,
  selectedTime,
  onSelectTime,
}: IndicatorClusterLanesProps) {
  const windowSize = mode === 'pro' ? (timeframe === '4h' ? 120 : 90) : (timeframe === '4h' ? 96 : 72)
  const source = useMemo(() => timeline.slice(-windowSize), [timeline, windowSize])
  const clusters = useMemo(() => {
    if (mode === 'pro') return source
    const targetPoints = timeframe === '4h' ? 40 : 32
    return downsampleClusters(source, targetPoints)
  }, [mode, source, timeframe])

  const maxLaneCount = useMemo(() => {
    let maxCount = 0
    for (const cluster of clusters) {
      for (const lane of LANE_ORDER) {
        maxCount = Math.max(maxCount, cluster.laneCounts[lane] ?? 0)
      }
    }
    return maxCount
  }, [clusters])

  const activeCluster = useMemo(() => {
    if (clusters.length === 0) return null
    const selected = clusters.find((cluster) => cluster.time === selectedTime)
    if (selected) return selected
    return clusters[clusters.length - 1] ?? null
  }, [clusters, selectedTime])

  const groupedEvents = useMemo(() => {
    if (!activeCluster) return []
    return LANE_ORDER
      .map((category) => ({
        category,
        events: activeCluster.events.filter((event) => event.category === category),
      }))
      .filter((group) => group.events.length > 0)
  }, [activeCluster])

  if (clusters.length === 0) {
    return <div className="obs-cluster-empty">No indicator hit events yet for this timeframe.</div>
  }

  return (
    <section className="obs-cluster" data-testid="obs-cluster-lanes">
      <div className="obs-cluster__header">
        <div className="obs-cluster__title">Indicator Heatmap ({timeframe}, {mode})</div>
        <div className="obs-cluster__hint">Heat intensity = hit density. Select a cell for full candle report.</div>
      </div>

      <div className="obs-cluster__layout">
        <div className="obs-cluster__heatmap">
          {LANE_ORDER.map((lane) => (
            <div key={lane} className="obs-cluster__lane">
              <div className="obs-cluster__lane-label">{lane}</div>
              <div className="obs-cluster__cells">
                {clusters.map((cluster, index) => {
                  const count = cluster.laneCounts[lane] ?? 0
                  const selected = cluster.time === activeCluster?.time
                  const level = intensityLevel(count, maxLaneCount)
                  const showCount = mode === 'pro' ? count > 0 : count >= 2
                  return (
                    <button
                      key={`${lane}:${cluster.time}:${index}`}
                      type="button"
                      className={`obs-cluster__cell obs-cluster__cell--${level} ${selected ? 'obs-cluster__cell--selected' : ''}`}
                      onClick={() => onSelectTime(cluster.time)}
                      title={`${new Date(cluster.time).toLocaleString()} | ${lane}: ${count} hit${count === 1 ? '' : 's'}`}
                    >
                      {showCount ? count : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {activeCluster && (
          <aside className="obs-cluster__side" data-testid="obs-cluster-detail-panel">
            <div className="obs-cluster__side-head">
              <div className="obs-cluster__side-head-main">
                <div className="obs-cluster__side-kicker">Candle Report</div>
                <div>{new Date(activeCluster.time).toLocaleString()}</div>
              </div>
              <span>{activeCluster.totalHits} hits</span>
            </div>

            <div className="obs-cluster__side-price" data-testid="obs-cluster-candle-price">
              <div>O {formatPrice(activeCluster.price.open)} H {formatPrice(activeCluster.price.high)}</div>
              <div>L {formatPrice(activeCluster.price.low)} C {formatPrice(activeCluster.price.close)}</div>
              <div className={activeCluster.price.changePct >= 0 ? 'obs-cluster__price-up' : 'obs-cluster__price-down'}>
                Candle {formatSignedPct(activeCluster.price.changePct)} | Range {Math.abs(activeCluster.price.rangePct).toFixed(2)}%
              </div>
            </div>

            <div className="obs-cluster__side-list" data-testid="obs-cluster-report">
              {groupedEvents.map((group) => (
                <section key={group.category} className="obs-cluster__cat-block">
                  <div className="obs-cluster__cat-head">
                    <span>{group.category}</span>
                    <span>{group.events.length}</span>
                  </div>

                  <div className="obs-cluster__cat-list">
                    {group.events.map((hit) => (
                      <article key={hit.id} className="obs-cluster__event-row" data-testid="obs-cluster-report-row">
                        <div className="obs-cluster__event-line">
                          <span className="obs-cluster__event-indicator">{hit.indicatorLabel}</span>
                          <span className={`obs-cluster__event-kind obs-cluster__event-kind--${hit.kind}`}>{toKindLabel(hit.kind)}</span>
                        </div>
                        <div className="obs-cluster__event-meta">
                          <span>{`${hit.fromState} -> ${hit.toState}`}</span>
                          <span>{formatDuration(hit, timeframe)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {groupedEvents.length === 0 && (
              <div className="obs-cluster__side-empty">No indicator transitions fired on this candle.</div>
            )}
          </aside>
        )}
      </div>
    </section>
  )
}

function downsampleClusters(source: CandleHitCluster[], targetPoints: number): CandleHitCluster[] {
  if (source.length <= targetPoints) return source
  const step = source.length / targetPoints
  const sampled: CandleHitCluster[] = []

  let cursor = 0
  while (Math.floor(cursor) < source.length) {
    const index = Math.min(source.length - 1, Math.floor(cursor))
    const cluster = source[index]
    if (cluster && sampled[sampled.length - 1]?.time !== cluster.time) {
      sampled.push(cluster)
    }
    cursor += step
  }

  const last = source[source.length - 1]
  if (last && sampled[sampled.length - 1]?.time !== last.time) {
    sampled.push(last)
  }

  return sampled
}

function intensityLevel(count: number, maxCount: number): 'none' | 'l1' | 'l2' | 'l3' | 'l4' {
  if (count <= 0 || maxCount <= 0) return 'none'
  const ratio = count / maxCount
  if (ratio < 0.25) return 'l1'
  if (ratio < 0.5) return 'l2'
  if (ratio < 0.75) return 'l3'
  return 'l4'
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
