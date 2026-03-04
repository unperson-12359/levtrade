import { useEntryDecision } from '../../hooks/useEntryDecision'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useSuggestedPosition } from '../../hooks/useSuggestedPosition'
import { useSignals } from '../../hooks/useSignals'
import { useStore } from '../../store'
import { getWorkflowStepStates } from '../../utils/workflowGuidance'
import { StepLabel } from '../methodology/StepLabel'
import { RiskForm } from './RiskForm'
import { RiskResults } from './RiskResults'

export function RiskSection() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)
  const decision = useEntryDecision(coin)
  const { outputs, riskStatus } = usePositionRisk()
  const composition = useSuggestedPosition(coin)
  const [, , step3] = getWorkflowStepStates(signals, decision, outputs, riskStatus, composition)

  return (
    <aside className="risk-stack risk-stack--compact">
      <section
        className={[
          'panel-shell',
          'workflow-card',
          'risk-section--compact',
          `workflow-card--${step3.tone}`,
          `workflow-card--${step3.state}`,
          `workflow-card--${step3.access}`,
          step3.isCurrentFocus ? 'workflow-card--pulse' : '',
        ].join(' ')}
      >
        <StepLabel
          step={3}
          tone={step3.tone}
          state={step3.state}
          access={step3.access}
          isCurrentFocus={step3.isCurrentFocus}
        />
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Step 3</div>
            <h2 className="panel-title risk-section__title">Position composition</h2>
          </div>
          <span className={`status-pill status-pill--${step3.tone}`}>{step3.label}</span>
        </div>
        <p className="panel-copy risk-section__detail" title={step3.detail}>{step3.detail}</p>
        <RiskForm />
        <RiskResults />
      </section>
    </aside>
  )
}
