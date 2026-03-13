import { useEffect, useMemo, useState } from 'react'
import { formatUtcDateTime } from '../../observatory/timeFormat'
import type { CandleHitCluster, IndicatorCategory } from '../../observatory/types'

const LANE_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure']

export type ClusterPresentationMode = 'simple' | 'pro'

interface IndicatorClusterLanesProps {
  layout?: 'default' | 'side-rail'
  timeline: CandleHitCluster[]
  timeframe: '1d'
  mode: ClusterPresentationMode
  selectedTime: number | null
  onSelectTime: (time: number) => void
}

export function IndicatorClusterLanes({
  layout = 'default',
  timeline,
  timeframe,
  mode,
  selectedTime,
  onSelectTime,
}: IndicatorClusterLanesProps) {
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024))

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncViewportWidth = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', syncViewportWidth)
    return () => window.removeEventListener('resize', syncViewportWidth)
  }, [])

  const isNarrowViewport = viewportWidth <= 760
  const isDesktopSideRail = layout === 'side-rail' && !isNarrowViewport
  const isProMode = mode === 'pro'
  const isFullDailySequence = mode === 'simple' && timeframe === '1d'
  const windowSize = isNarrowViewport
    ? mode === 'pro'
      ? 54
      : 36
    : isDesktopSideRail
      ? mode === 'pro'
        ? 72
        : 54
      : mode === 'pro'
        ? 90
        : 72
  const source = useMemo(() => timeline.slice(-windowSize), [timeline, windowSize])
  const clusters = useMemo(() => {
    if (mode === 'pro' || isFullDailySequence) return source
    const targetPoints = isNarrowViewport
      ? 18
      : isDesktopSideRail
        ? 24
        : 38
    return downsampleClusters(source, targetPoints)
  }, [isDesktopSideRail, isFullDailySequence, isNarrowViewport, mode, source, timeframe])

  const maxLaneCount = useMemo(() => {
    let maxCount = 0
    for (const cluster of clusters) {
      for (const lane of LANE_ORDER) {
        maxCount = Math.max(maxCount, cluster.laneCounts[lane] ?? 0)
      }
    }
    return maxCount
  }, [clusters])

  const activeTime = useMemo(() => {
    if (clusters.length === 0) return null
    const selected = clusters.find((cluster) => cluster.time === selectedTime)
    if (selected) return selected.time
    return clusters[clusters.length - 1]?.time ?? null
  }, [clusters, selectedTime])

  if (clusters.length === 0) {
    return (
      <section className="obs-cluster" data-testid="obs-cluster-lanes">
        <div className="obs-cluster-empty">No indicator state history is available for this timeframe yet.</div>
      </section>
    )
  }

  return (
    <section className="obs-cluster" data-testid="obs-cluster-lanes">
      <div className="obs-cluster__header">
        <div>
          <div className="obs-cluster__title">Step 2 · Read signal pressure</div>
          <div className="obs-cluster__hint">Click any cell to inspect it. Brighter = more indicators active on that bar.</div>
        </div>
      </div>

      <div
        className={`obs-cluster__heatmap obs-cluster__heatmap--compact ${isFullDailySequence ? 'obs-cluster__heatmap--daily-full' : ''} ${isProMode ? 'obs-cluster__heatmap--pro' : ''}`}
      >
        {LANE_ORDER.map((lane) => (
          <div
            key={lane}
            className={`obs-cluster__lane obs-cluster__lane--compact ${isFullDailySequence ? 'obs-cluster__lane--daily-full' : ''} ${isProMode ? 'obs-cluster__lane--pro' : ''}`}
          >
            {(() => {
              const latest = clusters[clusters.length - 1]
              const latestCount = latest?.laneCounts[lane] ?? 0
              const latestLevel = intensityLevel(latestCount, maxLaneCount)
              return (
                <div className="obs-cluster__lane-head">
                  <div className="obs-cluster__lane-label">{lane}</div>
                  <div className={`obs-cluster__lane-count obs-cluster__lane-count--${latestLevel}`}>
                    {latestCount > 0 ? latestCount : ''}
                  </div>
                </div>
              )
            })()}
            <div
              className={`obs-cluster__cells obs-cluster__cells--compact ${isFullDailySequence ? 'obs-cluster__cells--daily-full' : ''} ${isProMode ? 'obs-cluster__cells--pro' : ''}`}
            >
              {clusters.map((cluster) => {
                const count = cluster.laneCounts[lane] ?? 0
                const selected = cluster.time === activeTime
                const level = intensityLevel(count, maxLaneCount)
                const showCount = !isNarrowViewport && (mode === 'pro' ? count > 0 : count >= 3)
                return (
                  <button
                    key={`${lane}:${cluster.time}`}
                    type="button"
                    className={`obs-cluster__cell obs-cluster__cell--${level} ${selected ? 'obs-cluster__cell--selected' : ''}`}
                    onClick={() => onSelectTime(cluster.time)}
                    aria-pressed={selected}
                    data-testid="obs-cluster-cell"
                    title={`${formatUtcDateTime(cluster.time)} | ${lane}: ${count} active indicator${count === 1 ? '' : 's'}`}
                  >
                    {showCount ? count : ''}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
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
