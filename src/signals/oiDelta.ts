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
): OIDeltaResult {
  if (oiHistory.length < 2 || closes.length < 2) {
    return {
      oiChangePct: 0,
      priceChangePct: 0,
      confirmation: false,
      normalizedSignal: 0,
      label: 'Insufficient Data',
      color: 'yellow',
      explanation: 'Need more data to measure money flow.',
    }
  }

  const prevOI = oiHistory[oiHistory.length - 2]!.oi
  const currOI = oiHistory[oiHistory.length - 1]!.oi
  const prevPrice = closes[closes.length - 2]!
  const currPrice = closes[closes.length - 1]!

  const oiChangePct = prevOI > 0 ? (currOI - prevOI) / prevOI : 0
  const priceChangePct = prevPrice > 0 ? (currPrice - prevPrice) / prevPrice : 0

  const oiUp = oiChangePct > 0.001   // >0.1% change threshold
  const oiDown = oiChangePct < -0.001
  const priceUp = priceChangePct > 0.0005
  const priceDown = priceChangePct < -0.0005

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
