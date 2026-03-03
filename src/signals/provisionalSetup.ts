import type { TrackedCoin } from '../types'
import type { AssetSignals } from '../types/signals'
import type { ConfidenceTier, SetupTimeframe, SuggestedSetup } from '../types/setup'
import { DEFAULT_ACCOUNT_SIZE } from '../config/constants'
import { computeRisk } from './risk'

const PROVISIONAL_CONFIDENCE_SCALE = 0.55

export function computeProvisionalSetup(
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

  const direction =
    signals.composite.direction !== 'neutral'
      ? signals.composite.direction
      : signals.entryGeometry.directionBias !== 'neutral'
        ? signals.entryGeometry.directionBias
        : null

  if (!direction) {
    return null
  }

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

  const alignmentRatio =
    signals.composite.agreementTotal > 0
      ? signals.composite.agreementCount / signals.composite.agreementTotal
      : 0
  const compositeStrength = Math.min(1, Math.abs(signals.composite.value))
  const reversionPotential = signals.entryGeometry.reversionPotential
  const hurstConfidence = signals.hurst.confidence
  const confidence = clamp(
    alignmentRatio * compositeStrength * reversionPotential * hurstConfidence * 2 * PROVISIONAL_CONFIDENCE_SCALE,
    0,
    PROVISIONAL_CONFIDENCE_SCALE,
  )

  const confidenceTier: ConfidenceTier = confidence > 0.4 ? 'medium' : 'low'

  const timeframe: SetupTimeframe =
    signals.entryGeometry.entryQuality === 'ideal' &&
    signals.hurst.regime === 'mean-reverting'
      ? '4-24h'
      : signals.entryGeometry.entryQuality === 'extended'
        ? '4-12h'
        : signals.entryGeometry.entryQuality === 'early'
          ? '24-72h'
          : '4-24h'

  const stretch = Math.abs(signals.entryGeometry.stretchZEquivalent).toFixed(1)
  const mean = signals.entryGeometry.meanPrice
  const agreementStr = `${signals.composite.agreementCount}/${signals.composite.agreementTotal}`
  const summary = `Draft ${direction.toUpperCase()} composition for ${coin}: price is ${stretch}\u03C3 ${
    direction === 'long' ? 'below' : 'above'
  } its 20-period mean ($${mean.toFixed(0)}) with ${agreementStr} signal agreement. This is a reduced-risk provisional setup, not a fully validated entry.`

  return {
    coin,
    direction,
    entryPrice: currentPrice,
    stopPrice: riskOutputs.suggestedStopPrice,
    targetPrice: riskOutputs.suggestedTargetPrice,
    meanReversionTarget: mean,
    rrRatio: riskOutputs.rrRatio,
    suggestedPositionSize: DEFAULT_ACCOUNT_SIZE * 0.35,
    suggestedLeverage: clampLeverage(riskOutputs.suggestedLeverage),
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampLeverage(value: number): number {
  if (!isFinite(value) || value <= 0) {
    return 1.5
  }
  return Math.min(value, 2.5)
}
