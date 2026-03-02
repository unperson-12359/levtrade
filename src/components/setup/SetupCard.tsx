import { useMemo, useState } from 'react'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { useSuggestedSetup } from '../../hooks/useSuggestedSetup'
import type { TrackedCoin } from '../../types'
import type { SignalColor } from '../../types/signals'
import { formatLeverage, formatPercent, formatPrice, formatUSD } from '../../utils/format'
import { SignalDrawer } from '../shared/SignalDrawer'

const toneTextClasses: Record<SignalColor, string> = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
}

interface SetupCardProps {
  coin: TrackedCoin
}

export function SetupCard({ coin }: SetupCardProps) {
  const setup = useSuggestedSetup(coin)
  const decision = useEntryDecision(coin)
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!setup) {
    return (
      <section className="panel-shell panel-shell--tight setup-card setup-card--empty">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Suggested setup</div>
            <h3 className="panel-title">No actionable setup right now</h3>
          </div>
          <span className={`status-pill status-pill--${decision.color}`}>{decision.label}</span>
        </div>
        <p className="panel-copy">
          The dashboard is not seeing a clean long or short setup at this time.
        </p>
        <div className="decision-strip__chips">
          {decision.reasons.map((reason) => (
            <span key={reason} className="warning-chip warning-chip--blue">
              {reason}
            </span>
          ))}
        </div>
        <SignalDrawer coin={coin} signalKind={drawerOpen ? 'setup' : null} onClose={() => setDrawerOpen(false)} />
      </section>
    )
  }

  const stopPct = ((setup.stopPrice - setup.entryPrice) / setup.entryPrice) * 100
  const targetPct = ((setup.targetPrice - setup.entryPrice) / setup.entryPrice) * 100
  const meanPct = ((setup.meanReversionTarget - setup.entryPrice) / setup.entryPrice) * 100
  const priceMarkers = useMemo(
    () => buildRangeMarkers(setup.entryPrice, setup.stopPrice, setup.targetPrice),
    [setup.entryPrice, setup.stopPrice, setup.targetPrice],
  )

  return (
    <section className="panel-shell setup-card">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Suggested setup</div>
          <h3 className="panel-title">Here is the full trade idea the dashboard sees</h3>
        </div>
        <div className="setup-card__badges">
          <span
            className={`setup-card__direction setup-card__direction--${setup.direction === 'long' ? 'green' : 'red'}`}
          >
            {setup.direction.toUpperCase()}
          </span>
          <span className={`status-pill status-pill--${setup.tradeGrade}`}>{setup.tradeGrade.toUpperCase()}</span>
          <span className={`status-pill status-pill--${tierTone(setup.confidenceTier)}`}>
            {setup.confidenceTier.toUpperCase()}
          </span>
          <button type="button" className="setup-card__verify" onClick={() => setDrawerOpen(true)}>
            Verify setup -&gt;
          </button>
        </div>
      </div>

      <div className="setup-card__confidence">
        <div>
          <div className="stat-label">Confidence</div>
          <div className={`stat-value ${toneTextClasses[tierTone(setup.confidenceTier)]}`}>
            {(setup.confidence * 100).toFixed(0)}%
          </div>
        </div>
        <div className="confidence-bar" aria-hidden="true">
          <div
            className="confidence-bar__fill"
            style={{ width: `${Math.max(6, setup.confidence * 100)}%` }}
          />
        </div>
      </div>

      <div className="setup-card__prices">
        <PriceStat coin={coin} label="Entry" price={setup.entryPrice} helper="Current setup trigger" tone="yellow" />
        <PriceStat coin={coin} label="Stop" price={setup.stopPrice} helper={`${formatPercent(stopPct, 1)} from entry`} tone="red" />
        <PriceStat coin={coin} label="Target" price={setup.targetPrice} helper={`${formatPercent(targetPct, 1)} from entry`} tone="green" />
        <PriceStat
          coin={coin}
          label="Mean-reversion target"
          price={setup.meanReversionTarget}
          helper={`${formatPercent(meanPct, 1)} from entry`}
          tone="yellow"
        />
      </div>

      <div className="price-range-bar">
        <div className="price-range-bar__track" />
        <span
          className="price-range-bar__marker price-range-bar__marker--stop"
          style={{ left: `${priceMarkers.stop}%` }}
        />
        <span
          className="price-range-bar__marker price-range-bar__marker--entry"
          style={{ left: `${priceMarkers.entry}%` }}
        />
        <span
          className="price-range-bar__marker price-range-bar__marker--target"
          style={{ left: `${priceMarkers.target}%` }}
        />
      </div>

      <div className="stat-grid">
        <Stat label="R:R" value={`${setup.rrRatio.toFixed(1)} : 1`} tone="green" />
        <Stat label="Suggested leverage" value={formatLeverage(setup.suggestedLeverage)} tone="yellow" />
        <Stat label="Suggested size" value={formatUSD(setup.suggestedPositionSize)} tone="green" />
        <Stat label="Entry quality" value={setup.entryQuality.replace('-', ' ').toUpperCase()} tone={entryQualityTone(setup.entryQuality)} />
        <Stat label="Signal alignment" value={`${setup.agreementCount}/${setup.agreementTotal}`} tone="yellow" />
        <Stat label="Expected timeframe" value={setup.timeframe} tone="yellow" />
      </div>

      <div className="setup-card__summary">
        {setup.summary}
      </div>
      <SignalDrawer
        coin={coin}
        signalKind={drawerOpen ? 'setup' : null}
        setup={setup}
        onClose={() => setDrawerOpen(false)}
      />
    </section>
  )
}

function PriceStat({
  coin,
  label,
  price,
  helper,
  tone,
}: {
  coin: TrackedCoin
  label: string
  price: number
  helper: string
  tone: SignalColor
}) {
  return (
    <div className="workflow-summary-card">
      <div className="workflow-summary-card__kicker">{label}</div>
      <div className={`workflow-summary-card__value ${toneTextClasses[tone]}`}>{formatPrice(price, coin)}</div>
      <div className="workflow-summary-card__copy">{helper}</div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: SignalColor }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneTextClasses[tone]}`}>{value}</div>
    </div>
  )
}

function tierTone(tier: 'high' | 'medium' | 'low'): SignalColor {
  if (tier === 'high') return 'green'
  if (tier === 'medium') return 'yellow'
  return 'red'
}

function entryQualityTone(entryQuality: string): SignalColor {
  if (entryQuality === 'ideal') return 'green'
  if (entryQuality === 'extended' || entryQuality === 'early') return 'yellow'
  return 'red'
}

function buildRangeMarkers(entry: number, stop: number, target: number) {
  const min = Math.min(entry, stop, target)
  const max = Math.max(entry, stop, target)
  const span = Math.max(max - min, 1e-9)

  return {
    stop: ((stop - min) / span) * 100,
    entry: ((entry - min) / span) * 100,
    target: ((target - min) / span) * 100,
  }
}
