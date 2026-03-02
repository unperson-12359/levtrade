import type { FundingResult, SignalColor } from '../types/signals'
import type { FundingSnapshot } from '../types/market'

/**
 * Compute Funding Rate Z-Score: measure crowd positioning.
 *
 * High positive funding → crowd is heavily long → contrarian SHORT signal
 * High negative funding → crowd is heavily short → contrarian LONG signal
 *
 * The normalized signal is the OPPOSITE of funding z-score (contrarian).
 */
export function computeFundingZScore(
  history: FundingSnapshot[],
  windowSize: number = 30,
): FundingResult {
  const minRequired = 8

  if (history.length < minRequired) {
    return {
      currentRate: history.length > 0 ? history[history.length - 1]!.rate : 0,
      zScore: 0,
      normalizedSignal: 0,
      label: 'Insufficient Data',
      color: 'yellow',
      explanation: `Need at least ${minRequired} funding rate snapshots. Currently have ${history.length}.`,
    }
  }

  const window = history.slice(-windowSize)
  const currentRate = history[history.length - 1]!.rate
  const rates = window.map((s) => s.rate)

  const mean = rates.reduce((s, v) => s + v, 0) / rates.length
  const variance = rates.reduce((s, v) => s + (v - mean) ** 2, 0) / rates.length
  const stddev = Math.sqrt(variance)

  if (stddev === 0) {
    return {
      currentRate,
      zScore: 0,
      normalizedSignal: 0,
      label: 'Flat Funding',
      color: 'yellow',
      explanation: 'Funding rates have been steady — no extreme crowd positioning detected.',
    }
  }

  const zScore = (currentRate - mean) / stddev

  // Contrarian: high positive funding → short signal (negative)
  const normalizedSignal = Math.max(-1, Math.min(1, -zScore / 3))

  const { label, color } = classifyFunding(zScore, currentRate)
  const explanation = buildExplanation(zScore, currentRate)

  return { currentRate, zScore, normalizedSignal, label, color, explanation }
}

function classifyFunding(z: number, _rate: number): { label: string; color: SignalColor } {
  const abs = Math.abs(z)
  if (abs > 2) {
    return {
      label: z > 0 ? 'Extreme Longs' : 'Extreme Shorts',
      color: 'green', // extreme = contrarian opportunity
    }
  }
  if (abs > 1) {
    return {
      label: z > 0 ? 'Crowded Long' : 'Crowded Short',
      color: 'yellow',
    }
  }
  return {
    label: 'Balanced',
    color: 'red', // no edge
  }
}

function buildExplanation(z: number, rate: number): string {
  const abs = Math.abs(z)
  const rateStr = (rate * 100).toFixed(4)
  const zStr = z.toFixed(2)

  if (abs > 2) {
    if (z > 0) {
      return `The crowd is extremely long (funding: ${rateStr}%, z-score: ${zStr}). When everyone bets the same way, the market often moves against them. Strong contrarian SHORT signal.`
    }
    return `The crowd is extremely short (funding: ${rateStr}%, z-score: ${zStr}). Extreme bearish positioning often leads to a squeeze upward. Strong contrarian LONG signal.`
  }
  if (abs > 1) {
    if (z > 0) {
      return `More traders are long than usual (funding: ${rateStr}%, z-score: ${zStr}). Mild contrarian signal — the crowd could be wrong.`
    }
    return `More traders are short than usual (funding: ${rateStr}%, z-score: ${zStr}). Mild contrarian signal — shorts may get squeezed.`
  }
  return `Crowd positioning is balanced (funding: ${rateStr}%, z-score: ${zStr}). No strong contrarian signal — the crowd isn't extreme.`
}
