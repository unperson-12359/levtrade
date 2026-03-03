import { useMemo } from 'react'
import { useStore } from '../store'
import { computeRisk } from '../signals/risk'
import { computeProvisionalSetup } from '../signals/provisionalSetup'
import { computePositionPolicy } from '../signals/positionPolicy'
import type { SuggestedPositionComposition } from '../types/position'
import { DEFAULT_RISK_INPUTS } from '../types/risk'
import type { TrackedCoin } from '../types/market'
import { useSuggestedSetup } from './useSuggestedSetup'
import { useSignals } from './useSignals'

export function useSuggestedPosition(coin?: TrackedCoin): SuggestedPositionComposition {
  const selectedCoin = useStore((s) => s.selectedCoin)
  const accountSize = useStore((s) => s.riskInputs.accountSize)
  const currentPrice = useStore((s) => s.prices[coin ?? selectedCoin])
  const activeCoin = coin ?? selectedCoin
  const setup = useSuggestedSetup(activeCoin)
  const { signals } = useSignals(activeCoin)

  return useMemo(() => {
    const emptyInputs = {
      ...DEFAULT_RISK_INPUTS,
      coin: activeCoin,
      accountSize,
    }

    if (!signals || !currentPrice) {
      return {
        hasSetup: false,
        setup: null,
        accountSize,
        mode: 'none' as const,
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
          explanation: 'Waiting for live price and signal data before composing a position.',
          modeLabel: 'Waiting',
          modeExplanation: 'Live market inputs are still loading for this asset.',
          targetRiskPct: null,
          capitalFractionCap: null,
        },
        status: 'none' as const,
      }
    }

    if (signals.isStale) {
      return {
        hasSetup: false,
        setup: null,
        accountSize,
        mode: 'none' as const,
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
          explanation: 'Waiting for a fresh feed before composing the next position.',
          modeLabel: 'Waiting',
          modeExplanation: 'The live feed is stale, so LevTrade is holding off on composition updates.',
          targetRiskPct: null,
          capitalFractionCap: null,
        },
        status: 'none' as const,
      }
    }

    if (signals.isWarmingUp) {
      return {
        hasSetup: false,
        setup: null,
        accountSize,
        mode: 'none' as const,
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
          explanation: 'Waiting for enough candles to stabilize the composition engine.',
          modeLabel: 'Warming up',
          modeExplanation: 'LevTrade needs more market history before suggesting a position.',
          targetRiskPct: null,
          capitalFractionCap: null,
        },
        status: 'none' as const,
      }
    }

    const provisionalSetup = setup ? null : computeProvisionalSetup(activeCoin, signals, currentPrice, { source: 'live' })
    const activeSetup = setup ?? provisionalSetup

    if (!activeSetup) {
      return {
        hasSetup: false,
        setup: null,
        accountSize,
        mode: 'none' as const,
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
          explanation: 'Waiting for clearer directional structure before composing a draft position.',
          modeLabel: 'Waiting',
          modeExplanation: 'Signals are live, but the market is too neutral to size even a provisional position.',
          targetRiskPct: null,
          capitalFractionCap: null,
        },
        status: 'none' as const,
      }
    }

    const mode = setup ? 'validated' as const : 'provisional' as const
    const effectiveAccountSize = isFinite(accountSize) && accountSize > 0 ? accountSize : 1
    const policy = computePositionPolicy(activeSetup, mode, effectiveAccountSize)

    const inputs = {
      coin: activeSetup.coin,
      direction: activeSetup.direction,
      entryPrice: activeSetup.entryPrice,
      accountSize,
      positionSize: policy.marginUsd,
      leverage: policy.leverage,
      stopPrice: activeSetup.stopPrice,
      targetPrice: activeSetup.targetPrice,
    }

    if (!isFinite(accountSize) || accountSize <= 0) {
      return {
        hasSetup: true,
        setup: activeSetup,
        accountSize,
        mode,
        inputs,
        outputs: null,
        display: {
          marginUsd: null,
          notionalUsd: null,
          leverage: policy.leverage > 0 ? policy.leverage : null,
          accountHitAtStopPct: null,
          liquidationDistancePct: null,
          rrRatio: activeSetup.rrRatio,
          tradeGrade: null,
          tradeGradeLabel: null,
          explanation: 'Enter your account capital to size the current setup automatically.',
          modeLabel: mode === 'validated' ? 'Validated' : 'Provisional',
          modeExplanation:
            mode === 'validated'
              ? 'Suggested from the current confirmed setup and your account capital.'
              : 'Draft composition from the current directional bias. Size and leverage stay reduced until setup confirmation improves.',
          targetRiskPct: policy.targetRiskPct,
          capitalFractionCap: policy.capitalFractionCap,
        },
        status: 'invalid' as const,
      }
    }

    const outputs = computeRisk(inputs, activeSetup.atr)
    const modeLabel = mode === 'validated' ? 'Validated' : 'Provisional'
    const modeExplanation =
      mode === 'validated'
        ? 'Suggested from the current confirmed setup and your account capital.'
        : 'Draft composition from the current directional bias. Size and leverage are reduced until setup confirmation improves.'

    return {
      hasSetup: true,
      setup: activeSetup,
      accountSize,
      mode,
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
        modeLabel,
        modeExplanation,
        targetRiskPct: policy.targetRiskPct,
        capitalFractionCap: policy.capitalFractionCap,
      },
      status: outputs.hasInputError ? 'invalid' as const : 'ready' as const,
    }
  }, [accountSize, activeCoin, currentPrice, setup, signals])
}
