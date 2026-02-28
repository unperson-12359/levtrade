import type { Candle } from '../types/market'
import type { VolatilityResult, SignalColor } from '../types/signals'

/**
 * Compute ATR (Average True Range) using Wilder's smoothing.
 * TR = max(H-L, |H-prevC|, |L-prevC|)
 * ATR[n] = (ATR[n-1] * (period-1) + TR[n]) / period
 */
export function computeATR(candles: Candle[], period: number = 14): number {
  if (candles.length < 2) return 0

  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i]!
    const prev = candles[i - 1]!
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close),
    )
    trs.push(tr)
  }

  if (trs.length === 0) return 0
  if (trs.length < period) {
    // Not enough for full ATR, use simple average
    return trs.reduce((s, v) => s + v, 0) / trs.length
  }

  // Initial ATR: simple average of first `period` TRs
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period

  // Wilder's smoothing for remaining
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]!) / period
  }

  return atr
}

/**
 * Compute Realized Volatility (annualized) from close prices.
 * Uses log returns, annualized by sqrt(8760) for 24/7 crypto markets.
 *
 * Thresholds (crypto):
 * < 30% → low (green)
 * 30-60% → normal (yellow)
 * 60-100% → high (yellow)
 * > 100% → extreme (red)
 */
export function computeRealizedVol(closes: number[], period: number = 20): VolatilityResult {
  if (closes.length < period + 1) {
    return {
      realizedVol: 0,
      atr: 0,
      level: 'normal',
      color: 'yellow',
      explanation: `Need at least ${period + 1} candles to measure volatility. Currently have ${closes.length}.`,
    }
  }

  const window = closes.slice(-(period + 1))

  // Log returns
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
      realizedVol: 0,
      atr: 0,
      level: 'normal',
      color: 'yellow',
      explanation: 'Not enough price movement to measure volatility.',
    }
  }

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
  const hourlyVol = Math.sqrt(variance)

  // Annualize: 8760 hours in a year (crypto trades 24/7/365)
  const annualizedVol = hourlyVol * Math.sqrt(8760) * 100 // as percentage

  const { level, color } = classifyVol(annualizedVol)
  const explanation = buildExplanation(annualizedVol, level)

  return { realizedVol: annualizedVol, atr: 0, level, color, explanation }
}

function classifyVol(vol: number): { level: VolatilityResult['level']; color: SignalColor } {
  if (vol > 100) return { level: 'extreme', color: 'red' }
  if (vol > 60) return { level: 'high', color: 'yellow' }
  if (vol > 30) return { level: 'normal', color: 'green' }
  return { level: 'low', color: 'green' }
}

function buildExplanation(vol: number, level: VolatilityResult['level']): string {
  const volStr = vol.toFixed(1)

  switch (level) {
    case 'extreme':
      return `Volatility is EXTREME (${volStr}% annualized) — price is swinging wildly. Use much lower leverage and very wide stops, or sit this out entirely.`
    case 'high':
      return `Volatility is HIGH (${volStr}% annualized) — price is swinging a lot. Use lower leverage and wider stops than usual.`
    case 'normal':
      return `Volatility is NORMAL (${volStr}% annualized) — typical market conditions. Standard position sizing and stops are appropriate.`
    case 'low':
      return `Volatility is LOW (${volStr}% annualized) — price is calm and stable. Tighter stops are safe, and slightly higher leverage is reasonable.`
  }
}
