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
    return trs.reduce((sum, value) => sum + value, 0) / trs.length
  }

  let atr = trs.slice(0, period).reduce((sum, value) => sum + value, 0) / period
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]!) / period
  }

  return atr
}

/**
 * Compute realized volatility (annualized) from close prices.
 * Uses log returns, annualized by sqrt(8760) for 24/7 crypto markets.
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

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length
  const hourlyVol = Math.sqrt(variance)
  const annualizedVol = hourlyVol * Math.sqrt(8760) * 100

  const { level, color } = classifyVol(annualizedVol)
  const explanation = buildExplanation(annualizedVol, level)

  return { realizedVol: annualizedVol, atr: 0, level, color, explanation }
}

function classifyVol(vol: number): { level: VolatilityResult['level']; color: SignalColor } {
  if (vol > 140) return { level: 'extreme', color: 'red' }
  if (vol > 90) return { level: 'high', color: 'yellow' }
  if (vol > 50) return { level: 'normal', color: 'green' }
  return { level: 'low', color: 'green' }
}

function buildExplanation(vol: number, level: VolatilityResult['level']): string {
  const volStr = vol.toFixed(1)

  switch (level) {
    case 'extreme':
      return `Volatility is EXTREME (${volStr}% annualized) - price is swinging wildly. Use much lower leverage and very wide stops, or sit this out entirely.`
    case 'high':
      return `Volatility is HIGH (${volStr}% annualized) - price is swinging a lot. Use lower leverage and wider stops than usual.`
    case 'normal':
      return `Volatility is NORMAL for crypto (${volStr}% annualized) - active but not extreme. Standard position sizing and stops are appropriate.`
    case 'low':
      return `Volatility is LOW (${volStr}% annualized) - price is calm and stable. Tighter stops are safer, and slightly higher leverage is more reasonable.`
  }
}
