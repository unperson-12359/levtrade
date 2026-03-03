import { useMemo } from 'react'
import { useStore } from '../store'
import { computeRisk } from '../signals/risk'
import type { SuggestedPositionComposition } from '../types/position'
import { DEFAULT_RISK_INPUTS } from '../types/risk'
import type { TrackedCoin } from '../types/market'
import { useSuggestedSetup } from './useSuggestedSetup'

export function useSuggestedPosition(coin?: TrackedCoin): SuggestedPositionComposition {
  const selectedCoin = useStore((s) => s.selectedCoin)
  const accountSize = useStore((s) => s.riskInputs.accountSize)
  const activeCoin = coin ?? selectedCoin
  const setup = useSuggestedSetup(activeCoin)

  return useMemo(() => {
    const emptyInputs = {
      ...DEFAULT_RISK_INPUTS,
      coin: activeCoin,
      accountSize,
    }

    if (!setup) {
      return {
        hasSetup: false,
        setup: null,
        accountSize,
        inputs: emptyInputs,
        outputs: null,
        display: {
          marginUsd: null,
          notionalUsd: null,
          leverage: null,
          accountHitAtStopPct: null,
          liquidationDistancePct: null,
          rrRatio: null,
          tradeGrade: null,
          tradeGradeLabel: null,
          explanation: 'Step 3 unlocks only when Step 2 identifies a valid long or short setup.',
        },
        status: 'no-setup' as const,
      }
    }

    const inputs = {
      coin: setup.coin,
      direction: setup.direction,
      entryPrice: setup.entryPrice,
      accountSize,
      positionSize: accountSize,
      leverage: setup.suggestedLeverage,
      stopPrice: setup.stopPrice,
      targetPrice: setup.targetPrice,
    }

    if (!isFinite(accountSize) || accountSize <= 0) {
      return {
        hasSetup: true,
        setup,
        accountSize,
        inputs,
        outputs: null,
        display: {
          marginUsd: null,
          notionalUsd: null,
          leverage: setup.suggestedLeverage,
          accountHitAtStopPct: null,
          liquidationDistancePct: null,
          rrRatio: setup.rrRatio,
          tradeGrade: null,
          tradeGradeLabel: null,
          explanation: 'Enter your account capital to size the current setup automatically.',
        },
        status: 'invalid' as const,
      }
    }

    const outputs = computeRisk(inputs, setup.atr)

    return {
      hasSetup: true,
      setup,
      accountSize,
      inputs,
      outputs,
      display: {
        marginUsd: inputs.positionSize,
        notionalUsd: outputs.notionalValue,
        leverage: inputs.leverage,
        accountHitAtStopPct: outputs.lossAtStopPercent,
        liquidationDistancePct: outputs.liquidationDistance,
        rrRatio: outputs.rrRatio,
        tradeGrade: outputs.tradeGrade,
        tradeGradeLabel: outputs.tradeGradeLabel,
        explanation: outputs.tradeGradeExplanation,
      },
      status: outputs.hasInputError ? 'invalid' as const : 'ready' as const,
    }
  }, [accountSize, activeCoin, setup])
}
