import { useMemo } from 'react'
import { deriveCompositionRiskStatus } from '../signals/suggestedPosition'
import { computeSetupMetrics } from '../signals/setupMetrics'
import type { TrackedCoin } from '../types/market'
import type { EntryQuality } from '../types/signals'
import { getWorkflowStepStates } from '../utils/workflowGuidance'
import { useEntryDecision } from './useEntryDecision'
import { useSignals } from './useSignals'
import { useSuggestedPosition } from './useSuggestedPosition'

export type EntryReadinessBand = 'low' | 'medium' | 'high'
export type EntryReadinessState = 'on' | 'off' | 'unknown'
export type EntryReadinessDirection = 'long' | 'short' | 'neutral'

export interface EntryReadinessLight {
  key: string
  label: string
  step: 1 | 2 | 3
  state: EntryReadinessState
  locked: boolean
  score: number
  detail: string
}

export interface EntryReadinessModel {
  lights: EntryReadinessLight[]
  activeCount: number
  totalCount: number
  triggerProgressPct: number
  weightedConfidencePct: number
  primaryBand: EntryReadinessBand
  confidenceBand: EntryReadinessBand
  direction: EntryReadinessDirection
  step1Passed: boolean
  step2Passed: boolean
  lockedByStep: 0 | 1 | 2
}

const LIGHT_WEIGHTS = {
  dataFresh: 0.1,
  regime: 0.16,
  pricePosition: 0.14,
  crowdPositioning: 0.12,
  moneyFlow: 0.12,
  entryGeometry: 0.14,
  compositeOutput: 0.12,
  riskGate: 0.1,
} as const

