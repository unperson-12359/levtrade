import { useEntryDecision } from '../../hooks/useEntryDecision'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useSignals } from '../../hooks/useSignals'
import { useStore } from '../../store'
import { getDecisionHeroGuidance } from '../../utils/workflowGuidance'

export function DecisionHero() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)
  const decision = useEntryDecision(coin)
  const { outputs, riskStatus } = usePositionRisk()
  const hero = getDecisionHeroGuidance(coin, signals, decision, outputs, riskStatus)

  return (
    <section className={`decision-hero decision-hero--${hero.tone}`}>
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Begin Here</div>
          <h2 className="decision-hero__title">{hero.title}</h2>
        </div>
        <span className={`status-pill status-pill--${hero.tone}`}>{hero.badge}</span>
      </div>

      <p className="decision-hero__summary">{hero.summary}</p>

      <div className="workflow-summary-grid workflow-summary-grid--hero">
        <article className="workflow-summary-card">
          <div className="workflow-summary-card__kicker">What to do now</div>
          <p className="workflow-summary-card__copy">{hero.action}</p>
        </article>
        <article className="workflow-summary-card">
          <div className="workflow-summary-card__kicker">What to wait for</div>
          <p className="workflow-summary-card__copy">{hero.nextStep}</p>
        </article>
      </div>

      {hero.bullets.length > 0 && (
        <div className="decision-hero__reasons">
          <div className="workflow-summary-card__kicker">Why the dashboard is saying this</div>
          <div className="decision-strip__chips">
            {hero.bullets.map((bullet) => (
              <span key={bullet} className="warning-chip warning-chip--blue">
                {bullet}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
