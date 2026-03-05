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

interface DisplayCluster {
  time: number
  totalHits: number
  topHits: IndicatorHitEvent[]
  overflowCount: number
  laneCounts: Partial<Record<IndicatorCategory, number>>
}

export function IndicatorClusterLanes({
  timeline,
  timeframe,
  mode,
  selectedTime,
  onSelectTime,
}: IndicatorClusterLanesProps) {
  const windowSize = mode === 'pro' ? (timeframe === '4h' ? 120 : 90) : (timeframe === '4h' ? 72 : 60)
  const source = useMemo(() => timeline.slice(-windowSize), [timeline, windowSize])
  const clusters = useMemo(() => {
    if (mode === 'pro') return source
    const binSize = timeframe === '4h' ? 3 : 2
    return binClusters(source, binSize)
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

  if (clusters.length === 0) {
    return <div className="obs-cluster-empty">No indicator hit events yet for this timeframe.</div>
  }

  return (
    <section className="obs-cluster" data-testid="obs-cluster-lanes">
      <div className="obs-cluster__header">
        <div className="obs-cluster__title">Indicator Heatmap ({timeframe}, {mode})</div>
        <div className="obs-cluster__hint">Heat intensity = hit density. Select a cell for event context.</div>
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
                  const showCount = mode === 'pro' ? count > 0 : count >= 3
                  return (
                    <button
                      key={`${lane}:${cluster.time}:${index}`}
                      type="button"
                      className={`obs-cluster__cell obs-cluster__cell--${level} ${selected ? 'obs-cluster__cell--selected' : ''}`}
                      onClick={() => onSelectTime(cluster.time)}
                      title={`${lane}: ${count} hit${count === 1 ? '' : 's'}`}
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
              <span>{new Date(activeCluster.time).toLocaleString()}</span>
              <span>{activeCluster.totalHits} hits</span>
            </div>

            <div className="obs-cluster__side-list">
              {activeCluster.topHits.map((hit) => {
                const readable = toReadableEvent(hit)
                return (
                  <article key={hit.id} className="obs-cluster__side-item">
                    <div className="obs-cluster__side-line">
                      <span className="obs-cluster__side-title">{readable.title}</span>
                      <span className="obs-cluster__side-tech">{readable.technical}</span>
                    </div>
                    <div className="obs-cluster__side-copy">{readable.copy}</div>
                  </article>
                )
              })}
            </div>

            {activeCluster.overflowCount > 0 && (
              <div className="obs-cluster__side-overflow">+{activeCluster.overflowCount} lower-priority hits not shown.</div>
            )}
          </aside>
        )}
      </div>
    </section>
  )
}

function binClusters(source: CandleHitCluster[], binSize: number): DisplayCluster[] {
  const output: DisplayCluster[] = []
  for (let start = 0; start < source.length; start += binSize) {
    const bucket = source.slice(start, start + binSize)
    if (bucket.length === 0) continue

    const laneCounts: Partial<Record<IndicatorCategory, number>> = {}
    const events: IndicatorHitEvent[] = []
    let totalHits = 0
    let overflowCount = 0

    for (const cluster of bucket) {
      totalHits += cluster.totalHits
      overflowCount += cluster.overflowCount
      events.push(...cluster.topHits)
      for (const lane of LANE_ORDER) {
        laneCounts[lane] = (laneCounts[lane] ?? 0) + (cluster.laneCounts[lane] ?? 0)
      }
    }

    const topHits = events
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 3)

    output.push({
      time: bucket[bucket.length - 1]?.time ?? bucket[0]!.time,
      totalHits,
      topHits,
      overflowCount,
      laneCounts,
    })
  }

  return output
}

function intensityLevel(count: number, maxCount: number): 'none' | 'l1' | 'l2' | 'l3' | 'l4' {
  if (count <= 0 || maxCount <= 0) return 'none'
  const ratio = count / maxCount
  if (ratio < 0.25) return 'l1'
  if (ratio < 0.5) return 'l2'
  if (ratio < 0.75) return 'l3'
  return 'l4'
}

function toReadableEvent(hit: IndicatorHitEvent): { title: string; technical: string; copy: string } {
  const stateLabel = hit.toState === 'high'
    ? 'entered high pressure'
    : hit.toState === 'low'
      ? 'entered low pressure'
      : 'normalized'

  if (hit.kind === 'flip') {
    return {
      title: `${hit.category} reversal`,
      technical: hit.indicatorLabel,
      copy: `State flipped from ${hit.fromState} to ${hit.toState}.`,
    }
  }

  if (hit.kind === 'exit_to_neutral') {
    return {
      title: `${hit.category} normalization`,
      technical: hit.indicatorLabel,
      copy: 'Signal moved back toward neutral behavior.',
    }
  }

  return {
    title: `${hit.category} pressure`,
    technical: hit.indicatorLabel,
    copy: `Signal ${stateLabel}.`,
  }
}
