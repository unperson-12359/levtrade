import type { CompositeSignal, DecisionAction, EntryGeometryResult, HurstResult, RiskStatus } from '../types/signals'

interface DecisionInput {
  composite: CompositeSignal
  entryGeometry: EntryGeometryResult
  hurst: HurstResult
  isStale: boolean
  isWarmingUp: boolean
  riskStatus?: RiskStatus
}

interface DecisionResult {
  action: DecisionAction
  label: string
  reasons: string[]
}

export function computeDecisionState(input: DecisionInput): DecisionResult {
  const {
    composite,
    entryGeometry,
    hurst,
    isStale,
    isWarmingUp,
    riskStatus = 'unknown',
  } = input

  const reasons: string[] = []

  if (isStale) {
    return {
      action: 'avoid',
      label: 'AVOID',
      reasons: ['stale feed', 'refresh needed'],
    }
  }

  if (isWarmingUp) {
    return {
      action: 'wait',
      label: 'WAIT',
      reasons: ['warming up', 'signals incomplete'],
    }
  }

  const regimeBlocks = hurst.regime === 'trending' && hurst.value > 0.6
  const neutralComposite = composite.direction === 'neutral' || composite.strength === 'weak'
  const entryWeak = entryGeometry.entryQuality === 'no-edge' || entryGeometry.directionBias === 'neutral'

  if (regimeBlocks) reasons.push('trend veto')
  if (neutralComposite) reasons.push('mixed signals')
  if (entryWeak) reasons.push('no stretch')

  if (riskStatus === 'danger') reasons.push('risk too large')
  if (riskStatus === 'borderline') reasons.push('risk tight')

  const geometrySupportsDirection = (
    (composite.direction === 'long' && entryGeometry.directionBias === 'long') ||
    (composite.direction === 'short' && entryGeometry.directionBias === 'short')
  )

  const geometryStrong = entryGeometry.entryQuality === 'ideal' || entryGeometry.entryQuality === 'extended'
  const directionalComposite = composite.direction === 'long' || composite.direction === 'short'

  if (directionalComposite && geometryStrong && geometrySupportsDirection && !regimeBlocks && riskStatus !== 'danger') {
    const reasonsOut = [
      `${Math.abs(entryGeometry.stretchZEquivalent).toFixed(1)}σ stretched`,
      composite.agreementCount >= 3 ? 'signals aligned' : 'partial agreement',
      hurst.regime === 'mean-reverting' ? 'mean-reverting regime' : 'regime acceptable',
    ]

    if (riskStatus === 'safe') reasonsOut.push('risk clear')
    if (riskStatus === 'borderline') reasonsOut.push('risk tight')

    return {
      action: composite.direction === 'long' ? 'long' : 'short',
      label: composite.direction === 'long' ? 'ENTER LONG' : 'ENTER SHORT',
      reasons: reasonsOut,
    }
  }

  if (riskStatus === 'danger' || regimeBlocks) {
    return {
      action: 'avoid',
      label: 'AVOID',
      reasons: dedupe(reasons),
    }
  }

  return {
    action: 'wait',
    label: 'WAIT',
    reasons: dedupe(reasons.length > 0 ? reasons : ['setup developing']),
  }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values)).slice(0, 4)
}
