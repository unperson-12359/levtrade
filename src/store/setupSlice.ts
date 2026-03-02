import type { StateCreator } from 'zustand'
import type { AppStore } from '.'
import type { Candle } from '../types/market'
import type {
  SetupCoverageStatus,
  SetupOutcome,
  SetupResolutionReason,
  SetupWindow,
  SuggestedSetup,
  TrackedSetup,
} from '../types/setup'

const SETUP_WINDOWS: Record<SetupWindow, number> = {
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
}

const SETUP_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const SETUP_DEDUPE_WINDOW_MS = 4 * 60 * 60 * 1000
const ENTRY_SIMILARITY_THRESHOLD = 0.02

export interface SetupSlice {
  trackedSetups: TrackedSetup[]
  trackSetup: (setup: SuggestedSetup) => void
  resolveSetupOutcomes: (now?: number) => void
  pruneSetupHistory: (now?: number) => void
  clearSetupHistory: () => void
  exportSetupsCsv: () => void
  exportSetupsJson: () => void
  importSetupsJson: (file: File) => Promise<void>
}

export const createSetupSlice: StateCreator<AppStore, [], [], SetupSlice> = (set, get) => ({
  trackedSetups: [],

  trackSetup: (setup) =>
    set((state) => {
      const previous = [...state.trackedSetups]
        .reverse()
        .find((item) => item.setup.coin === setup.coin && item.setup.direction === setup.direction)

      if (previous) {
        const entryDrift = Math.abs(previous.setup.entryPrice - setup.entryPrice) / setup.entryPrice
        const withinDedupeWindow = setup.generatedAt - previous.setup.generatedAt < SETUP_DEDUPE_WINDOW_MS
        if (withinDedupeWindow && entryDrift <= ENTRY_SIMILARITY_THRESHOLD) {
          return {}
        }
      }

      const trackedSetup: TrackedSetup = {
        id: `${setup.coin}-${setup.direction}-${setup.generatedAt}-${Math.random().toString(36).slice(2, 6)}`,
        setup,
        coverageStatus: 'full',
        outcomes: {
          '4h': emptyOutcome('4h'),
          '24h': emptyOutcome('24h'),
          '72h': emptyOutcome('72h'),
        },
      }

      return {
        trackedSetups: [...state.trackedSetups, trackedSetup],
      }
    }),

  resolveSetupOutcomes: (now = Date.now()) =>
    set((state) => {
      let changed = false

      const trackedSetups = state.trackedSetups.map((tracked) => {
        let nextTracked = tracked
        const regularCandles = state.candles[tracked.setup.coin] ?? []
        const extendedCandles = state.extendedCandles[tracked.setup.coin] ?? []
        const candleMap = new Map<number, Candle>()
        for (const candle of [...extendedCandles, ...regularCandles]) {
          candleMap.set(candle.time, candle)
        }
        const coinCandles = [...candleMap.values()].sort((a, b) => a.time - b.time)

        ;(Object.keys(SETUP_WINDOWS) as SetupWindow[]).forEach((window) => {
          const currentOutcome = nextTracked.outcomes[window]
          if (currentOutcome.result !== 'pending') {
            return
          }

          const resolved = resolveSetupWindow(
            nextTracked.setup,
            window,
            coinCandles,
            regularCandles,
            extendedCandles,
            now,
          )

          if (!resolved) {
            return
          }

          changed = true
          nextTracked = {
            ...nextTracked,
            outcomes: {
              ...nextTracked.outcomes,
              [window]: resolved,
            },
          }
        })

        const coverageStatus = summarizeCoverage(nextTracked.outcomes, nextTracked.coverageStatus)
        if (coverageStatus !== nextTracked.coverageStatus) {
          changed = true
          nextTracked = {
            ...nextTracked,
            coverageStatus,
          }
        }

        return nextTracked
      })

      if (!changed) {
        return {}
      }

      return { trackedSetups }
    }),

  pruneSetupHistory: (now = Date.now()) =>
    set((state) => {
      const cutoff = now - SETUP_RETENTION_MS
      const trackedSetups = state.trackedSetups.filter((item) => item.setup.generatedAt >= cutoff)
      if (trackedSetups.length === state.trackedSetups.length) {
        return {}
      }
      return { trackedSetups }
    }),

  clearSetupHistory: () =>
    set({
      trackedSetups: [],
    }),

  exportSetupsCsv: () => {
    const state = get()
    const header = [
      'id',
      'coin',
      'direction',
      'entryPrice',
      'stopPrice',
      'targetPrice',
      'confidenceTier',
      'confidence',
      'regime',
      'entryQuality',
      'generatedAt',
      'coverageStatus',
      'result_4h',
      'reason_4h',
      'coverage_4h',
      'candles_4h',
      'rAchieved_4h',
      'returnPct_4h',
      'result_24h',
      'reason_24h',
      'coverage_24h',
      'candles_24h',
      'rAchieved_24h',
      'returnPct_24h',
      'result_72h',
      'reason_72h',
      'coverage_72h',
      'candles_72h',
      'rAchieved_72h',
      'returnPct_72h',
    ].join(',')

    const rows = state.trackedSetups.map((tracked) => {
      const setup = tracked.setup
      const o4 = tracked.outcomes['4h']
      const o24 = tracked.outcomes['24h']
      const o72 = tracked.outcomes['72h']

      return [
        tracked.id,
        setup.coin,
        setup.direction,
        setup.entryPrice,
        setup.stopPrice,
        setup.targetPrice,
        setup.confidenceTier,
        setup.confidence.toFixed(3),
        setup.regime,
        setup.entryQuality,
        new Date(setup.generatedAt).toISOString(),
        tracked.coverageStatus ?? '',
        o4.result,
        o4.resolutionReason ?? '',
        o4.coverageStatus ?? '',
        o4.candleCountUsed ?? '',
        o4.rAchieved ?? '',
        o4.returnPct ?? '',
        o24.result,
        o24.resolutionReason ?? '',
        o24.coverageStatus ?? '',
        o24.candleCountUsed ?? '',
        o24.rAchieved ?? '',
        o24.returnPct ?? '',
        o72.result,
        o72.resolutionReason ?? '',
        o72.coverageStatus ?? '',
        o72.candleCountUsed ?? '',
        o72.rAchieved ?? '',
        o72.returnPct ?? '',
      ].join(',')
    })

    downloadBlob([header, ...rows].join('\n'), `levtrade-setups-${Date.now()}.csv`, 'text/csv')
  },

  exportSetupsJson: () => {
    const payload = JSON.stringify(get().trackedSetups, null, 2)
    downloadBlob(payload, `levtrade-setups-${Date.now()}.json`, 'application/json')
  },

  importSetupsJson: async (file) => {
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as unknown
      const imported = normalizeImportedSetups(parsed)

      if (imported.length === 0) {
        get().addError('No valid setup history found in the selected JSON file.')
        return
      }

      set((state) => {
        const existingIds = new Set(state.trackedSetups.map((item) => item.id))
        const merged = [...state.trackedSetups]

        for (const tracked of imported) {
          if (!existingIds.has(tracked.id)) {
            merged.push(tracked)
          }
        }

        merged.sort((a, b) => a.setup.generatedAt - b.setup.generatedAt)
        return { trackedSetups: merged }
      })
    } catch {
      get().addError('Failed to import setup history JSON.')
    }
  },
})

