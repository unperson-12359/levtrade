import { useStore } from '../../store'
import { useSignals } from '../../hooks/useSignals'
import { StepLabel } from '../methodology/StepLabel'
import { JargonTerm } from '../shared/JargonTerm'

const toneClasses = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
} as const

export function SignalSection() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)

  if (!signals) {
    return (
      <section className="panel-shell">
        <div className="panel-kicker">Signal Breakdown</div>
        <div className="loading-block h-24" />
      </section>
    )
  }

  const compositeVal = signals.composite.value
  const direction = compositeVal > 0 ? 'LONG' : compositeVal < 0 ? 'SHORT' : 'NEUTRAL'
  const signalGuidance = signals.composite.color === 'green'
    ? { text: `Signals aligned for ${direction}. Check your risk below. \u2192`, tone: 'green' as const }
    : signals.composite.color === 'yellow'
    ? { text: `Signals leaning ${direction} but not fully aligned. Consider waiting.`, tone: 'yellow' as const }
    : { text: 'No directional edge right now. Wait for signal clarity.', tone: 'red' as const }

  return (
    <section className="panel-shell">
      <StepLabel step={2} />
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Signal Breakdown</div>
          <h3 className="panel-title">What is leaning into the setup?</h3>
        </div>
        <span className={`status-pill status-pill--${signals.composite.color}`}>
          {signals.composite.label}
        </span>
      </div>

      <div className="breakdown-grid">
        {signals.composite.signalBreakdown.map((signal) => (
          <div key={signal.name} className="stat-card">
            <div className="stat-label">{signal.name}</div>
            <div className={`stat-value ${signal.agrees ? 'text-signal-green' : signal.direction === 'neutral' ? 'text-text-muted' : 'text-signal-red'}`}>
              {signal.direction.toUpperCase()}
            </div>
            <div className="text-sm text-text-secondary">
              {signal.agrees ? 'Aligned with entry' : signal.direction === 'neutral' ? 'Not active' : 'Pushing back'}
            </div>
          </div>
        ))}
      </div>

      <div className="stat-grid">
        <Metric label={<JargonTerm term="Z-Score">Price Position</JargonTerm>} value={`${signals.zScore.value.toFixed(2)}\u03C3`} tone={signals.zScore.color} />
        <Metric label={<JargonTerm term="Funding Rate">Crowd Positioning</JargonTerm>} value={`${signals.funding.zScore.toFixed(2)}\u03C3`} tone={signals.funding.color} />
        <Metric label={<JargonTerm term="OI Delta">Money Flow</JargonTerm>} value={signals.oiDelta.confirmation ? 'CONFIRMED' : 'DIVERGING'} tone={signals.oiDelta.color} />
        <Metric label={<JargonTerm term="Composite" />} value={signals.composite.value.toFixed(2)} tone={signals.composite.color} />
      </div>

      <div className={`action-guidance action-guidance--${signalGuidance.tone}`}>
        {signalGuidance.text}
      </div>
    </section>
  )
}

interface MetricProps {
  label: React.ReactNode
  value: string
  tone: 'green' | 'yellow' | 'red'
}

function Metric({ label, value, tone }: MetricProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClasses[tone]}`}>{value}</div>
    </div>
  )
}
