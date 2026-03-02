import { useEntryDecision } from '../../hooks/useEntryDecision'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useSignals } from '../../hooks/useSignals'
import { useStore } from '../../store'
import { getMethodologySteps } from '../../utils/workflowGuidance'

export function MethodologyBanner() {
  const coin = useStore((s) => s.selectedCoin)
  const expanded = useStore((s) => s.expandedSections['methodology'] !== false)
  const toggle = useStore((s) => s.toggleSection)
  const { signals } = useSignals(coin)
  const decision = useEntryDecision(coin)
  const { outputs, riskStatus } = usePositionRisk()
  const steps = getMethodologySteps(signals, decision, outputs, riskStatus)
  const contentId = 'methodology-banner-content'

  return (
    <div className="methodology-banner">
      <button
        type="button"
        onClick={() => toggle('methodology')}
        className="methodology-banner__header"
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span className="methodology-banner__title">HOW TO USE THIS DASHBOARD</span>
        <span className={`methodology-banner__chevron ${expanded ? 'methodology-banner__chevron--open' : ''}`}>
          &#9660;
        </span>
      </button>

      {expanded && (
        <div id={contentId} className="methodology-steps">
          {steps.map((step) => (
            <div
              key={step.step}
              className={`methodology-step methodology-step--${step.status}`}
            >
              <div className="methodology-step__header">
                <span className={`methodology-step__dot methodology-step__dot--${step.tone}`} />
                <span className="methodology-step__name">{step.title}</span>
              </div>
              <div className="methodology-step__question">{step.question}</div>
              <div className={`methodology-step__label methodology-step__label--${step.tone}`}>
                {step.label}
              </div>
              <div className="methodology-step__detail">{step.detail}</div>
              <div className="methodology-step__hint">{step.successRule}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
