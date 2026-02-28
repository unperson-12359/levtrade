import type { CompositeSignal, SignalColor, HurstResult, ZScoreResult, FundingResult, OIDeltaResult } from '../types/signals'

/**
 * Compute Composite Signal by combining sub-signals.
 *
 * Composite = average of directional signals (zScore, funding, oiDelta)
 * Hurst modulates confidence: mean-reverting boosts confidence, trending reduces it
 */
export function computeComposite(
  hurst: HurstResult,
  zScore: ZScoreResult,
  funding: FundingResult,
  oiDelta: OIDeltaResult,
): CompositeSignal {
  const directionalSignals = [
    zScore.normalizedSignal,
    funding.normalizedSignal,
    oiDelta.normalizedSignal,
  ]

  // Raw average of directional signals
  const rawComposite = directionalSignals.reduce((s, v) => s + v, 0) / directionalSignals.length

  // Regime confidence multiplier
  let regimeMultiplier: number
  if (hurst.value < 0.45) {
    regimeMultiplier = 1.0 + (0.45 - hurst.value) * 3
  } else if (hurst.value > 0.55) {
    regimeMultiplier = 0.7 - (hurst.value - 0.55) * 2
  } else {
    regimeMultiplier = 0.7 + (0.55 - hurst.value) * 3
  }
  regimeMultiplier = Math.max(0.1, Math.min(1.3, regimeMultiplier))

  const composite = Math.max(-1, Math.min(1, rawComposite * regimeMultiplier))

  const direction = classifyDirection(composite)

  // Agreement: count how many directional signals share the composite direction
  const positiveCount = directionalSignals.filter((s) => s > 0.1).length
  const negativeCount = directionalSignals.filter((s) => s < -0.1).length
  const agreementCount = Math.max(positiveCount, negativeCount)

  // Hurst: agrees if mean-reverting (supports our signals), disagrees if trending, excluded if choppy
  const hurstAgreesWithDirection = hurst.regime === 'mean-reverting'
  const hurstCounted = hurst.regime !== 'choppy'
  const displayAgreement = agreementCount + (hurstAgreesWithDirection ? 1 : 0)
  const displayTotal = directionalSignals.length + (hurstCounted ? 1 : 0)

  // Build signal breakdown for UI traceability
  const signalBreakdown: CompositeSignal['signalBreakdown'] = [
    {
      name: 'Price Position',
      direction: zScore.normalizedSignal > 0.1 ? 'long' : zScore.normalizedSignal < -0.1 ? 'short' : 'neutral',
      agrees: direction !== 'neutral' && (
        (direction === 'long' && zScore.normalizedSignal > 0.1) ||
        (direction === 'short' && zScore.normalizedSignal < -0.1)
      ),
    },
    {
      name: 'Crowd Positioning',
      direction: funding.normalizedSignal > 0.1 ? 'long' : funding.normalizedSignal < -0.1 ? 'short' : 'neutral',
      agrees: direction !== 'neutral' && (
        (direction === 'long' && funding.normalizedSignal > 0.1) ||
        (direction === 'short' && funding.normalizedSignal < -0.1)
      ),
    },
    {
      name: 'Money Flow',
      direction: oiDelta.normalizedSignal > 0.1 ? 'long' : oiDelta.normalizedSignal < -0.1 ? 'short' : 'neutral',
      agrees: direction !== 'neutral' && (
        (direction === 'long' && oiDelta.normalizedSignal > 0.1) ||
        (direction === 'short' && oiDelta.normalizedSignal < -0.1)
      ),
    },
  ]

  const strength = classifyStrength(composite)
  const color = compositeColor(composite)
  const label = buildLabel(direction, strength)
  const explanation = buildExplanation(direction, strength, signalBreakdown, hurst)

  return {
    value: composite,
    direction,
    strength,
    agreementCount: displayAgreement,
    agreementTotal: displayTotal,
    color,
    label,
    explanation,
    signalBreakdown,
  }
}

function classifyDirection(v: number): CompositeSignal['direction'] {
  if (v > 0.1) return 'long'
  if (v < -0.1) return 'short'
  return 'neutral'
}

function classifyStrength(v: number): CompositeSignal['strength'] {
  const abs = Math.abs(v)
  if (abs > 0.5) return 'strong'
  if (abs > 0.2) return 'moderate'
  return 'weak'
}

function compositeColor(v: number): SignalColor {
  const abs = Math.abs(v)
  if (abs > 0.3) return 'green'
  if (abs > 0.1) return 'yellow'
  return 'red'
}

function buildLabel(direction: CompositeSignal['direction'], strength: CompositeSignal['strength']): string {
  if (direction === 'neutral') return 'STAY OUT'
  const strengthWord = strength === 'strong' ? 'STRONG' : strength === 'moderate' ? 'MODERATE' : 'WEAK'
  return `${strengthWord} ${direction.toUpperCase()}`
}

function buildExplanation(
  direction: CompositeSignal['direction'],
  strength: CompositeSignal['strength'],
  breakdown: CompositeSignal['signalBreakdown'],
  hurst: HurstResult,
): string {
  if (direction === 'neutral') {
    return 'Signals are mixed with no clear direction. The safest move is to wait for stronger alignment before entering a trade.'
  }

  const dirWord = direction === 'long' ? 'LONG' : 'SHORT'
  const strengthWord = strength === 'strong' ? 'high' : strength === 'moderate' ? 'moderate' : 'low'

  const agreeing = breakdown.filter((s) => s.agrees).map((s) => s.name)
  const disagreeing = breakdown.filter((s) => !s.agrees).map((s) => s.name)

  let signalDetail = ''
  if (agreeing.length > 0) signalDetail += `${agreeing.join(' and ')} support this.`
  if (disagreeing.length > 0) signalDetail += ` ${disagreeing.join(' and ')} ${disagreeing.length === 1 ? 'disagrees' : 'disagree'}.`

  let regimeNote = ''
  if (hurst.regime === 'mean-reverting') {
    regimeNote = ' Market regime is favorable for this signal.'
  } else if (hurst.regime === 'trending') {
    regimeNote = ' However, the market is trending, which makes mean-reversion signals less reliable.'
  } else {
    regimeNote = ' Market conditions are unclear, so take this with caution.'
  }

  return `${dirWord} with ${strengthWord} conviction. ${signalDetail}${regimeNote}`
}
