import type { AssetSignals, RiskStatus } from '../types/signals'
import type { SuggestedPositionComposition } from '../types/position'
import type { TrackedCoin } from '../types/market'
import { DEFAULT_RISK_INPUTS } from '../types/risk'
import { computePositionPolicy } from './positionPolicy'
import { computeProvisionalSetup } from './provisionalSetup'
import { computeRisk } from './risk'
import { computeSuggestedSetup } from './setup'

interface SuggestedPositionInput {
  coin: TrackedCoin
  accountSize: number
  currentPrice: number | null
  signals: AssetSignals | null
}

export function computeSuggestedPositionComposition({
  coin,
  accountSize,
  currentPrice,
  signals,
}: SuggestedPositionInput): SuggestedPositionComposition {
  const emptyInputs = {
    ...DEFAULT_RISK_INPUTS,
    coin,
    accountSize,
  }

  if (!signals || !currentPrice) {
    return {
      hasSetup: false,
      setup: null,
      accountSize,
      mode: 'none',
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
      status: 'none',
    }
  }

  if (signals.isStale) {
    return {
      hasSetup: false,
      setup: null,
      accountSize,
      mode: 'none',
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
      status: 'none',
    }
  }

  if (signals.isWarmingUp) {
    return {
      hasSetup: false,
      setup: null,
      accountSize,
      mode: 'none',
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
      status: 'none',
    }
  }

  const confirmedSetup = computeSuggestedSetup(coin, signals, currentPrice)
  const provisionalSetup = confirmedSetup
    ? null
    : computeProvisionalSetup(coin, signals, currentPrice, { source: 'live' })
  const activeSetup = confirmedSetup ?? provisionalSetup

  if (!activeSetup) {
    return {
      hasSetup: false,
      setup: null,
      accountSize,
      mode: 'none',
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
      status: 'none',
    }
  }

  const mode = confirmedSetup ? 'validated' : 'provisional'
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

  const modeLabel = mode === 'validated' ? 'Validated' : 'Provisional'
  const modeExplanation =
    mode === 'validated'
      ? 'Suggested from the current confirmed setup and your account capital.'
      : 'Draft composition from the current directional bias. Size and leverage are reduced until setup confirmation improves.'

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
        modeLabel,
        modeExplanation,
        targetRiskPct: policy.targetRiskPct,
        capitalFractionCap: policy.capitalFractionCap,
      },
      status: 'invalid',
    }
  }

  const outputs = computeRisk(inputs, activeSetup.atr)

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
    status: outputs.hasInputError ? 'invalid' : 'ready',
  }
}

export function deriveCompositionRiskStatus(composition: SuggestedPositionComposition): RiskStatus {
  if (composition.status !== 'ready' || !composition.outputs) {
    return 'unknown'
  }

  if (composition.outputs.tradeGrade === 'green') {
    return 'safe'
  }
  if (composition.outputs.tradeGrade === 'yellow') {
    return 'borderline'
  }
  return 'danger'
}
