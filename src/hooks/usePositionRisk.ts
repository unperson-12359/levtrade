import { useStore } from '../store'
import type { RiskStatus } from '../types/signals'
import { useSuggestedPosition } from './useSuggestedPosition'

export function usePositionRisk() {
  const selectedCoin = useStore((s) => s.selectedCoin)
  const updateRiskInput = useStore((s) => s.updateRiskInput)
  const resetRiskInputs = useStore((s) => s.resetRiskInputs)
  const position = useSuggestedPosition(selectedCoin)
  const riskInputs = position.inputs
  const riskOutputs = position.outputs

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
    isReady: position.status === 'ready' && riskOutputs !== null,
  }
}
