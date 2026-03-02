import { useMemo, useState } from 'react'
import { useSetupStats } from '../../hooks/useSetupStats'
import { useStore } from '../../store'
import { TRACKED_COINS, type TrackedCoin } from '../../types'
import type { SetupOutcome, SetupWindow, TierStats } from '../../types/setup'
import { formatPrice } from '../../utils/format'

type SetupFilter = 'ALL' | TrackedCoin

export function SetupHistory() {
  const [statsWindow, setStatsWindow] = useState<SetupWindow>('24h')
  const stats = useSetupStats(statsWindow)
  const trackedSetups = useStore((s) => s.trackedSetups)
  const exportCsv = useStore((s) => s.exportSetupsCsv)
  const [filter, setFilter] = useState<SetupFilter>('ALL')

  const recentSetups = useMemo(() => {
    const filtered =
      filter === 'ALL'
        ? trackedSetups
        : trackedSetups.filter((tracked) => tracked.setup.coin === filter)

    return [...filtered]
      .sort((a, b) => b.setup.generatedAt - a.setup.generatedAt)
      .slice(0, 20)
  }, [filter, trackedSetups])

  const historyMeta = useMemo(() => {
    const outcomes = trackedSetups.map((tracked) => tracked.outcomes[statsWindow])
    return {
      pendingCount: outcomes.filter((outcome) => outcome.result === 'pending').length,
      unresolvableCount: outcomes.filter((outcome) => outcome.result === 'unresolvable').length,
      oldest: trackedSetups.length > 0 ? trackedSetups[0]!.setup.generatedAt : null,
      newest: trackedSetups.length > 0 ? trackedSetups[trackedSetups.length - 1]!.setup.generatedAt : null,
    }
  }, [statsWindow, trackedSetups])

  return (
    <section className="panel-shell setup-history">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Setup history</div>
          <h3 className="panel-title">How suggested setups have performed</h3>
        </div>
        <div className="setup-history__header-actions">
          <span className="status-pill status-pill--yellow">{statsWindow} primary scoring</span>
          <button type="button" onClick={exportCsv} className="setup-history__filter">
            Export CSV
          </button>
        </div>
      </div>

      <p className="panel-copy">
        This history is saved locally in this browser. Outcomes are scored from hourly candles over the selected
        scoring window, so unresolved and unresolvable rows reflect whether enough future candles exist yet.
      </p>

      <div className="stat-grid setup-history__summary">
        <Stat label="Tracked setups" value={String(stats.totalSetups)} tone="yellow" />
        <Stat label="Overall win rate" value={formatRate(stats.overall.winRate)} tone={tierTone(stats.overall)} />
        <Stat label="Average R" value={formatR(stats.overall.avgR)} tone={tierTone(stats.overall)} />
        <Stat label="Best / worst R" value={`${formatR(stats.overall.bestR)} / ${formatR(stats.overall.worstR)}`} tone="yellow" />
        <Stat label="Pending" value={String(historyMeta.pendingCount)} tone="yellow" />
        <Stat label="Unresolvable" value={String(historyMeta.unresolvableCount)} tone={historyMeta.unresolvableCount > 0 ? 'red' : 'green'} />
        <Stat label="Oldest setup" value={historyMeta.oldest ? formatTimestamp(historyMeta.oldest) : 'N/A'} tone="yellow" />
        <Stat label="Newest setup" value={historyMeta.newest ? formatTimestamp(historyMeta.newest) : 'N/A'} tone="yellow" />
      </div>

      <div className="tracker-table-wrap setup-history__tier-table">
        <div className="tracker-table">
          <div className="tracker-row tracker-row--head setup-history__tier-row">
            <span>Tier</span>
            <span>Setups</span>
            <span>Win Rate</span>
            <span>Avg R</span>
            <span>Avg MFE</span>
            <span>Avg MAE</span>
          </div>
          {(['high', 'medium', 'low'] as const).map((tier) => {
            const tierStats = stats.byTier[tier]
            const tone = tierTone(tierStats)
            return (
              <div key={tier} className={`tracker-row setup-history__tier-row setup-history__tier-row--${tone}`}>
                <span>{tier.toUpperCase()}</span>
                <span>{tierStats.count}</span>
                <span>{formatRate(tierStats.winRate)}</span>
                <span>{formatR(tierStats.avgR)}</span>
                <span>{formatPct(tierStats.avgMfePct)}</span>
                <span>{formatPct(tierStats.avgMaePct)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="setup-history__filters">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={filter === 'ALL' ? 'setup-history__filter setup-history__filter--active' : 'setup-history__filter'}
        >
          All
        </button>
        {TRACKED_COINS.map((coin) => (
          <button
            type="button"
            key={coin}
            onClick={() => setFilter(coin)}
            className={filter === coin ? 'setup-history__filter setup-history__filter--active' : 'setup-history__filter'}
          >
            {coin}
          </button>
        ))}
      </div>

      <div className="setup-history__filters">
        {(['4h', '24h', '72h'] as const).map((window) => (
          <button
            key={window}
            type="button"
            onClick={() => setStatsWindow(window)}
            className={
              statsWindow === window
                ? 'setup-history__filter setup-history__filter--active'
                : 'setup-history__filter'
            }
          >
            {window}
          </button>
        ))}
      </div>

      <div className="tracker-table-wrap">
        <div className="tracker-table">
          <div className="tracker-row tracker-row--head setup-history__recent-row">
            <span>Time</span>
            <span>Coin</span>
            <span>Dir</span>
            <span>Entry</span>
            <span>Stop</span>
            <span>Target</span>
            <span>Conf</span>
            <span>4h</span>
            <span>24h</span>
            <span>72h</span>
          </div>
          {recentSetups.length > 0 ? (
            recentSetups.map((tracked) => (
              <div key={tracked.id} className="tracker-row setup-history__recent-row">
                <span>{formatTimestamp(tracked.setup.generatedAt)}</span>
                <span>{tracked.setup.coin}</span>
                <span>{tracked.setup.direction.toUpperCase()}</span>
                <span>{formatPrice(tracked.setup.entryPrice, tracked.setup.coin)}</span>
                <span>{formatPrice(tracked.setup.stopPrice, tracked.setup.coin)}</span>
                <span>{formatPrice(tracked.setup.targetPrice, tracked.setup.coin)}</span>
                <span>{tracked.setup.confidenceTier.toUpperCase()}</span>
                <OutcomeCell outcome={tracked.outcomes['4h']} />
                <OutcomeCell outcome={tracked.outcomes['24h']} />
                <OutcomeCell outcome={tracked.outcomes['72h']} />
              </div>
            ))
          ) : (
            <div className="tracker-row">
              <span>No setups tracked yet for this filter.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function OutcomeCell({ outcome }: { outcome: SetupOutcome }) {
  if (outcome.result === 'pending') {
    return (
      <div className="setup-history__outcome">
        <span className="text-text-muted">--</span>
        <span className="setup-history__outcome-note">pending</span>
      </div>
    )
  }

  const tone =
    outcome.result === 'win'
      ? 'text-signal-green'
      : outcome.result === 'loss'
        ? 'text-signal-red'
        : outcome.result === 'unresolvable'
          ? 'text-signal-red'
          : 'text-signal-yellow'

  const label =
    outcome.result === 'unresolvable'
      ? 'UNRESOLVABLE'
      : `${outcome.result.toUpperCase()} (${formatR(outcome.rAchieved)})`

  const note = [
    outcome.resolutionReason ?? 'not recorded',
    outcome.coverageStatus ?? 'legacy',
  ]
    .filter(Boolean)
    .join(' • ')

  return (
    <div className="setup-history__outcome">
      <span className={tone}>{label}</span>
      <span className="setup-history__outcome-note">{note}</span>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'green' | 'yellow' | 'red' }) {
  const toneClasses = {
    green: 'text-signal-green',
    yellow: 'text-signal-yellow',
    red: 'text-signal-red',
  } as const

  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClasses[tone]}`}>{value}</div>
    </div>
  )
}

function tierTone(stats: TierStats): 'green' | 'yellow' | 'red' {
  if (stats.winRate === null) {
    return 'yellow'
  }
  if (stats.winRate > 0.6) {
    return 'green'
  }
  if (stats.winRate >= 0.4) {
    return 'yellow'
  }
  return 'red'
}

function formatRate(value: number | null): string {
  return value === null ? 'N/A' : `${(value * 100).toFixed(0)}%`
}

function formatR(value: number | null): string {
  if (value === null) {
    return 'N/A'
  }
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}R`
}

function formatPct(value: number | null): string {
  if (value === null) {
    return 'N/A'
  }
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