export function useEntryReadiness(coin: TrackedCoin): EntryReadinessModel {
  const { signals } = useSignals(coin)
  const decision = useEntryDecision(coin)
  const composition = useSuggestedPosition(coin)
  const riskStatus = deriveCompositionRiskStatus(composition)

  return useMemo(() => {
    if (!signals) {
      return {
        lights: [
          unknownLight('data-fresh', 'Data Fresh', 1),
          unknownLight('regime', 'Regime', 1),
          unknownLight('price-position', 'Price Position', 2),
          unknownLight('crowd-positioning', 'Crowd Positioning', 2),
          unknownLight('money-flow', 'Money Flow', 2),
          unknownLight('entry-geometry', 'Entry Geometry', 2),
          unknownLight('composite-output', 'Composite Output', 3),
          unknownLight('risk-gate', 'Risk Gate', 3),
        ],
        activeCount: 0,
        totalCount: 8,
        triggerProgressPct: 0,
        weightedConfidencePct: 0,
        primaryBand: 'low',
        confidenceBand: 'low',
        direction: 'neutral',
        step1Passed: false,
        step2Passed: false,
        lockedByStep: 1,
      }
    }

    const [step1, step2, step3] = getWorkflowStepStates(
      signals,
      decision,
      composition.outputs,
      riskStatus,
      composition,
    )
    const step1Passed = step1.state === 'pass'
    const step2Passed = step2.state === 'pass'
    const lockedByStep: 0 | 1 | 2 = step1Passed ? (step2Passed ? 0 : 2) : 1

    const alignmentRatio =
      signals.composite.agreementTotal > 0
        ? clamp(signals.composite.agreementCount / signals.composite.agreementTotal, 0, 1)
        : 0

    const stale = signals.isStale
    const warmupProgress = clamp(signals.warmupProgress, 0, 1)
    const warmupComplete = !signals.isWarmingUp
    const regimeBlocked = signals.hurst.regime === 'trending'
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
      step: 1,
      state: stale ? 'off' : 'on',
      locked: false,
      score: stale ? 0 : 1,
      detail: stale ? 'Feed stale, entry confidence capped' : 'Live feed fresh',
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
      step: 1,
      state: signals.hurst.regime === 'mean-reverting' ? 'on' : 'off',
      locked: false,
      score: regimeScore,
      detail: `${signals.hurst.regime} (H ${signals.hurst.value.toFixed(2)})`,
    }

    const priceAbs = Math.abs(signals.zScore.normalizedSignal)
    const priceDirectional = priceAbs > 0.1
    const priceLight: EntryReadinessLight = {
      key: 'price-position',
      label: 'Price Position',
      step: 2,
      state: priceDirectional ? 'on' : 'off',
      locked: false,
      score: clamp((priceAbs - 0.1) / 0.9, 0, 1),
      detail: `${signals.zScore.label} (${signals.zScore.value.toFixed(2)} sigma)`,
    }

    const crowdAbs = Math.abs(signals.funding.normalizedSignal)
    const crowdDirectional = crowdAbs > 0.1
    const crowdLight: EntryReadinessLight = {
      key: 'crowd-positioning',
      label: 'Crowd Positioning',
      step: 2,
      state: crowdDirectional ? 'on' : 'off',
      locked: false,
      score: clamp((crowdAbs - 0.1) / 0.9, 0, 1),
      detail: `${signals.funding.label} (${signals.funding.zScore.toFixed(2)}z)`,
    }

    const flowAbs = Math.abs(signals.oiDelta.normalizedSignal)
    const flowDirectional = flowAbs > 0.1
    const flowLight: EntryReadinessLight = {
      key: 'money-flow',
      label: 'Money Flow',
      step: 2,
      state: flowDirectional ? 'on' : 'off',
      locked: false,
      score: clamp((flowAbs - 0.1) / 0.9, 0, 1),
      detail: `${signals.oiDelta.label} (${(signals.oiDelta.oiChangePct * 100).toFixed(2)}%)`,
    }

    const geometryLight: EntryReadinessLight = {
      key: 'entry-geometry',
      label: 'Entry Geometry',
      step: 2,
      state: geometryStrong ? 'on' : 'off',
      locked: false,
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
      step: 3,
      state: compositeDirectional && compositeStrongEnough ? 'on' : 'off',
      locked: false,
      score: compositeScore,
      detail: `${signals.composite.label} (${signals.composite.agreementCount}/${signals.composite.agreementTotal})`,
    }

    const riskGateReady = step3.state === 'pass'
    const riskGateLight: EntryReadinessLight = {
      key: 'risk-gate',
      label: 'Risk Gate',
      step: 3,
      state: riskGateReady ? 'on' : 'off',
      locked: false,
      score: riskGateReady ? 1 : riskStatus === 'borderline' ? 0.55 : riskStatus === 'danger' ? 0.18 : 0.35,
      detail: riskGateReady
        ? 'Composition is safe enough'
        : composition.mode === 'none'
          ? 'No composable setup yet'
          : composition.status === 'invalid'
            ? 'Need valid account inputs'
            : composition.outputs?.tradeGradeExplanation ?? 'Composition not yet safe enough',
    }

    const rawLights: EntryReadinessLight[] = [
      dataFreshLight,
      regimeLight,
      priceLight,
      crowdLight,
      flowLight,
      geometryLight,
      compositeLight,
      riskGateLight,
    ]

    const lights = rawLights.map((light) => {
      const locked =
        (light.step === 2 && !step1Passed) ||
        (light.step === 3 && !step2Passed)

      if (!locked) {
        return light
      }

      const lockStep = light.step === 2 ? 1 : 2
      return {
        ...light,
        state: 'off' as const,
        locked: true,
        detail: `${light.detail} Locked until Step ${lockStep} is green.`,
      }
    })

    const weightedSignalReadiness =
      dataFreshLight.score * LIGHT_WEIGHTS.dataFresh +
      regimeLight.score * LIGHT_WEIGHTS.regime +
      priceLight.score * LIGHT_WEIGHTS.pricePosition +
      crowdLight.score * LIGHT_WEIGHTS.crowdPositioning +
      flowLight.score * LIGHT_WEIGHTS.moneyFlow +
      geometryLight.score * LIGHT_WEIGHTS.entryGeometry +
      compositeLight.score * LIGHT_WEIGHTS.compositeOutput +
      riskGateLight.score * LIGHT_WEIGHTS.riskGate

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
    if (!step1Passed) probability = Math.min(probability, 0.12)

    const weightedConfidencePct = Math.round(clamp(probability, 0, 1) * 100)
    const activeCount = lights.filter((light) => light.state === 'on' && !light.locked).length
    let triggerProgressPct = Math.round((activeCount / lights.length) * 100)

    if (!step1Passed) {
      triggerProgressPct = Math.min(triggerProgressPct, 12)
    }

    const direction: EntryReadinessDirection = step1Passed
      ? signals.composite.direction
      : 'neutral'

    return {
      lights,
      activeCount,
      totalCount: lights.length,
      triggerProgressPct,
      weightedConfidencePct,
      primaryBand: bandFromPct(triggerProgressPct),
      confidenceBand: bandFromPct(weightedConfidencePct),
      direction,
      step1Passed,
      step2Passed,
      lockedByStep,
    }
  }, [composition, decision, riskStatus, signals])
}

function unknownLight(key: string, label: string, step: 1 | 2 | 3): EntryReadinessLight {
  return {
    key,
    label,
    step,
    state: 'unknown',
    locked: false,
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

function bandFromPct(pct: number): EntryReadinessBand {
  if (pct >= 70) return 'high'
  if (pct >= 40) return 'medium'
  return 'low'
}
