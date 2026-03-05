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
  const compactSummary = compactText(hero.summary, 110)
  const compactAction = compactText(hero.action, 92)
  const compactNextStep = compactText(hero.nextStep, 92)

  return (
    <section className={`decision-hero decision-hero--${hero.tone}`}>
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Begin Here</div>
          <h2 className="decision-hero__title">{hero.title}</h2>
        </div>
        <span className={`status-pill status-pill--${hero.tone}`}>{hero.badge}</span>
      </div>

      <p className="decision-hero__summary decision-hero__summary--compact" title={hero.summary}>
        {compactSummary}
      </p>

      <div className="workflow-summary-grid workflow-summary-grid--hero decision-hero__pair">
        <article className="workflow-summary-card decision-hero__pair-card decision-hero__pair-card--action">
          <div className="workflow-summary-card__kicker">What to do now</div>
          <p className="workflow-summary-card__copy" title={hero.action}>{compactAction}</p>
        </article>
        <article className="workflow-summary-card decision-hero__pair-card decision-hero__pair-card--wait">
          <div className="workflow-summary-card__kicker">What to wait for</div>
          <p className="workflow-summary-card__copy" title={hero.nextStep}>{compactNextStep}</p>
        </article>
      </div>

      {hero.bullets.length > 0 && (
        <div className="decision-hero__reasons">
          <div className="workflow-summary-card__kicker decision-hero__reasons-label">Why the dashboard is saying this</div>
          <div className="decision-strip__chips decision-hero__reason-chips">
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

function compactText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}