function emptyOutcome(window: SetupWindow): SetupOutcome {
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

function resolveSetupWindow(
  setup: SuggestedSetup,
  window: SetupWindow,
  candles: Candle[],
  regularCandles: Candle[],
  extendedCandles: Candle[],
  now: number,
): SetupOutcome | null {
  const windowMs = SETUP_WINDOWS[window]
  const targetTime = setup.generatedAt + windowMs
  if (now < targetTime) {
    return null
  }

  const traversal = candles.filter((candle) => candle.time >= setup.generatedAt && candle.time <= targetTime)
  const resolutionCandle = candles.find((candle) => candle.time >= targetTime) ?? null
  const oldestRegularTime = regularCandles.length > 0 ? regularCandles[0]!.time : Infinity
  const usedBackfill = extendedCandles.length > 0 && setup.generatedAt < oldestRegularTime

  if (!resolutionCandle) {
    return {
      ...emptyOutcome(window),
      resolvedAt: now,
      result: 'unresolvable',
      resolutionReason: 'unresolvable',
      coverageStatus: 'insufficient',
      candleCountUsed: traversal.length,
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
    usedBackfill ? 'partial' : 'full'

  return {
    window,
    resolvedAt: now,
    result,
    resolutionReason,
    coverageStatus,
    candleCountUsed: traversal.length > 0
      ? inspectedCandles + 1   // traversal candles + the resolution candle
      : inspectedCandles,       // candlesToInspect was [resolutionCandle], already counted
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

function summarizeCoverage(
  outcomes: TrackedSetup['outcomes'],
  current: SetupCoverageStatus | undefined,
): SetupCoverageStatus {
  const values = Object.values(outcomes).map((outcome) => outcome.coverageStatus).filter(Boolean) as SetupCoverageStatus[]
  if (values.includes('insufficient')) return 'insufficient'
  if (values.includes('partial')) return 'partial'
  return current ?? 'full'
}

function downloadBlob(contents: string, filename: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function normalizeImportedSetups(payload: unknown): TrackedSetup[] {
  const list = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { trackedSetups?: unknown[] }).trackedSetups)
      ? (payload as { trackedSetups: unknown[] }).trackedSetups
      : []

  return list.flatMap((item) => {
    if (!isTrackedSetup(item)) {
      return []
    }

    return [
      {
        ...item,
        coverageStatus: item.coverageStatus ?? summarizeCoverage(item.outcomes, undefined),
        outcomes: {
          '4h': normalizeOutcome(item.outcomes['4h'], '4h'),
          '24h': normalizeOutcome(item.outcomes['24h'], '24h'),
          '72h': normalizeOutcome(item.outcomes['72h'], '72h'),
        },
      } satisfies TrackedSetup,
    ]
  })
}

function normalizeOutcome(outcome: SetupOutcome, window: SetupWindow): SetupOutcome {
  return {
    ...emptyOutcome(window),
    ...outcome,
    window,
    resolutionReason: outcome.resolutionReason ?? inferResolutionReason(outcome.result),
    coverageStatus: outcome.coverageStatus ?? 'full',
    candleCountUsed: outcome.candleCountUsed ?? 0,
  }
}

function inferResolutionReason(result: SetupOutcome['result']): SetupResolutionReason {
  switch (result) {
    case 'win':
      return 'target'
    case 'loss':
      return 'stop'
    case 'expired':
      return 'expired'
    case 'unresolvable':
      return 'unresolvable'
    case 'pending':
      return 'pending'
  }
}

function isTrackedSetup(value: unknown): value is TrackedSetup {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<TrackedSetup>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.setup === 'object' &&
    candidate.setup !== null &&
    typeof candidate.setup.generatedAt === 'number' &&
    typeof candidate.outcomes === 'object' &&
    candidate.outcomes !== null &&
    '4h' in candidate.outcomes &&
    '24h' in candidate.outcomes &&
    '72h' in candidate.outcomes
  )
}
