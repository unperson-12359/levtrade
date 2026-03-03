import type { TrackedCoin } from '../types'
import type { AssetSignals } from '../types/signals'
import type { SuggestedSetup } from '../types/setup'
import { DEFAULT_ACCOUNT_SIZE } from '../config/constants'
import { computeRisk } from './risk'
import { computeSetupMetrics } from './setupMetrics'

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

  const regimeBlocked = signals.hurst.regime === 'trending' && signals.hurst.value > 0.6
  if (regimeBlocked || signals.entryGeometry.entryQuality === 'no-edge') {
    return null
  }

  const compositeDirectional =
    signals.composite.direction === 'long' || signals.composite.direction === 'short'
      ? signals.composite.direction
      : null
  const geometryDirectional =
    signals.entryGeometry.directionBias === 'long' || signals.entryGeometry.directionBias === 'short'
      ? signals.entryGeometry.directionBias
      : null

  const direction =
    compositeDirectional && geometryDirectional && compositeDirectional === geometryDirectional
      ? compositeDirectional
      : compositeDirectional && signals.composite.strength !== 'weak' && signals.entryGeometry.directionBias === 'neutral'
        ? compositeDirectional
        : !compositeDirectional && geometryDirectional && (
            signals.entryGeometry.entryQuality === 'early' || signals.entryGeometry.entryQuality === 'extended'
          )
          ? geometryDirectional
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

  const {
    confidence,
    confidenceTier,
    timeframe,
    reversionPotential,
  } = computeSetupMetrics(signals, {
    confidenceScale: PROVISIONAL_CONFIDENCE_SCALE,
    confidenceCap: PROVISIONAL_CONFIDENCE_SCALE,
  })

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
    suggestedPositionSize: riskOutputs.suggestedPositionSize,
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

function clampLeverage(value: number): number {
  if (!isFinite(value) || value <= 0) {
    return 1.5
  }
  return Math.min(value, 2.5)
}
