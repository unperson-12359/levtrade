import { useStore } from '../../store'
import { useSignals } from '../../hooks/useSignals'
import { JargonTerm } from '../shared/JargonTerm'

const meterToneClasses = {
  green: 'bg-signal-green',
  yellow: 'bg-signal-yellow',
  red: 'bg-signal-red',
} as const

const textToneClasses = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
} as const

export function EntryGeometryPanel() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)

  if (!signals) {
    return (
      <section className="panel-shell">
        <div className="panel-kicker">Entry Geometry</div>
        <div className="loading-block h-32" />
      </section>
    )
  }

  const entry = signals.entryGeometry

  return (
    <section className="panel-shell">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Entry Geometry</div>
          <h3 className="panel-title">Stretch and bounce setup</h3>
        </div>
        <span className={`status-pill status-pill--${entry.color}`}>
          {entry.entryQuality.replace('-', ' ').toUpperCase()}
        </span>
      </div>

      <div className="stat-grid">
        <Stat label="Distance From Mean" value={`${entry.distanceFromMeanPct.toFixed(2)}%`} tone={entry.color} />
        <Stat label={<JargonTerm term="Stretch" />} value={`${entry.stretchZEquivalent.toFixed(2)}\u03C3`} tone={entry.color} />
        <Stat label={<JargonTerm term="ATR">ATR Dislocation</JargonTerm>} value={`${entry.atrDislocation.toFixed(2)}x`} tone={entry.color} />
        <Stat label="Bias" value={entry.directionBias.toUpperCase()} tone={entry.color} />
      </div>

      <div className="meter-block">
        <div>
          <div className="meter-label">Reversion Potential</div>
          <div className="meter-bar">
            <div
              className={`meter-fill ${meterToneClasses[entry.color]}`}
              style={{ width: `${entry.reversionPotential * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="meter-label">Chase Risk</div>
          <div className="meter-bar">
            <div
              className="meter-fill bg-signal-red"
              style={{ width: `${entry.chaseRisk * 100}%` }}
            />
          </div>
        </div>
      </div>

      <p className="panel-copy">{entry.explanation}</p>
      <div className={`action-guidance action-guidance--${entry.color}`}>
        {entry.color === 'green'
          ? 'Price is in the sweet spot for a mean-reversion entry.'
          : entry.color === 'yellow'
          ? 'Setup is forming but not ideal yet. Watch for more stretch.'
          : 'Price is too close to average or too overextended. Wait.'}
      </div>
    </section>
  )
}

interface StatProps {
  label: React.ReactNode
  value: string
  tone: 'green' | 'yellow' | 'red'
}

function Stat({ label, value, tone }: StatProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${textToneClasses[tone]}`}>{value}</div>
    </div>
  )
}
