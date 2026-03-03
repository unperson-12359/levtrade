import type { StateCreator } from 'zustand'
import type { AppStore } from '.'
import { TRACKED_COINS, type Candle } from '../types/market'
import { computeSuggestedSetup } from '../signals/setup'
import { SETUP_WINDOWS, emptyOutcome, resolveSetupWindow } from '../signals/resolveOutcome'
import type {
  SetupOutcome,
  SetupResolutionReason,
  SetupWindow,
  SuggestedSetup,
  TrackedSetup,
} from '../types/setup'
import { SETUP_RETENTION_MS, SETUP_DEDUPE_WINDOW_MS, ENTRY_SIMILARITY_THRESHOLD } from '../config/constants'
import { buildSetupId } from '../utils/identity'
import { summarizeCoverage } from '../utils/setupCoverage'

export interface SetupSlice {
  trackedSetups: TrackedSetup[]
  trackSetup: (setup: SuggestedSetup, serverOutcomes?: TrackedSetup['outcomes'], serverId?: string) => void
  hydrateServerSetups: (items: TrackedSetup[]) => void
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
        id: serverId ?? buildSetupId(setup),
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

  hydrateServerSetups: (items) =>
    set((state) => {
      if (items.length === 0) {
        return {}
      }

      const merged = [...state.trackedSetups]
      const indexById = new Map<string, number>()
      const indexBySemanticKey = new Map<string, number>()

      merged.forEach((tracked, index) => {
        indexById.set(tracked.id, index)
        indexBySemanticKey.set(buildSetupId(tracked.setup), index)
      })

      for (const item of items) {
        const normalized = normalizeTrackedSetupRecord(item)
        const semanticKey = buildSetupId(normalized.setup)
        const existingIndex = indexById.get(normalized.id) ?? indexBySemanticKey.get(semanticKey)

        if (existingIndex === undefined) {
          merged.push(normalized)
          const nextIndex = merged.length - 1
          indexById.set(normalized.id, nextIndex)
          indexBySemanticKey.set(semanticKey, nextIndex)
          continue
        }

        const nextTracked = mergeTrackedSetupRecords(merged[existingIndex]!, normalized)
        merged[existingIndex] = nextTracked
        indexById.set(nextTracked.id, existingIndex)
        indexBySemanticKey.set(buildSetupId(nextTracked.setup), existingIndex)
      }

      merged.sort((a, b) => a.setup.generatedAt - b.setup.generatedAt)
      return { trackedSetups: merged }
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
        // Always use 1h resolution candles for outcome scoring, independent of display interval
        const resCandles = state.resolutionCandles[tracked.setup.coin] ?? []
        const regularCandles = resCandles.length > 0 ? resCandles : (state.candles[tracked.setup.coin] ?? [])
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
      normalizeTrackedSetupRecord(item),
    ]
  })
}

function normalizeTrackedSetupRecord(tracked: TrackedSetup): TrackedSetup {
  return {
    ...tracked,
    coverageStatus: tracked.coverageStatus ?? summarizeCoverage(tracked.outcomes, undefined),
    outcomes: {
      '4h': normalizeOutcome(tracked.outcomes['4h'], '4h'),
      '24h': normalizeOutcome(tracked.outcomes['24h'], '24h'),
      '72h': normalizeOutcome(tracked.outcomes['72h'], '72h'),
    },
  }
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

function mergeTrackedSetupRecords(existing: TrackedSetup, incoming: TrackedSetup): TrackedSetup {
  const normalizedExisting = normalizeTrackedSetupRecord(existing)
  const normalizedIncoming = normalizeTrackedSetupRecord(incoming)

  const outcomes: Record<SetupWindow, SetupOutcome> = {
    '4h': preferOutcome(normalizedExisting.outcomes['4h'], normalizedIncoming.outcomes['4h']),
    '24h': preferOutcome(normalizedExisting.outcomes['24h'], normalizedIncoming.outcomes['24h']),
    '72h': preferOutcome(normalizedExisting.outcomes['72h'], normalizedIncoming.outcomes['72h']),
  }

  const preferIncomingSetup =
    normalizedIncoming.setup.source === 'server' ||
    resolvedOutcomeCount(normalizedIncoming) > resolvedOutcomeCount(normalizedExisting)

  const nextSetup = preferIncomingSetup ? normalizedIncoming.setup : normalizedExisting.setup
  const nextId = preferIncomingSetup ? normalizedIncoming.id : normalizedExisting.id

  return {
    id: nextId,
    setup: nextSetup,
    outcomes,
    coverageStatus: summarizeCoverage(outcomes, preferIncomingSetup ? normalizedIncoming.coverageStatus : normalizedExisting.coverageStatus),
  }
}

function preferOutcome(existing: SetupOutcome, incoming: SetupOutcome): SetupOutcome {
  const normalizedExisting = normalizeOutcome(existing, existing.window)
  const normalizedIncoming = normalizeOutcome(incoming, incoming.window)

  const existingRank = outcomeRank(normalizedExisting)
  const incomingRank = outcomeRank(normalizedIncoming)
  if (incomingRank > existingRank) return normalizedIncoming
  if (existingRank > incomingRank) return normalizedExisting

  const existingCoverage = coverageRank(normalizedExisting.coverageStatus)
  const incomingCoverage = coverageRank(normalizedIncoming.coverageStatus)
  if (incomingCoverage > existingCoverage) return normalizedIncoming
  if (existingCoverage > incomingCoverage) return normalizedExisting

  const existingCandles = normalizedExisting.candleCountUsed ?? 0
  const incomingCandles = normalizedIncoming.candleCountUsed ?? 0
  if (incomingCandles > existingCandles) return normalizedIncoming
  if (existingCandles > incomingCandles) return normalizedExisting

  if ((normalizedIncoming.resolvedAt ?? 0) > (normalizedExisting.resolvedAt ?? 0)) {
    return normalizedIncoming
  }

  return normalizedExisting
}

function outcomeRank(outcome: SetupOutcome): number {
  switch (outcome.result) {
    case 'pending':
      return 0
    case 'unresolvable':
      return 1
    case 'expired':
    case 'loss':
    case 'win':
      return 2
  }
}

function coverageRank(status: SetupOutcome['coverageStatus']): number {
  if (status === 'full') return 2
  if (status === 'partial') return 1
  return 0
}

function resolvedOutcomeCount(tracked: TrackedSetup): number {
  return (Object.values(tracked.outcomes) as SetupOutcome[]).filter((outcome) => outcome.result !== 'pending').length
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
