import type { SuggestedSetup } from '../types/setup'

export interface PositionPolicy {
  targetRiskPct: number
  capitalFractionCap: number
  leverageCap: number
  marginUsd: number
  leverage: number
  desiredNotionalUsd: number
}

export function computePositionPolicy(
  setup: SuggestedSetup,
  mode: 'validated' | 'provisional',
  accountSize: number,
): PositionPolicy {
  if (!isFinite(accountSize) || accountSize <= 0) {
    return emptyPolicy()
  }

  const agreementRatio =
    setup.agreementTotal > 0
      ? setup.agreementCount / setup.agreementTotal
      : 0
  const stopDistanceRatio = Math.abs(setup.entryPrice - setup.stopPrice) / setup.entryPrice

  if (!isFinite(stopDistanceRatio) || stopDistanceRatio <= 0) {
    return emptyPolicy()
  }

  const targetRiskPct = mode === 'validated'
    ? clamp(
        0.0075 +
          (setup.confidenceTier === 'high' ? 0.0025 : 0) +
          (setup.entryQuality === 'ideal' ? 0.0015 : 0) +
          (agreementRatio >= 0.75 ? 0.001 : 0),
        0.005,
        0.0125,
      )
    : clamp(
        0.0035 +
          (setup.confidence > 0.4 ? 0.0005 : 0) +
          (setup.entryQuality === 'extended' ? 0.0005 : 0),
        0.0025,
        0.005,
      )

  const capitalFractionCap = mode === 'validated'
    ? clamp(
        0.25 +
          (setup.confidenceTier === 'high' ? 0.1 : 0) +
          (setup.entryQuality === 'ideal' ? 0.1 : 0) +
          (agreementRatio >= 0.75 ? 0.05 : 0),
        0.2,
        0.5,
      )
    : clamp(
        0.1 +
          (setup.confidence > 0.4 ? 0.05 : 0) +
          (setup.entryQuality === 'extended' ? 0.05 : 0),
        0.08,
        0.2,
      )

  const leverageCap = mode === 'validated'
    ? clampLeverage(setup.suggestedLeverage, 6, 1)
    : clampLeverage(setup.suggestedLeverage, 2.5, 1)

  const desiredNotionalUsd = (accountSize * targetRiskPct) / stopDistanceRatio
  const marginCapUsd = accountSize * capitalFractionCap
  const marginUsd = Math.max(0, Math.min(marginCapUsd, desiredNotionalUsd))
  const leverage = clamp(
    desiredNotionalUsd / Math.max(marginUsd, 1e-9),
    1,
    leverageCap,
  )

  return {
    targetRiskPct,
    capitalFractionCap,
    leverageCap,
    marginUsd,
    leverage,
    desiredNotionalUsd,
  }
}

function emptyPolicy(): PositionPolicy {
  return {
    targetRiskPct: 0,
    capitalFractionCap: 0,
    leverageCap: 0,
    marginUsd: 0,
    leverage: 0,
    desiredNotionalUsd: 0,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampLeverage(value: number, max: number, fallback: number): number {
  if (!isFinite(value) || value <= 0) {
    return fallback
  }

  return clamp(value, 1, max)
}
