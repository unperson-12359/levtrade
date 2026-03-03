import { useMemo } from 'react'
import { useStore } from '../../store'
import { useSetupStats } from '../../hooks/useSetupStats'
import type { SetupWindow } from '../../types/setup'
import { TRACKED_COINS } from '../../types/market'

const WINDOWS: SetupWindow[] = ['4h', '24h', '72h']

const R_BUCKETS = [
  { label: '< -2R', min: -Infinity, max: -2 },
  { label: '-2R', min: -2, max: -1 },
  { label: '-1R', min: -1, max: 0 },
  { label: '0R', min: 0, max: 1 },
  { label: '+1R', min: 1, max: 2 },
  { label: '+2R', min: 2, max: 3 },
  { label: '> +3R', min: 3, max: Infinity },
]

export function PerformanceDashboard() {
  const trackedSetups = useStore((s) => s.serverTrackedSetups)
  const stats24h = useSetupStats('24h')

  const windowStats = useMemo(() => {
    const result: Record<SetupWindow, { wins: number; losses: number; expired: number; pending: number; winRate: number | null; avgR: number | null; total: number }> = {
      '4h': { wins: 0, losses: 0, expired: 0, pending: 0, winRate: null, avgR: null, total: 0 },
      '24h': { wins: 0, losses: 0, expired: 0, pending: 0, winRate: null, avgR: null, total: 0 },
      '72h': { wins: 0, losses: 0, expired: 0, pending: 0, winRate: null, avgR: null, total: 0 },
    }

    for (const tracked of trackedSetups) {
      for (const w of WINDOWS) {
        const o = tracked.outcomes[w]
        result[w].total += 1
        if (o.result === 'win') result[w].wins += 1
        else if (o.result === 'loss') result[w].losses += 1
        else if (o.result === 'expired') result[w].expired += 1
        else if (o.result === 'pending') result[w].pending += 1
      }
    }

    for (const w of WINDOWS) {
      const s = result[w]
      const directional = s.wins + s.losses
      s.winRate = directional > 0 ? s.wins / directional : null
    }

    return result
  }, [trackedSetups])

  const bestWindow = useMemo(() => {
    let best: SetupWindow = '24h'
    let bestRate = -1
    for (const w of WINDOWS) {
      const rate = windowStats[w].winRate
      if (rate !== null && rate > bestRate) {
        bestRate = rate
        best = w
      }
    }
    return best
  }, [windowStats])

  const rDistribution = useMemo(() => {
    const counts = R_BUCKETS.map(() => 0)
    for (const tracked of trackedSetups) {
      const o = tracked.outcomes['24h']
      if (o.rAchieved === null) continue
      for (let i = 0; i < R_BUCKETS.length; i++) {
        const bucket = R_BUCKETS[i]
        if (bucket && o.rAchieved >= bucket.min && o.rAchieved < bucket.max) {
          counts[i] = (counts[i] ?? 0) + 1
          break
        }
      }
    }
    return counts
  }, [trackedSetups])

  const recentOutcomes = useMemo(() => {
    const resolved: { coin: string; result: string; rAchieved: number | null; direction: string }[] = []
    const sorted = [...trackedSetups].sort((a, b) => b.setup.generatedAt - a.setup.generatedAt)
    for (const tracked of sorted) {
      const o = tracked.outcomes['24h']
      if (o.result === 'pending' || o.result === 'unresolvable') continue
      resolved.push({
        coin: tracked.setup.coin,
        result: o.result,
        rAchieved: o.rAchieved,
        direction: tracked.setup.direction,
      })
      if (resolved.length >= 12) break
    }
    return resolved
  }, [trackedSetups])

  const actionableCount = useMemo(() => {
    let actionable = 0
    let total = 0
    for (const tracked of trackedSetups) {
      total++
      if (tracked.setup.direction === 'long' || tracked.setup.direction === 'short') {
        actionable++
      }
    }
    return { actionable, total }
  }, [trackedSetups])

  if (trackedSetups.length === 0) {
    return (
      <div className="perf-empty">
        <div className="perf-empty__icon">—</div>
        <div className="perf-empty__title">No setups tracked yet</div>
        <div className="perf-empty__desc">
          As the system generates trade setups, outcomes will be tracked across 4h, 24h, and 72h windows.
          Check back after the first signals resolve.
        </div>
      </div>
    )
  }

  const resolved = stats24h.overall.wins + stats24h.overall.losses + stats24h.overall.expired

  return (
    <div className="perf-dashboard">
      {/* Headline Scorecard */}
      <div className="perf-scorecard">
        <ScoreCard label="Setups" value={String(trackedSetups.length)} />
        <ScoreCard
          label="Win Rate (24h)"
          value={stats24h.overall.winRate !== null ? `${(stats24h.overall.winRate * 100).toFixed(0)}%` : '—'}
          tone={stats24h.overall.winRate !== null ? (stats24h.overall.winRate >= 0.5 ? 'green' : 'red') : undefined}
        />
        <ScoreCard
          label="Avg R (24h)"
          value={stats24h.overall.avgR !== null ? `${stats24h.overall.avgR >= 0 ? '+' : ''}${stats24h.overall.avgR.toFixed(1)}R` : '—'}
          tone={stats24h.overall.avgR !== null ? (stats24h.overall.avgR >= 0 ? 'green' : 'red') : undefined}
        />
        <ScoreCard label="Best Window" value={bestWindow} tone="green" />
      </div>

      {/* Timeframe Comparison */}
      <div className="perf-section">
        <div className="perf-section__title">Timeframe Comparison</div>
        {WINDOWS.map((w) => {
          const s = windowStats[w]
          const pct = s.winRate !== null ? s.winRate * 100 : 0
          const sample = s.wins + s.losses
          return (
            <div key={w} className="perf-bar-row">
              <span className="perf-bar-row__label">{w}</span>
              <div className="perf-bar">
                <div
                  className={`perf-bar__fill ${pct >= 50 ? 'perf-bar__fill--green' : 'perf-bar__fill--red'}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="perf-bar-row__value">
                {s.winRate !== null ? `${pct.toFixed(0)}%` : '—'}
              </span>
              <span className="perf-bar-row__sample">({sample} trades)</span>
            </div>
          )
        })}
      </div>

      {/* Coin Breakdown */}
      <div className="perf-section">
        <div className="perf-section__title">By Coin</div>
        {TRACKED_COINS.map((coin) => {
          const s = stats24h.byCoin[coin]
          if (!s) return (
            <div key={coin} className="perf-bar-row">
              <span className="perf-bar-row__label">{coin}</span>
              <div className="perf-bar" />
              <span className="perf-bar-row__value">—</span>
              <span className="perf-bar-row__sample">(0)</span>
            </div>
          )
          const pct = s.winRate !== null ? s.winRate * 100 : 0
          const sample = s.wins + s.losses
          return (
            <div key={coin} className="perf-bar-row">
              <span className="perf-bar-row__label">{coin}</span>
              <div className="perf-bar">
                <div
                  className={`perf-bar__fill ${pct >= 50 ? 'perf-bar__fill--green' : 'perf-bar__fill--red'}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="perf-bar-row__value">
                {s.winRate !== null ? `${pct.toFixed(0)}%` : '—'}
              </span>
              <span className="perf-bar-row__sample">({sample})</span>
            </div>
          )
        })}
      </div>

      {/* Actionable Insights */}
      <div className="perf-section">
        <div className="perf-section__title">Actionable Insights</div>
        <div className="perf-volume-row">
          <VolumeStat label="Generated" value={actionableCount.total} />
          <VolumeStat label="Actionable" value={actionableCount.actionable} tone="green" />
          <VolumeStat label="Resolved" value={resolved} />
          <VolumeStat label="Pending" value={stats24h.overall.pending} tone="yellow" />
        </div>
      </div>

      {/* R-Distribution */}
      {rDistribution.some((c) => c > 0) && (
        <div className="perf-section">
          <div className="perf-section__title">R-Distribution (24h)</div>
          <div className="perf-histogram">
            {R_BUCKETS.map((bucket, i) => {
              const maxCount = Math.max(...rDistribution, 1)
              const heightPct = ((rDistribution[i] ?? 0) / maxCount) * 100
              const isPositive = bucket.min >= 0
              return (
                <div key={bucket.label} className="perf-histogram__col">
                  <div className="perf-histogram__bar-wrap">
                    <div
                      className={`perf-histogram__bar ${isPositive ? 'perf-histogram__bar--green' : 'perf-histogram__bar--red'}`}
                      style={{ height: `${Math.max(heightPct, 3)}%` }}
                    />
                  </div>
                  <span className="perf-histogram__count">{rDistribution[i]}</span>
                  <span className="perf-histogram__label">{bucket.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Outcomes */}
      {recentOutcomes.length > 0 && (
        <div className="perf-section">
          <div className="perf-section__title">Recent Outcomes (24h window)</div>
          <div className="perf-outcome-strip">
            {recentOutcomes.map((o, i) => (
              <div key={i} className="perf-outcome-dot-wrap" title={`${o.coin} ${o.direction} → ${o.result}${o.rAchieved !== null ? ` (${o.rAchieved >= 0 ? '+' : ''}${o.rAchieved.toFixed(1)}R)` : ''}`}>
                <div className={`perf-outcome-dot perf-outcome-dot--${o.result}`} />
                <span className="perf-outcome-dot__label">{o.result === 'win' ? 'W' : o.result === 'loss' ? 'L' : 'E'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreCard({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  return (
    <div className="perf-score-card">
      <div className={`perf-score-card__value ${tone ? `perf-score-card__value--${tone}` : ''}`}>{value}</div>
      <div className="perf-score-card__label">{label}</div>
    </div>
  )
}

function VolumeStat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'yellow' }) {
  return (
    <div className="perf-volume-stat">
      <div className={`perf-volume-stat__value ${tone ? `perf-volume-stat__value--${tone}` : ''}`}>{value}</div>
      <div className="perf-volume-stat__label">{label}</div>
    </div>
  )
}
