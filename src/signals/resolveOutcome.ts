import type { Candle } from '../types/market'
import type {
  SetupCoverageStatus,
  SetupOutcome,
  SetupResolutionReason,
  SetupWindow,
  SuggestedSetup,
} from '../types/setup'

export const SETUP_WINDOWS: Record<SetupWindow, number> = {
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
}

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000
const CLOSE_ENOUGH_MS = 2 * 60 * 60 * 1000

export function emptyOutcome(window: SetupWindow): SetupOutcome {
  return {
    window,
    resolvedAt: null,
    result: 'pending',
    resolutionReason: 'pending',
    coverageStatus: 'full',
    candleCountUsed: 0,
    returnPct: null,
    rAchieved: null,
    mfe: null,
    mfePct: null,
    mae: null,
    maePct: null,
    targetHit: false,
    stopHit: false,
    priceAtResolution: null,
  }
}

/**
 * Resolve a single outcome window for a setup using candle data.
 * Returns a resolved SetupOutcome, or null if the window isn't resolvable yet.
 *
 * @param setup - The original setup with entry/stop/target prices
 * @param window - Which window to resolve ('4h', '24h', '72h')
 * @param candles - All available candles sorted by time ascending
 * @param now - Current timestamp
 * @param options - Optional: regularCandles and extendedCandles for coverage tracking
 */
export function resolveSetupWindow(
  setup: SuggestedSetup,
  window: SetupWindow,
  candles: Candle[],
  now: number,
  options?: {
    regularCandles?: Candle[]
    extendedCandles?: Candle[]
  },
): SetupOutcome | null {
  const windowMs = SETUP_WINDOWS[window]
  const targetTime = setup.generatedAt + windowMs
  if (now < targetTime) {
    return null
  }

  const traversal = candles.filter((c) => c.time >= setup.generatedAt && c.time <= targetTime)
  let resolutionCandle = candles.find((c) => c.time >= targetTime) ?? null

  const regularCandles = options?.regularCandles
  const extendedCandles = options?.extendedCandles
  const oldestRegularTime = regularCandles && regularCandles.length > 0 ? regularCandles[0]!.time : Infinity
  const usedBackfill = extendedCandles ? extendedCandles.length > 0 && setup.generatedAt < oldestRegularTime : false
  let partialResolution = false

  if (!resolutionCandle) {
    const latestCandle = candles.length > 0 ? candles[candles.length - 1]! : null

    if (latestCandle && latestCandle.time >= setup.generatedAt && (targetTime - latestCandle.time) <= CLOSE_ENOUGH_MS) {
      resolutionCandle = latestCandle
      partialResolution = true
    } else if (now >= targetTime + GRACE_PERIOD_MS) {
      return {
        ...emptyOutcome(window),
        resolvedAt: now,
        result: 'unresolvable',
        resolutionReason: 'unresolvable',
        coverageStatus: 'insufficient',
        candleCountUsed: traversal.length,
      }
    } else {
      return null
    }
  }

  const candlesToInspect = traversal.length > 0 ? traversal : [resolutionCandle]
  let highestHigh = -Infinity
  let lowestLow = Infinity
  let result: SetupOutcome['result'] = 'expired'
  let resolutionReason: SetupResolutionReason = 'expired'
  let priceAtResolution = resolutionCandle.close
  let targetHit = false
  let stopHit = false
  let inspectedCandles = 0

  for (const candle of candlesToInspect) {
    inspectedCandles += 1
    highestHigh = Math.max(highestHigh, candle.high)
    lowestLow = Math.min(lowestLow, candle.low)

    const hitTarget = didHitTarget(setup, candle)
    const hitStop = didHitStop(setup, candle)

    if (hitTarget && hitStop) {
      const toStop = Math.abs(candle.open - setup.stopPrice)
      const toTarget = Math.abs(candle.open - setup.targetPrice)
      if (toStop <= toTarget) {
        result = 'loss'
        resolutionReason = 'stop'
        priceAtResolution = setup.stopPrice
        stopHit = true
      } else {
        result = 'win'
        resolutionReason = 'target'
        priceAtResolution = setup.targetPrice
        targetHit = true
      }
      break
    }

    if (hitTarget) {
      result = 'win'
      resolutionReason = 'target'
      priceAtResolution = setup.targetPrice
      targetHit = true
      break
    }

    if (hitStop) {
      result = 'loss'
      resolutionReason = 'stop'
      priceAtResolution = setup.stopPrice
      stopHit = true
      break
    }
  }

  if (highestHigh === -Infinity || lowestLow === Infinity) {
    highestHigh = resolutionCandle.high
    lowestLow = resolutionCandle.low
  }

  const stopDistance = Math.abs(setup.entryPrice - setup.stopPrice)
  const returnPct =
    setup.direction === 'long'
      ? ((priceAtResolution - setup.entryPrice) / setup.entryPrice) * 100
      : ((setup.entryPrice - priceAtResolution) / setup.entryPrice) * 100
  const rAchieved =
    stopDistance > 0
      ? setup.direction === 'long'
        ? (priceAtResolution - setup.entryPrice) / stopDistance
        : (setup.entryPrice - priceAtResolution) / stopDistance
      : null

  const coverageStatus: SetupCoverageStatus =
    partialResolution || usedBackfill ? 'partial' : 'full'

  return {
    window,
    resolvedAt: now,
    result,
    resolutionReason,
    coverageStatus,
    candleCountUsed: traversal.length > 0
      ? inspectedCandles + 1
      : inspectedCandles,
    returnPct,
    rAchieved,
    mfe: computeMfe(setup, highestHigh, lowestLow),
    mfePct: computeMfePct(setup, highestHigh, lowestLow),
    mae: computeMae(setup, highestHigh, lowestLow),
    maePct: computeMaePct(setup, highestHigh, lowestLow),
    targetHit,
    stopHit,
    priceAtResolution,
  }
}

function didHitTarget(setup: SuggestedSetup, candle: Candle): boolean {
  return setup.direction === 'long' ? candle.high >= setup.targetPrice : candle.low <= setup.targetPrice
}

function didHitStop(setup: SuggestedSetup, candle: Candle): boolean {
  return setup.direction === 'long' ? candle.low <= setup.stopPrice : candle.high >= setup.stopPrice
}

function computeMfe(setup: SuggestedSetup, highestHigh: number, lowestLow: number): number {
  return setup.direction === 'long' ? highestHigh - setup.entryPrice : setup.entryPrice - lowestLow
}

function computeMfePct(setup: SuggestedSetup, highestHigh: number, lowestLow: number): number {
  return (computeMfe(setup, highestHigh, lowestLow) / setup.entryPrice) * 100
}

function computeMae(setup: SuggestedSetup, highestHigh: number, lowestLow: number): number {
  return setup.direction === 'long' ? setup.entryPrice - lowestLow : highestHigh - setup.entryPrice
}

function computeMaePct(setup: SuggestedSetup, highestHigh: number, lowestLow: number): number {
  return (computeMae(setup, highestHigh, lowestLow) / setup.entryPrice) * 100
}

export function summarizeCoverage(
  outcomes: Record<SetupWindow, SetupOutcome>,
  current: SetupCoverageStatus | undefined,
): SetupCoverageStatus {
  const values = Object.values(outcomes).map((o) => o.coverageStatus).filter(Boolean) as SetupCoverageStatus[]
  if (values.includes('insufficient')) return 'insufficient'
  if (values.includes('partial')) return 'partial'
  return current ?? 'full'
}
