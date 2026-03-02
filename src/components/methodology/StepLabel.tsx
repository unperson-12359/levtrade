import { WORKFLOW_STEPS } from '../../utils/workflowGuidance'

interface StepLabelProps {
  step: 1 | 2 | 3
}

export function StepLabel({ step }: StepLabelProps) {
  return (
    <span className="step-label">
      <span className="step-label__number">{step}</span>
      <span className="step-label__text">{WORKFLOW_STEPS[step].title}</span>
    </span>
  )
}
