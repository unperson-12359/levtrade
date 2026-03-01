import { useStore } from '../../store'
import { useSignals } from '../../hooks/useSignals'
import { usePositionRisk } from '../../hooks/usePositionRisk'

type StepStatus = 'active' | 'done' | 'pending'

interface StepState {
  status: StepStatus
  label: string
  detail: string
  color: 'green' | 'yellow' | 'red'
}

export function MethodologyBanner() {
  const coin = useStore((s) => s.selectedCoin)
  const expanded = useStore((s) => s.expandedSections['methodology'] !== false) // default expanded
  const toggle = useStore((s) => s.toggleSection)
  const { signals } = useSignals(coin)
  const { outputs } = usePositionRisk()

  const steps = computeSteps(signals, outputs)

  return (
    <div className="methodology-banner">
      <button
        onClick={() => toggle('methodology')}
        className="methodology-banner__header"
      >
        <span className="methodology-banner__title">HOW TO READ THIS DASHBOARD</span>
        <span className={`methodology-banner__chevron ${expanded ? 'methodology-banner__chevron--open' : ''}`}>
          &#9660;
        </span>
      </button>

      {expanded && (
        <div className="methodology-steps">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`methodology-step ${step.status === 'active' ? 'methodology-step--active' : ''}`}
            >
              <div className="methodology-step__header">
                <span className={`methodology-step__dot methodology-step__dot--${step.color}`} />
                <span className="methodology-step__name">Step {i + 1}</span>
              </div>
              <div className={`methodology-step__label methodology-step__label--${step.color}`}>
                {step.label}
              </div>
              <div className="methodology-step__detail">{step.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function computeSteps(
  signals: ReturnType<typeof useSignals>['signals'],
  outputs: ReturnType<typeof usePositionRisk>['outputs'],
): [StepState, StepState, StepState] {
  // Step 1: Regime
  const regimeColor = signals?.hurst.color ?? 'yellow'
  const regimeDone = regimeColor === 'green'
  const regimeLabel = !signals
    ? 'LOADING'
    : signals.hurst.regime.toUpperCase()

  let regimeDetail: string
  if (!signals) {
    regimeDetail = 'Waiting for market data...'
  } else if (regimeColor === 'red') {
    regimeDetail = 'Market is trending. Sit this one out.'
  } else if (regimeColor === 'yellow') {
    regimeDetail = 'Regime is choppy. Signals may be unreliable.'
  } else {
    regimeDetail = 'Regime is favorable. Check signals below.'
  }

  // Step 2: Signals
  const compositeColor = signals?.composite.color ?? 'yellow'
  const signalsDone = regimeDone && (compositeColor === 'green')
  const signalsLabel = !signals
    ? 'WAITING'
    : signals.composite.label

  let signalsDetail: string
  if (!regimeDone) {
    signalsDetail = 'Complete Step 1 first.'
  } else if (compositeColor === 'green') {
    signalsDetail = 'Signals aligned. Size your position below.'
  } else if (compositeColor === 'yellow') {
    signalsDetail = 'Signals leaning but not fully aligned. Consider waiting.'
  } else {
    signalsDetail = 'No directional edge right now. Wait for clarity.'
  }

  // Step 3: Risk
  const tradeGrade = outputs?.tradeGrade ?? 'yellow'
  const riskLabel = !outputs
    ? 'NOT SET'
    : outputs.tradeGradeLabel
  let riskDetail: string
  if (!signalsDone) {
    riskDetail = 'Complete Steps 1–2 first.'
  } else if (!outputs) {
    riskDetail = 'Enter trade parameters above.'
  } else if (tradeGrade === 'green') {
    riskDetail = 'Trade parameters look good. You can proceed.'
  } else if (tradeGrade === 'yellow') {
    riskDetail = 'Acceptable but tight. Consider reducing leverage.'
  } else {
    riskDetail = 'Do not enter with these parameters.'
  }

  // Determine which step is "active"
  const step1Status: StepStatus = regimeDone ? 'done' : 'active'
  const step2Status: StepStatus = !regimeDone ? 'pending' : signalsDone ? 'done' : 'active'
  const step3Status: StepStatus = !signalsDone ? 'pending' : 'active'

  return [
    { status: step1Status, label: regimeLabel, detail: regimeDetail, color: regimeColor },
    { status: step2Status, label: signalsLabel, detail: signalsDetail, color: compositeColor },
    { status: step3Status, label: riskLabel, detail: riskDetail, color: tradeGrade },
  ]
}
