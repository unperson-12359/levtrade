import type { SignalColor } from '../../types/signals'
import type { WorkflowAccessState, WorkflowVisualState } from '../../utils/workflowGuidance'
import { WORKFLOW_STEPS } from '../../utils/workflowGuidance'

interface StepLabelProps {
  step: 1 | 2 | 3
  tone?: SignalColor
  state?: WorkflowVisualState
  access?: WorkflowAccessState
  isCurrentFocus?: boolean
}

export function StepLabel({
  step,
  tone = 'yellow',
  state = 'wait',
  access = 'locked',
  isCurrentFocus = false,
}: StepLabelProps) {
  return (
    <span
      className={[
        'step-label',
        `step-label--${tone}`,
        `step-label--${access}`,
        `step-label--${state}`,
        isCurrentFocus ? 'step-label--current' : '',
      ].filter(Boolean).join(' ')}
    >
      <span className="step-label__number">{step}</span>
      <span className="step-label__copy">
        <span className="step-label__eyebrow">{`STEP ${step} OF 3`}</span>
        <span className="step-label__text">{WORKFLOW_STEPS[step].title}</span>
      </span>
    </span>
  )
}
