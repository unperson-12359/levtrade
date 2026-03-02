import type { StateCreator } from 'zustand'
import type { AppStore } from '.'
import { TRACKED_COINS, type Candle } from '../types/market'
import { computeSuggestedSetup } from '../signals/setup'
import { SETUP_WINDOWS, emptyOutcome, resolveSetupWindow, summarizeCoverage } from '../signals/resolveOutcome'
import type {
  SetupOutcome,
  SetupResolutionReason,
  SetupWindow,
  SuggestedSetup,
  TrackedSetup,
} from '../types/setup'

const SETUP_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const SETUP_DEDUPE_WINDOW_MS = 4 * 60 * 60 * 1000
const ENTRY_SIMILARITY_THRESHOLD = 0.02

export interface SetupSlice {
  trackedSetups: TrackedSetup[]
  trackSetup: (setup: SuggestedSetup, serverOutcomes?: TrackedSetup['outcomes'], serverId?: string) => void
  generateAllSetups: () => void
  resolveSetupOutcomes: (now?: number) => void
  pruneSetupHistory: (now?: number) => void
  sortSetupsByTime: () => void
  clearSetupHistory: () => void
  exportSetupsCsv: () => void
  exportSetupsJson: () => void
  importSetupsJson: (file: File) => Promise<void>
}

export const createSetupSlice: StateCreator<AppStore, [], [], SetupSlice> = (set, get) => ({
  trackedSetups: [],

  trackSetup: (setup, serverOutcomes?, serverId?) =>
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
        id: serverId ?? `${setup.coin}-${setup.direction}-${setup.generatedAt}-${Math.random().toString(36).slice(2, 6)}`,
        setup,
        coverageStatus: 'full',
        outcomes: serverOutcomes ?? {
          '4h': emptyOutcome('4h'),
          '24h': emptyOutcome('24h'),
          '72h': emptyOutcome('72h'),
        },
      }

      return {
        trackedSetups: [...state.trackedSetups, trackedSetup],
      }
    }),

  generateAllSetups: () => {
    const state = get()
    for (const coin of TRACKED_COINS) {
      const signals = state.signals[coin]
      const currentPrice = state.prices[coin]
      if (!signals || signals.isStale || signals.isWarmingUp || !currentPrice || !isFinite(currentPrice) || currentPrice <= 0) {
        continue
      }
      const setup = computeSuggestedSetup(coin, signals, currentPrice)
      if (setup) {
        get().trackSetup(setup)
      }
    }
  },

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
            now,
            { regularCandles, extendedCandles },
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

  sortSetupsByTime: () =>
    set((state) => ({
      trackedSetups: [...state.trackedSetups].sort((a, b) => a.setup.generatedAt - b.setup.generatedAt),
    })),

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
