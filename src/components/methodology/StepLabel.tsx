const STEP_NAMES: Record<number, string> = {
  1: 'REGIME CHECK',
  2: 'SIGNAL CHECK',
  3: 'RISK CHECK',
}

interface StepLabelProps {
  step: 1 | 2 | 3
}

export function StepLabel({ step }: StepLabelProps) {
  return (
    <span className="step-label">
      <span className="step-label__number">{step}</span>
      <span className="step-label__text">{STEP_NAMES[step]}</span>
    </span>
  )
}
