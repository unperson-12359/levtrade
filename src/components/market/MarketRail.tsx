import { useStore } from '../../store'
import { useSignals } from '../../hooks/useSignals'
import { formatFundingRate, formatPercent, timeAgo } from '../../utils/format'
import { StepLabel } from '../methodology/StepLabel'
import { JargonTerm } from '../shared/JargonTerm'

const toneClasses = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
} as const

export function MarketRail() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals, isWarmingUp, warmupProgress } = useSignals(coin)

  if (!signals) {
    return (
      <aside className="rail-stack">
        <section className="panel-shell">
          <div className="panel-kicker">Market Rail</div>
          <div className="loading-block h-24" />
        </section>
      </aside>
    )
  }

  const regimeGuidance = signals.hurst.color === 'green'
    ? { text: 'Regime is favorable. Check signals below. \u2192', tone: 'green' as const }
    : signals.hurst.color === 'yellow'
    ? { text: 'Regime is choppy. Signals will be unreliable.', tone: 'yellow' as const }
    : { text: 'Market is trending. Sit this one out.', tone: 'red' as const }

  return (
    <aside className="rail-stack">
      {(isWarmingUp || signals.isStale) && (
        <section className="panel-shell panel-shell--tight">
          {isWarmingUp && (
            <div className="warning-chip warning-chip--yellow">
              Warmup {(warmupProgress * 100).toFixed(0)}%
            </div>
          )}
          {signals.isStale && (
            <div className="warning-chip warning-chip--red">
              Last computed {timeAgo(signals.updatedAt)}
            </div>
          )}
        </section>
      )}

      <section className="panel-shell panel-shell--tight">
        <StepLabel step={1} />
        <div className="panel-kicker">Regime</div>
        <div className={`mini-panel-title ${toneClasses[signals.hurst.color]}`}>
          {signals.hurst.regime.toUpperCase()}
        </div>
        <div className="rail-rows">
          <div className="rail-row">
            <span><JargonTerm term="Hurst" /></span>
            <span className="font-mono text-text-primary">{signals.hurst.value.toFixed(3)}</span>
          </div>
          <div className="rail-row">
            <span>Confidence</span>
            <span className="font-mono text-text-primary">{(signals.hurst.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        <p className="panel-copy">{signals.hurst.explanation}</p>
        <div className={`action-guidance action-guidance--${regimeGuidance.tone}`}>
          {regimeGuidance.text}
        </div>
      </section>

      <MiniPanel
        kicker="Volatility"
        title={signals.volatility.level.toUpperCase()}
        tone={signals.volatility.color}
        rows={[
          { label: 'Realized Vol', value: `${signals.volatility.realizedVol.toFixed(1)}%` },
          { label: <JargonTerm term="ATR" />, value: signals.volatility.atr.toFixed(2) },
        ]}
        copy={signals.volatility.explanation}
      />

      <MiniPanel
        kicker="Funding"
        title={signals.funding.label}
        tone={signals.funding.color}
        rows={[
          { label: <JargonTerm term="Funding Rate">Rate</JargonTerm>, value: formatFundingRate(signals.funding.currentRate) },
          { label: <JargonTerm term="Z-Score">Z-Score</JargonTerm>, value: signals.funding.zScore.toFixed(2) },
        ]}
        copy={signals.funding.explanation}
      />

      <MiniPanel
        kicker="Money Flow"
        title={signals.oiDelta.label}
        tone={signals.oiDelta.color}
        rows={[
          { label: <JargonTerm term="OI Delta">OI Delta</JargonTerm>, value: formatPercent(signals.oiDelta.oiChangePct * 100, 2) },
          { label: 'Price Delta', value: formatPercent(signals.oiDelta.priceChangePct * 100, 2) },
        ]}
        copy={signals.oiDelta.explanation}
      />

      <MiniPanel
        kicker="Composite"
        title={signals.composite.label}
        tone={signals.composite.color}
        rows={[
          { label: <JargonTerm term="Composite">Score</JargonTerm>, value: signals.composite.value.toFixed(2) },
          { label: 'Agreement', value: `${signals.composite.agreementCount}/${signals.composite.agreementTotal}` },
        ]}
        copy={signals.composite.explanation}
      />
    </aside>
  )
}

interface MiniPanelProps {
  kicker: string
  title: string
  tone: 'green' | 'yellow' | 'red'
  rows: Array<{ label: React.ReactNode; value: string }>
  copy: string
}

function MiniPanel({ kicker, title, tone, rows, copy }: MiniPanelProps) {
  return (
    <section className="panel-shell panel-shell--tight">
      <div className="panel-kicker">{kicker}</div>
      <div className={`mini-panel-title ${toneClasses[tone]}`}>{title}</div>
      <div className="rail-rows">
        {rows.map((row, i) => (
          <div key={i} className="rail-row">
            <span>{row.label}</span>
            <span className="font-mono text-text-primary">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="panel-copy">{copy}</p>
    </section>
  )
}
