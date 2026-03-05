import { useMemo } from 'react'
import type { CandleHitCluster, IndicatorCategory } from '../../observatory/types'

const LANE_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Flow', 'Structure']

interface IndicatorClusterLanesProps {
  timeline: CandleHitCluster[]
  timeframe: '4h' | '1d'
  selectedTime: number | null
  onSelectTime: (time: number) => void
}

export function IndicatorClusterLanes({
  timeline,
  timeframe,
  selectedTime,
  onSelectTime,
}: IndicatorClusterLanesProps) {
  const windowSize = timeframe === '4h' ? 120 : 90
  const visible = useMemo(() => timeline.slice(-windowSize), [timeline, windowSize])
  const activeCluster = useMemo(
    () => visible.find((cluster) => cluster.time === selectedTime) ?? visible[visible.length - 1] ?? null,
    [selectedTime, visible],
  )

  if (visible.length === 0) {
    return <div className="obs-cluster-empty">No indicator hit events yet for this timeframe.</div>
  }

  return (
    <section className="obs-cluster" data-testid="obs-cluster-lanes">
      <div className="obs-cluster__header">
        <div className="obs-cluster__title">Indicator Hit Clusters ({timeframe})</div>
        <div className="obs-cluster__hint">Dots mark candles where threshold/cross events fired. Click a dot to inspect.</div>
      </div>

      <div className="obs-cluster__lane-list">
        {LANE_ORDER.map((lane) => (
          <div key={lane} className="obs-cluster__lane">
            <div className="obs-cluster__lane-label">{lane}</div>
            <div className="obs-cluster__lane-track">
              {visible.map((cluster, index) => {
                const count = cluster.laneCounts[lane] ?? 0
                if (count === 0) return null
                const left = visible.length <= 1 ? 50 : (index / (visible.length - 1)) * 100
                const active = cluster.time === activeCluster?.time
                return (
                  <button
                    key={`${lane}-${cluster.time}`}
                    type="button"
                    className={`obs-cluster__dot ${active ? 'obs-cluster__dot--active' : ''}`}
                    style={{ left: `${left}%` }}
                    onClick={() => onSelectTime(cluster.time)}
                    title={`${lane}: ${count} hit${count > 1 ? 's' : ''}`}
                  >
                    {count > 1 ? count : ''}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {activeCluster && (
        <div className="obs-cluster__detail">
          <div className="obs-cluster__detail-head">
            <span>{new Date(activeCluster.time).toLocaleString()}</span>
            <span>{activeCluster.totalHits} hit{activeCluster.totalHits === 1 ? '' : 's'}</span>
          </div>
          <div className="obs-cluster__detail-list">
            {activeCluster.topHits.map((hit) => (
              <div key={hit.id} className="obs-cluster__detail-item">
                <span className="obs-cluster__detail-pill">{hit.category}</span>
                <span className="obs-cluster__detail-text"><strong>{hit.indicatorLabel}:</strong> {hit.message}</span>
              </div>
            ))}
            {activeCluster.overflowCount > 0 && (
              <div className="obs-cluster__detail-overflow">+{activeCluster.overflowCount} more lower-priority hits at this candle.</div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
