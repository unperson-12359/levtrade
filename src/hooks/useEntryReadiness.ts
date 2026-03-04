import { useMemo } from 'react'
import { computeSetupMetrics } from '../signals/setupMetrics'
import type { TrackedCoin } from '../types/market'
import type { EntryQuality } from '../types/signals'
import { useSignals } from './useSignals'

export type EntryReadinessBand = 'low' | 'medium' | 'high'
export type EntryReadinessState = 'on' | 'off' | 'unknown'

export interface EntryReadinessLight {
  key: string
  label: string
  state: EntryReadinessState
  score: number
  detail: string
}

export interface EntryReadinessModel {
  lights: EntryReadinessLight[]
  activeCount: number
  totalCount: number
  probabilityPct: number
  band: EntryReadinessBand
}

const LIGHT_WEIGHTS = {
  dataFresh: 0.08,
  warmup: 0.08,
  regime: 0.14,
  pricePosition: 0.14,
  crowdPositioning: 0.12,
  moneyFlow: 0.12,
  entryGeometry: 0.16,
  compositeOutput: 0.16,
} as const

export function useEntryReadiness(coin: TrackedCoin): EntryReadinessModel {
  const { signals } = useSignals(coin)

  return useMemo(() => {
    if (!signals) {
      return {
        lights: [
          unknownLight('data-fresh', 'Data Fresh'),
          unknownLight('warmup', 'Warmup'),
          unknownLight('regime', 'Regime'),
          unknownLight('price-position', 'Price Position'),
          unknownLight('crowd-positioning', 'Crowd Positioning'),
          unknownLight('money-flow', 'Money Flow'),
          unknownLight('entry-geometry', 'Entry Geometry'),
          unknownLight('composite-output', 'Composite Output'),
        ],
        activeCount: 0,
        totalCount: 8,
        probabilityPct: 0,
        band: 'low',
      }
    }

    const alignmentRatio =
      signals.composite.agreementTotal > 0
        ? clamp(signals.composite.agreementCount / signals.composite.agreementTotal, 0, 1)
        : 0

    const stale = signals.isStale
    const warmupProgress = clamp(signals.warmupProgress, 0, 1)
    const warmupComplete = !signals.isWarmingUp
    const regimeBlocked = signals.hurst.regime === 'trending' && signals.hurst.value > 0.6
    const geometryDirectional = signals.entryGeometry.directionBias !== 'neutral'
    const geometryScoreBase = qualityToScore(signals.entryGeometry.entryQuality)
    const geometryStrong =
      (signals.entryGeometry.entryQuality === 'ideal' || signals.entryGeometry.entryQuality === 'extended') &&
      geometryDirectional
    const compositeDirectional = signals.composite.direction !== 'neutral'
    const compositeStrongEnough = signals.composite.strength !== 'weak'

    const dataFreshLight: EntryReadinessLight = {
      key: 'data-fresh',
      label: 'Data Fresh',
      state: stale ? 'off' : 'on',
      score: stale ? 0 : 1,
      detail: stale ? 'Feed stale, entry confidence capped' : 'Live feed fresh',
    }

    const warmupLight: EntryReadinessLight = {
      key: 'warmup',
      label: 'Warmup',
      state: warmupComplete ? 'on' : 'off',
      score: warmupComplete ? 1 : clamp(warmupProgress * 0.75, 0, 0.75),
      detail: warmupComplete ? 'Signal window fully primed' : `${Math.round(warmupProgress * 100)}% window built`,
    }

    const regimeScore = regimeBlocked
      ? 0
      : signals.hurst.regime === 'mean-reverting'
        ? 1
        : signals.hurst.regime === 'choppy'
          ? 0.58
          : 0.5

    const regimeLight: EntryReadinessLight = {
      key: 'regime',
      label: 'Regime',
      state: !regimeBlocked && signals.hurst.regime === 'mean-reverting' ? 'on' : 'off',
      score: regimeScore,
      detail: `${signals.hurst.regime} (H ${signals.hurst.value.toFixed(2)})`,
    }

    const priceAbs = Math.abs(signals.zScore.normalizedSignal)
    const priceDirectional = priceAbs > 0.1
    const priceLight: EntryReadinessLight = {
      key: 'price-position',
      label: 'Price Position',
      state: priceDirectional ? 'on' : 'off',
      score: clamp((priceAbs - 0.1) / 0.9, 0, 1),
      detail: `${signals.zScore.label} (${signals.zScore.value.toFixed(2)}σ)`,
    }

    const crowdAbs = Math.abs(signals.funding.normalizedSignal)
    const crowdDirectional = crowdAbs > 0.1
    const crowdLight: EntryReadinessLight = {
      key: 'crowd-positioning',
      label: 'Crowd Positioning',
      state: crowdDirectional ? 'on' : 'off',
      score: clamp((crowdAbs - 0.1) / 0.9, 0, 1),
      detail: `${signals.funding.label} (${signals.funding.zScore.toFixed(2)}z)`,
    }

    const flowAbs = Math.abs(signals.oiDelta.normalizedSignal)
    const flowDirectional = flowAbs > 0.1
    const flowLight: EntryReadinessLight = {
      key: 'money-flow',
      label: 'Money Flow',
      state: flowDirectional ? 'on' : 'off',
      score: clamp((flowAbs - 0.1) / 0.9, 0, 1),
      detail: `${signals.oiDelta.label} (${(signals.oiDelta.oiChangePct * 100).toFixed(2)}%)`,
    }

    const geometryLight: EntryReadinessLight = {
      key: 'entry-geometry',
      label: 'Entry Geometry',
      state: geometryStrong ? 'on' : 'off',
      score: geometryDirectional ? geometryScoreBase : 0,
      detail: `${signals.entryGeometry.entryQuality} / ${signals.entryGeometry.directionBias.toUpperCase()}`,
    }

    const compositeStrengthBase =
      signals.composite.strength === 'strong'
        ? 1
        : signals.composite.strength === 'moderate'
          ? 0.72
          : 0.38
    const compositeScore = compositeDirectional
      ? clamp(compositeStrengthBase * (0.55 + 0.45 * alignmentRatio), 0, 1)
      : 0

    const compositeLight: EntryReadinessLight = {
      key: 'composite-output',
      label: 'Composite Output',
      state: compositeDirectional && compositeStrongEnough ? 'on' : 'off',
      score: compositeScore,
      detail: `${signals.composite.label} (${signals.composite.agreementCount}/${signals.composite.agreementTotal})`,
    }

    const lights: EntryReadinessLight[] = [
      dataFreshLight,
      warmupLight,
      regimeLight,
      priceLight,
      crowdLight,
      flowLight,
      geometryLight,
      compositeLight,
    ]

    const weightedSignalReadiness =
      dataFreshLight.score * LIGHT_WEIGHTS.dataFresh +
      warmupLight.score * LIGHT_WEIGHTS.warmup +
      regimeLight.score * LIGHT_WEIGHTS.regime +
      priceLight.score * LIGHT_WEIGHTS.pricePosition +
      crowdLight.score * LIGHT_WEIGHTS.crowdPositioning +
      flowLight.score * LIGHT_WEIGHTS.moneyFlow +
      geometryLight.score * LIGHT_WEIGHTS.entryGeometry +
      compositeLight.score * LIGHT_WEIGHTS.compositeOutput

    const setupConfidence = clamp(computeSetupMetrics(signals).confidence, 0, 1)

    let probability = weightedSignalReadiness * 0.72 + setupConfidence * 0.28

    if (stale) probability *= 0.25
    if (!warmupComplete) probability *= 0.45 + warmupProgress * 0.3
    if (regimeBlocked) probability *= 0.45
    if (!compositeDirectional || !compositeStrongEnough) probability *= 0.74
    if (!geometryDirectional || signals.entryGeometry.entryQuality === 'no-edge') probability *= 0.72
    if (signals.entryGeometry.entryQuality === 'chasing') probability *= 0.78

    if (stale) probability = Math.min(probability, 0.32)
    if (!warmupComplete) probability = Math.min(probability, 0.58)
    if (regimeBlocked) probability = Math.min(probability, 0.46)

    const probabilityPct = Math.round(clamp(probability, 0, 1) * 100)
    const activeCount = lights.filter((light) => light.state === 'on').length

    return {
      lights,
      activeCount,
      totalCount: lights.length,
      probabilityPct,
      band: probabilityPct >= 70 ? 'high' : probabilityPct >= 40 ? 'medium' : 'low',
    }
  }, [signals])
}

function unknownLight(key: string, label: string): EntryReadinessLight {
  return {
    key,
    label,
    state: 'unknown',
    score: 0,
    detail: 'Waiting for live data',
  }
}

function qualityToScore(entryQuality: EntryQuality): number {
  switch (entryQuality) {
    case 'ideal':
      return 1
    case 'extended':
      return 0.85
    case 'early':
      return 0.58
    case 'chasing':
      return 0.32
    case 'no-edge':
      return 0
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
