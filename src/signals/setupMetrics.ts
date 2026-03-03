import type { AssetSignals } from '../types/signals'
import type { ConfidenceTier, SetupTimeframe } from '../types/setup'

export interface SetupMetricResult {
  alignmentRatio: number
  compositeStrength: number
  reversionPotential: number
  hurstConfidence: number
  confidence: number
  confidenceTier: ConfidenceTier
  timeframe: SetupTimeframe
}

export function computeSetupMetrics(
  signals: AssetSignals,
  options?: {
    confidenceScale?: number
    confidenceCap?: number
  },
): SetupMetricResult {
  const confidenceScale = options?.confidenceScale ?? 1
  const confidenceCap = options?.confidenceCap ?? 1
  const alignmentRatio =
    signals.composite.agreementTotal > 0
      ? signals.composite.agreementCount / signals.composite.agreementTotal
      : 0
  const compositeStrength = Math.min(1, Math.abs(signals.composite.value))
  const reversionPotential = signals.entryGeometry.reversionPotential
  const hurstConfidence = signals.hurst.confidence
  const confidence = clamp(
    alignmentRatio * compositeStrength * reversionPotential * hurstConfidence * 2 * confidenceScale,
    0,
    confidenceCap,
  )

  const confidenceTier = computeConfidenceTier(confidence, confidenceCap)
  const timeframe = computeTimeframe(signals)

  return {
    alignmentRatio,
    compositeStrength,
    reversionPotential,
    hurstConfidence,
    confidence,
    confidenceTier,
    timeframe,
  }
}

function computeConfidenceTier(confidence: number, confidenceCap: number): ConfidenceTier {
  if (confidenceCap <= 0.55) {
    return confidence > 0.4 ? 'medium' : 'low'
  }

  if (confidence > 0.6) return 'high'
  if (confidence > 0.3) return 'medium'
  return 'low'
}

function computeTimeframe(signals: AssetSignals): SetupTimeframe {
  if (signals.entryGeometry.entryQuality === 'ideal' && signals.hurst.regime === 'mean-reverting') {
    return '4-24h'
  }

  if (signals.entryGeometry.entryQuality === 'extended') {
    return '4-12h'
  }

  if (signals.entryGeometry.entryQuality === 'early') {
    return '24-72h'
  }

  return '4-24h'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
