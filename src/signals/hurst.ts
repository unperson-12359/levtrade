import type { HurstResult, MarketRegime, SignalColor } from '../types/signals'

const MIN_PERIODS = 100

/**
 * Compute Hurst exponent approximation using lag-1 autocorrelation of log returns.
 * H ≈ 0.5 + ACF(1)
 *
 * H > 0.55 → trending (momentum persists)
 * H < 0.45 → mean-reverting (prices snap back)
 * 0.45–0.55 → choppy/random
 */
export function computeHurst(closes: number[], period: number = MIN_PERIODS): HurstResult {
  const available = closes.length
  const confidence = Math.min(1, available / period)

  if (available < 3) {
    return {
      value: 0.5,
      regime: 'choppy',
      color: 'yellow',
      confidence: 0,
      explanation: 'Not enough data yet to determine market type.',
    }
  }

  // Use as many periods as we have, up to `period`
  const window = closes.slice(-Math.min(available, period + 1))

  // Compute log returns
  const returns: number[] = []
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1]!
    const curr = window[i]!
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev))
    }
  }

  if (returns.length < 2) {
    return {
      value: 0.5,
      regime: 'choppy',
      color: 'yellow',
      confidence: 0,
      explanation: 'Not enough data yet to determine market type.',
    }
  }

  // Mean of returns
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length

  // Variance
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length

  if (variance === 0) {
    return {
      value: 0.5,
      regime: 'choppy',
      color: 'yellow',
      confidence,
      explanation: 'Price has not moved — no trend or mean-reversion detected.',
    }
  }

  // Lag-1 autocovariance
  let autocovariance = 0
  for (let i = 1; i < returns.length; i++) {
    autocovariance += (returns[i]! - mean) * (returns[i - 1]! - mean)
  }
  autocovariance /= returns.length

  // ACF(1)
  const acf1 = autocovariance / variance

  // H approximation, clamped to [0, 1]
  const H = Math.max(0, Math.min(1, 0.5 + acf1))

  const regime = classifyRegime(H)
  const color = regimeColor(regime)
  const explanation = buildExplanation(H, regime, confidence)

  return { value: H, regime, color, confidence, explanation }
}

function classifyRegime(H: number): MarketRegime {
  if (H > 0.55) return 'trending'
  if (H < 0.45) return 'mean-reverting'
  return 'choppy'
}

function regimeColor(regime: MarketRegime): SignalColor {
  switch (regime) {
    case 'mean-reverting': return 'green'
    case 'trending': return 'yellow'
    case 'choppy': return 'red'
  }
}

function buildExplanation(H: number, regime: MarketRegime, confidence: number): string {
  if (confidence < 0.5) {
    return 'Still gathering data — market type will become clearer over the next few hours.'
  }

  switch (regime) {
    case 'trending':
      return H > 0.65
        ? 'The market is trending strongly in one direction — mean-reversion signals are unreliable here. Consider sitting this one out or trading with the trend.'
        : 'The market is showing mild trending behavior — signals may be less reliable than usual.'
    case 'mean-reverting':
      return H < 0.40
        ? 'The market is strongly bouncing between levels — this is ideal for our signals. Prices that stretch far from average tend to snap back.'
        : 'The market is bouncing between levels — good conditions for our signals.'
    case 'choppy':
      return 'The market is moving without a clear pattern — neither trending nor bouncing predictably. Signals are unreliable, consider waiting for clarity.'
  }
}
