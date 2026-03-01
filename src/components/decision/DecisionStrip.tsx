import { useEntryDecision } from '../../hooks/useEntryDecision'
import { useStore } from '../../store'

const chipToneClasses = {
  green: 'bg-signal-green/10 text-signal-green border-signal-green/20',
  yellow: 'bg-signal-yellow/10 text-signal-yellow border-signal-yellow/20',
  red: 'bg-signal-red/10 text-signal-red border-signal-red/20',
} as const

export function DecisionStrip() {
  const coin = useStore((s) => s.selectedCoin)
  const decision = useEntryDecision(coin)

  return (
    <section className="decision-strip">
      <div className="decision-strip__headline">
        <span className={`status-pill status-pill--${decision.color}`}>{decision.label}</span>
        <div>
          <div className="panel-kicker">Decision</div>
          <h2 className="panel-title">{coin} entry checkpoint</h2>
        </div>
      </div>

      <div className="decision-strip__chips">
        {decision.reasons.map((reason) => (
          <span
            key={reason}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${chipToneClasses[decision.color]}`}
          >
            {reason}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        {decision.action === 'long' || decision.action === 'short'
          ? `Conditions are favorable for a ${decision.action} entry. Scroll down to review signal details and size your position.`
          : decision.action === 'wait'
          ? 'Some conditions are not yet met. Review the steps below to see what is holding back an entry.'
          : 'Conditions are unfavorable. Do not enter a trade right now.'}
      </p>
    </section>
  )
}
