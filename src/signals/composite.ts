import type { CompositeSignal, SignalColor, HurstResult, ZScoreResult, FundingResult, OIDeltaResult } from '../types/signals'

/**
 * Compute Composite Signal by combining sub-signals.
 *
 * Each sub-signal is normalized to [-1, +1]:
 * - Hurst: (H - 0.5) * 4, so trending = positive bias, mean-reverting = negative
 *   BUT we use this as a confidence multiplier, not direction
 * - Z-Score normalizedSignal: already in [-1, +1]
 * - Funding normalizedSignal: already in [-1, +1]
 * - OI Delta normalizedSignal: already in [-1, +1]
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
  // Mean-reverting (H < 0.45): boost by 1.0-1.3x (our signals work best here)
  // Choppy (0.45-0.55): neutral 0.7-1.0x
  // Trending (H > 0.55): reduce by 0.3-0.7x (our signals are unreliable)
  let regimeMultiplier: number
  if (hurst.value < 0.45) {
    regimeMultiplier = 1.0 + (0.45 - hurst.value) * 3 // up to 1.3 at H=0.35
  } else if (hurst.value > 0.55) {
    regimeMultiplier = 0.7 - (hurst.value - 0.55) * 2 // down to 0.3 at H=0.75
  } else {
    regimeMultiplier = 0.7 + (0.55 - hurst.value) * 3 // 0.7 to 1.0
  }
  regimeMultiplier = Math.max(0.1, Math.min(1.3, regimeMultiplier))

  const composite = Math.max(-1, Math.min(1, rawComposite * regimeMultiplier))

  // Agreement: count how many directional signals share the same sign
  const positiveCount = directionalSignals.filter((s) => s > 0.1).length
  const negativeCount = directionalSignals.filter((s) => s < -0.1).length
  const agreementCount = Math.max(positiveCount, negativeCount)
  const agreementTotal = directionalSignals.length

  // Include hurst in agreement for display (4 total signals)
  const hurstAgreesWithDirection =
    (composite > 0 && hurst.regime === 'mean-reverting') ||
    (composite < 0 && hurst.regime === 'mean-reverting') ||
    hurst.regime === 'mean-reverting' // regime supports mean-reversion signals
  const displayAgreement = agreementCount + (hurstAgreesWithDirection ? 1 : 0)
  const displayTotal = agreementTotal + 1

  const direction = classifyDirection(composite)
  const strength = classifyStrength(composite)
  const color = compositeColor(composite)
  const label = buildLabel(direction, strength)
  const explanation = buildExplanation(composite, direction, strength, agreementCount, agreementTotal, hurst)

  return {
    value: composite,
    direction,
    strength,
    agreementCount: displayAgreement,
    agreementTotal: displayTotal,
    color,
    label,
    explanation,
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
  _value: number,
  direction: CompositeSignal['direction'],
  strength: CompositeSignal['strength'],
  agreementCount: number,
  agreementTotal: number,
  hurst: HurstResult,
): string {
  if (direction === 'neutral') {
    return 'Signals are mixed with no clear direction. The safest move is to wait for stronger alignment before entering a trade.'
  }

  const dirWord = direction === 'long' ? 'LONG' : 'SHORT'
  const strengthWord = strength === 'strong' ? 'high' : strength === 'moderate' ? 'moderate' : 'low'
  const agreementStr = `${agreementCount} of ${agreementTotal} indicators agree`

  let regimeNote = ''
  if (hurst.regime === 'mean-reverting') {
    regimeNote = ' Market conditions favor this type of signal.'
  } else if (hurst.regime === 'trending') {
    regimeNote = ' However, the market is trending, which makes mean-reversion signals less reliable.'
  } else {
    regimeNote = ' Market conditions are unclear, so take this with caution.'
  }

  return `${dirWord} with ${strengthWord} conviction — ${agreementStr}.${regimeNote}`
}
