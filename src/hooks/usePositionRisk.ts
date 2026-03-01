import { useMemo } from 'react'
import { useStore } from '../store'
import { computeRisk } from '../signals/risk'
import type { RiskStatus } from '../types/signals'

export function usePositionRisk() {
  const riskInputs = useStore((s) => s.riskInputs)
  const updateRiskInput = useStore((s) => s.updateRiskInput)
  const resetRiskInputs = useStore((s) => s.resetRiskInputs)
  const signals = useStore((s) => s.signals[riskInputs.coin])

  const riskOutputs = useMemo(() => {
    if (riskInputs.entryPrice <= 0) return null
    const atr = signals?.volatility.atr ?? 0
    return computeRisk(riskInputs, atr)
  }, [riskInputs, signals?.volatility.atr])

  const riskStatus: RiskStatus = riskOutputs
    ? riskOutputs.tradeGrade === 'green'
      ? 'safe'
      : riskOutputs.tradeGrade === 'yellow'
        ? 'borderline'
        : 'danger'
    : 'unknown'

  return {
    inputs: riskInputs,
    outputs: riskOutputs,
    updateInput: updateRiskInput,
    resetInputs: resetRiskInputs,
    riskStatus,
    isReady: riskOutputs !== null,
  }
}
