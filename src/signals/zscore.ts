import type { ZScoreResult, SignalColor } from '../types/signals'

/**
 * Compute Z-Score: how many standard deviations the current price is from its rolling mean.
 *
 * z > +2   → strongly overbought (price unusually high)
 * z > +1   → mildly overbought
 * z < -1   → mildly oversold
 * z < -2   → strongly oversold (price unusually low)
 *
 * For mean-reversion: extreme z-scores suggest reversal. The signal direction is OPPOSITE to z-score.
 * z > 2 → SHORT signal (price is too high, likely to drop)
 * z < -2 → LONG signal (price is too low, likely to bounce)
 */
export function computeZScore(closes: number[], period: number = 20): ZScoreResult {
  if (closes.length < period) {
    return {
      value: 0,
      normalizedSignal: 0,
      label: 'Insufficient Data',
      color: 'yellow',
      explanation: `Need at least ${period} candles to calculate price position. Currently have ${closes.length}.`,
    }
  }

  const window = closes.slice(-period)
  const current = closes[closes.length - 1]!

  const mean = window.reduce((s, v) => s + v, 0) / period
  const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / period
  const stddev = Math.sqrt(variance)

  if (stddev === 0) {
    return {
      value: 0,
      normalizedSignal: 0,
      label: 'No Movement',
      color: 'yellow',
      explanation: 'Price has been flat — no position signal.',
    }
  }

  const z = (current - mean) / stddev

  // Normalized signal: for mean-reversion, invert z and clamp to [-1, +1]
  // Negative z (oversold) → positive signal (go long)
  // Positive z (overbought) → negative signal (go short)
  const normalizedSignal = Math.max(-1, Math.min(1, -z / 3))

  const { label, color } = classifyZScore(z)
  const explanation = buildExplanation(z, current, mean)

  return { value: z, normalizedSignal, label, color, explanation }
}

function classifyZScore(z: number): { label: string; color: SignalColor } {
  const abs = Math.abs(z)
  if (abs > 2.5) {
    return {
      label: z > 0 ? 'Extremely Overbought' : 'Extremely Oversold',
      color: 'green', // extreme = opportunity for mean-reversion
    }
  }
  if (abs > 2) {
    return {
      label: z > 0 ? 'Strongly Overbought' : 'Strongly Oversold',
      color: 'green',
    }
  }
  if (abs > 1) {
    return {
      label: z > 0 ? 'Overbought' : 'Oversold',
      color: 'yellow',
    }
  }
  return {
    label: 'Normal Range',
    color: 'red', // no opportunity
  }
}

function buildExplanation(z: number, current: number, mean: number): string {
  const abs = Math.abs(z)
  const direction = z > 0 ? 'above' : 'below'
  const reverseAction = z > 0 ? 'drop back down' : 'bounce back up'
  const priceStr = current.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const meanStr = mean.toLocaleString('en-US', { maximumFractionDigits: 2 })

  if (abs > 2) {
    return `Price ($${priceStr}) is ${abs.toFixed(1)} std devs ${direction} the 20-period average ($${meanStr}) — unusually ${z > 0 ? 'expensive' : 'cheap'}, often means it will ${reverseAction}. Strong contrarian signal.`
  }
  if (abs > 1) {
    return `Price ($${priceStr}) is ${abs.toFixed(1)} std devs ${direction} the average ($${meanStr}) — starting to look ${z > 0 ? 'expensive' : 'cheap'}, but not extreme yet.`
  }
  return `Price ($${priceStr}) is near its 20-period average ($${meanStr}) — nothing unusual. No signal from price position.`
}
