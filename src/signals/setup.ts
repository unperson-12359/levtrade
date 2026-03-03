import type { TrackedCoin } from '../types'
import type { AssetSignals } from '../types/signals'
import type { SuggestedSetup } from '../types/setup'
import { DEFAULT_ACCOUNT_SIZE } from '../config/constants'
import { computeDecisionState } from './decision'
import { computeRisk } from './risk'
import { computeSetupMetrics } from './setupMetrics'

export function computeSuggestedSetup(
  coin: TrackedCoin,
  signals: AssetSignals,
  currentPrice: number,
  options?: { generatedAt?: number; source?: 'live' | 'server' | 'backfill' },
): SuggestedSetup | null {
  if (
    !isFinite(currentPrice) ||
    currentPrice <= 0 ||
    signals.isStale ||
    signals.isWarmingUp ||
    !isFinite(signals.volatility.atr) ||
    signals.volatility.atr <= 0 ||
    !isFinite(signals.entryGeometry.meanPrice)
  ) {
    return null
  }

  const decision = computeDecisionState({
    composite: signals.composite,
    entryGeometry: signals.entryGeometry,
    hurst: signals.hurst,
    isStale: signals.isStale,
    isWarmingUp: signals.isWarmingUp,
    riskStatus: 'unknown',
  })

  if (decision.action !== 'long' && decision.action !== 'short') {
    return null
  }

  const direction = decision.action
  const atr = signals.volatility.atr
  const riskOutputs = computeRisk(
    {
      coin,
      direction,
      entryPrice: currentPrice,
      accountSize: DEFAULT_ACCOUNT_SIZE,
      positionSize: 0,
      leverage: 1,
      stopPrice: null,
      targetPrice: null,
    },
    atr,
  )

  const {
    confidence,
    confidenceTier,
    timeframe,
    reversionPotential,
  } = computeSetupMetrics(signals)

  const stretch = Math.abs(signals.entryGeometry.stretchZEquivalent).toFixed(1)
  const mean = signals.entryGeometry.meanPrice
  const agreementStr = `${signals.composite.agreementCount}/${signals.composite.agreementTotal}`
  const summary = `${coin} is ${stretch}\u03C3 ${
    direction === 'long' ? 'below' : 'above'
  } its 20-period mean ($${mean.toFixed(0)}) in a ${signals.hurst.regime} market. ${agreementStr} signals agree. ${direction.toUpperCase()} entry at $${currentPrice.toFixed(0)} with stop $${riskOutputs.suggestedStopPrice.toFixed(0)}, target $${riskOutputs.suggestedTargetPrice.toFixed(0)} (${riskOutputs.rrRatio.toFixed(1)}:1 R:R).`

  return {
    coin,
    direction,
    entryPrice: currentPrice,
    stopPrice: riskOutputs.suggestedStopPrice,
    targetPrice: riskOutputs.suggestedTargetPrice,
    meanReversionTarget: mean,
    rrRatio: riskOutputs.rrRatio,
    suggestedPositionSize: riskOutputs.suggestedPositionSize,
    suggestedLeverage: riskOutputs.suggestedLeverage,
    tradeGrade: riskOutputs.tradeGrade,
    confidence,
    confidenceTier,
    entryQuality: signals.entryGeometry.entryQuality,
    agreementCount: signals.composite.agreementCount,
    agreementTotal: signals.composite.agreementTotal,
    regime: signals.hurst.regime,
    reversionPotential,
    stretchSigma: Math.abs(signals.entryGeometry.stretchZEquivalent),
    atr,
    compositeValue: signals.composite.value,
    timeframe,
    summary,
    generatedAt: options?.generatedAt ?? Date.now(),
    source: options?.source,
  }
}
