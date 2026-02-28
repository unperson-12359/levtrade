import type { OIDeltaResult, SignalColor } from '../types/signals'
import type { OISnapshot } from '../types/market'

/**
 * Compute OI Delta + Price Direction: measure money flow conviction.
 *
 * Rising OI + Rising Price  → "New money entering longs" → confirmed bullish
 * Rising OI + Falling Price → "New money entering shorts" → confirmed bearish
 * Falling OI + Rising Price → "Shorts closing" → weak rally, may reverse
 * Falling OI + Falling Price → "Longs closing" → weak decline, may bounce
 */
export function computeOIDelta(
  oiHistory: OISnapshot[],
  closes: number[],
  windowSize: number = 5,
): OIDeltaResult {
  const minRequired = Math.max(2, windowSize + 1)
  if (oiHistory.length < minRequired || closes.length < minRequired) {
    return {
      oiChangePct: 0,
      priceChangePct: 0,
      confirmation: false,
      normalizedSignal: 0,
      label: 'Insufficient Data',
      color: 'yellow',
      explanation: `Need at least ${minRequired} data points to measure money flow. Currently have ${oiHistory.length}.`,
    }
  }

  // Use rolling window average for noise reduction instead of just 2 points
  const recentOI = oiHistory.slice(-windowSize)
  const olderOI = oiHistory.slice(-(windowSize * 2), -windowSize)

  const avgRecentOI = recentOI.reduce((s, v) => s + v.oi, 0) / recentOI.length
  const avgOlderOI = olderOI.length > 0
    ? olderOI.reduce((s, v) => s + v.oi, 0) / olderOI.length
    : oiHistory[oiHistory.length - minRequired]!.oi

  const recentCloses = closes.slice(-windowSize)
  const olderClose = closes[closes.length - minRequired]!
  const avgRecentPrice = recentCloses.reduce((s, v) => s + v, 0) / recentCloses.length

  const oiChangePct = avgOlderOI > 0 ? (avgRecentOI - avgOlderOI) / avgOlderOI : 0
  const priceChangePct = olderClose > 0 ? (avgRecentPrice - olderClose) / olderClose : 0

  const oiUp = oiChangePct > 0.005    // >0.5% change threshold (smoothed)
  const oiDown = oiChangePct < -0.005
  const priceUp = priceChangePct > 0.002  // >0.2% change threshold
  const priceDown = priceChangePct < -0.002

  // Determine confirmation and direction
  let confirmation: boolean
  let normalizedSignal: number
  let label: string
  let color: SignalColor
  let explanation: string

  if (oiUp && priceUp) {
    confirmation = true
    normalizedSignal = 0.5 + Math.min(0.5, Math.abs(oiChangePct) * 10)
    label = 'Confirmed Bullish'
    color = 'green'
    explanation = 'New money is flowing IN while price goes UP — the move is backed by real conviction. This is a strong bullish sign.'
  } else if (oiUp && priceDown) {
    confirmation = true
    normalizedSignal = -(0.5 + Math.min(0.5, Math.abs(oiChangePct) * 10))
    label = 'Confirmed Bearish'
    color = 'green'
    explanation = 'New money is flowing IN while price goes DOWN — fresh sellers are entering. This is a strong bearish sign.'
  } else if (oiDown && priceUp) {
    confirmation = false
    normalizedSignal = 0.2 // weak bullish
    label = 'Weak Rally'
    color = 'yellow'
    explanation = 'Price is going up but money is LEAVING the market — shorts are closing, not new buyers entering. The rally looks weak and may reverse.'
  } else if (oiDown && priceDown) {
    confirmation = false
    normalizedSignal = -0.2 // weak bearish
    label = 'Weak Decline'
    color = 'yellow'
    explanation = 'Price is going down but money is LEAVING — longs are closing, not new sellers entering. The decline looks weak and may bounce.'
  } else {
    confirmation = false
    normalizedSignal = 0
    label = 'No Clear Flow'
    color = 'red'
    explanation = 'Neither price nor open interest is moving significantly — no clear money flow signal.'
  }

  return {
    oiChangePct,
    priceChangePct,
    confirmation,
    normalizedSignal: Math.max(-1, Math.min(1, normalizedSignal)),
    label,
    color,
    explanation,
  }
}
