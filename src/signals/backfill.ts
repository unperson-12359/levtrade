import type { TrackedCoin, Candle, FundingSnapshot, OISnapshot } from '../types/market'
import type { AssetSignals, FundingResult, OIDeltaResult } from '../types/signals'
import { computeHurst } from './hurst'
import { computeZScore } from './zscore'
import { computeFundingZScore } from './funding'
import { computeOIDelta } from './oiDelta'
import { computeATR, computeRealizedVol } from './volatility'
import { computeEntryGeometry } from './entryGeometry'
import { computeComposite } from './composite'

const MIN_CANDLES_HURST = 100
const MIN_CANDLES_ZSCORE = 20
const MIN_FUNDING_ENTRIES = 8
const MIN_OI_ENTRIES = 6
const MS_PER_HOUR = 3_600_000

const NEUTRAL_FUNDING: FundingResult = {
  currentRate: 0,
  zScore: 0,
  normalizedSignal: 0,
  label: 'Unavailable',
  color: 'yellow',
  explanation: 'Funding data unavailable for backfill period',
}

const NEUTRAL_OI_DELTA: OIDeltaResult = {
  oiChangePct: 0,
  priceChangePct: 0,
  confirmation: false,
  normalizedSignal: 0,
  label: 'Unavailable',
  color: 'yellow',
  explanation: 'OI data unavailable for backfill period',
}

/**
 * Compute signals at a specific historical point in time.
 * Filters all data arrays to only include entries at or before targetTime.
 * Returns null if insufficient candle data for warmup.
 */
export function computeSignalsAtTime(
  coin: TrackedCoin,
  candles: Candle[],
  fundingHistory: FundingSnapshot[],
  oiHistory: OISnapshot[],
  targetTime: number,
): AssetSignals | null {
  const filteredCandles = candles.filter((c) => c.time <= targetTime)
  if (filteredCandles.length < MIN_CANDLES_HURST) {
    return null
  }

  const closes = filteredCandles.map((c) => c.close)

  // Candle-based signals (always available)
  const hurst = computeHurst(closes, MIN_CANDLES_HURST)
  const zScore = computeZScore(closes, MIN_CANDLES_ZSCORE)
  const volResult = computeRealizedVol(closes)
  const atr = computeATR(filteredCandles)
  const volatility = { ...volResult, atr }
  const entryGeometry = computeEntryGeometry(closes, atr, MIN_CANDLES_ZSCORE)

  // Funding: use neutral fallback if insufficient data
  const filteredFunding = fundingHistory.filter((f) => f.time <= targetTime)
  const funding = filteredFunding.length >= MIN_FUNDING_ENTRIES
    ? computeFundingZScore(filteredFunding)
    : NEUTRAL_FUNDING

  // OI delta: use neutral fallback if insufficient data
  const filteredOI = oiHistory.filter((o) => o.time <= targetTime)
  const oiDelta = filteredOI.length >= MIN_OI_ENTRIES
    ? computeOIDelta(filteredOI, closes)
    : NEUTRAL_OI_DELTA

  const composite = computeComposite(hurst, zScore, funding, oiDelta)

  return {
    coin,
    hurst,
    zScore,
    funding,
    oiDelta,
    volatility,
    entryGeometry,
    composite,
    updatedAt: targetTime,
    isStale: false,
    isWarmingUp: false,
    warmupProgress: 1,
  }
}

/**
 * Generate hour-aligned timestamps between lastComputedAt and now.
 * Returns timestamps at each hour boundary starting from the first full hour
 * after lastComputedAt, up to (but not including) the current hour.
 */
export function generateBackfillTimestamps(lastComputedAt: number, now: number): number[] {
  const firstHour = Math.ceil(lastComputedAt / MS_PER_HOUR) * MS_PER_HOUR
  const timestamps: number[] = []

  for (let t = firstHour; t < now; t += MS_PER_HOUR) {
    timestamps.push(t)
  }

  return timestamps
}
